import { Planet, Moon, Star } from 'dummy/tests/support/dummy-models';
import { createStore } from 'dummy/tests/support/store';
import { module, test } from 'qunit';
import { waitForSource } from 'ember-orbit/test-support';
import { Store, Cache, Model } from 'ember-orbit';

module('Integration - Cache', function(hooks) {
  let store: Store;
  let cache: Cache;

  hooks.beforeEach(function() {
    const models = { planet: Planet, moon: Moon, star: Star };
    store = createStore({ models });
    cache = store.cache;
  });

  hooks.afterEach(function() {
    store.destroy();
  });

  test('liveQuery - adds record that becomes a match', async function(assert) {
    const liveQuery = cache.liveQuery(q =>
      q.findRecords('planet').filter({ attribute: 'name', value: 'Jupiter' })
    );

    await store.addRecord({
      id: 'jupiter',
      type: 'planet',
      attributes: { name: 'Jupiter' }
    });
    assert.equal(liveQuery.length, 0);

    await store.update(t =>
      t.replaceAttribute({ type: 'planet', id: 'jupiter' }, 'name', 'Jupiter')
    );
    assert.equal(liveQuery.length, 1);
  });

  test('liveQuery - updates when matching record is added', async function(assert) {
    const planets = cache.liveQuery(q => q.findRecords('planet'));
    const jupiter = await store.addRecord({
      id: 'jupiter',
      type: 'planet',
      name: 'Jupiter'
    });
    assert.ok(planets.includes(jupiter));
  });

  test('liveQuery - updates when matching record is removed', async function(assert) {
    const planets = cache.liveQuery(q => q.findRecords('planet'));
    const jupiter = await store.addRecord({ type: 'planet', name: 'Jupiter' });
    await store.removeRecord(jupiter);
    assert.notOk(planets.includes(jupiter));
  });

  test('liveQuery - ignores non matching record', async function(assert) {
    const planets = cache.liveQuery(q => q.findRecords('planet'));
    const callisto = await store.addRecord({ type: 'moon', name: 'Callisto' });
    assert.notOk(planets.includes(callisto));
  });

  test('liveQuery - removes record that has been removed', async function(assert) {
    const planets = cache.liveQuery(q => q.findRecords('planet'));

    await store.update(t => [
      t.addRecord({ type: 'planet', id: 'Jupiter' }),
      t.addRecord({ type: 'planet', id: 'Earth' })
    ]);
    assert.equal(planets.length, 2);

    await store.update(t => t.removeRecord({ type: 'planet', id: 'Jupiter' }));
    assert.equal(planets.length, 1);
  });

  test('liveQuery - removes record that no longer matches', async function(assert) {
    const planets = cache.liveQuery(q =>
      q.findRecords('planet').filter({ attribute: 'name', value: 'Jupiter' })
    );

    const jupiter = await store.addRecord({ type: 'planet', name: 'Jupiter' });
    assert.equal(planets.length, 1);
    assert.ok(planets.includes(jupiter));

    await store.update(t => t.replaceAttribute(jupiter, 'name', 'Jupiter2'));
    assert.equal(planets.length, 0);
    assert.notOk(planets.includes(jupiter));
  });

  test('#peekRecord - existing record', async function(assert) {
    const jupiter = await store.addRecord({ type: 'planet', name: 'Jupiter' });
    assert.strictEqual(
      cache.record({ type: 'planet', id: jupiter.id }),
      jupiter,
      'retrieved record'
    );
  });

  test('#peekRecord - missing record', async function(assert) {
    assert.strictEqual(cache.record({ type: 'planet', id: 'fake' }), undefined);
  });

  test('#peekRecords', async function(assert) {
    const earth = await store.addRecord({ type: 'planet', name: 'Earth' });
    const jupiter = await store.addRecord({ type: 'planet', name: 'Jupiter' });
    await store.addRecord({ type: 'moon', name: 'Io' });

    const planets = cache.records('planet');
    assert.equal(planets.length, 2);
    assert.ok(planets.includes(earth));
    assert.ok(planets.includes(jupiter));
  });

  test('#peekAttribute - existing record + attribute', async function(assert) {
    const jupiter = await store.addRecord({ type: 'planet', name: 'Jupiter' });
    assert.equal(cache.peekAttribute(jupiter, 'name'), 'Jupiter');
  });

  test('#peekAttribute - missing record', async function(assert) {
    assert.strictEqual(
      cache.peekAttribute({ type: 'planet', id: 'fake' }, 'name'),
      undefined
    );
  });

  test('#peekAttribute - existing record, missing attribute', async function(assert) {
    const jupiter = await store.addRecord({ type: 'planet', name: 'Jupiter' });
    assert.strictEqual(cache.peekAttribute(jupiter, 'fake'), undefined);
  });

  test('#peekRelatedRecord - existing record + relationship', async function(assert) {
    const jupiter = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter'
    });
    const callisto = await store.addRecord<Moon>({
      type: 'moon',
      name: 'Callisto'
    });

    callisto.planet = jupiter;

    await waitForSource(store);
    assert.strictEqual(cache.relatedRecord(callisto, 'planet'), jupiter);
  });

  test('#peekRelatedRecord - missing record', async function(assert) {
    assert.strictEqual(
      cache.relatedRecord({ type: 'planet', id: 'fake' }, 'planet'),
      undefined
    );
  });

  test('#peekRelatedRecord - existing record, empty relationship', async function(assert) {
    const callisto = await store.addRecord({
      type: 'moon',
      name: 'Callisto',
      planet: null
    });
    assert.strictEqual(cache.relatedRecord(callisto, 'planet'), null);
  });

  test('#peekRelatedRecord - existing record, missing relationship', async function(assert) {
    const callisto = await store.addRecord({ type: 'moon', name: 'Callisto' });
    assert.strictEqual(cache.relatedRecord(callisto, 'planet'), undefined);
  });

  test('#peekRelatedRecords - existing record + relatedRecords', async function(assert) {
    const callisto = await store.addRecord({ type: 'moon', name: 'Callisto' });
    const europa = await store.addRecord({ type: 'moon', name: 'Europa' });
    const jupiter = await store.addRecord({
      type: 'planet',
      name: 'Jupiter',
      moons: [callisto, europa]
    });
    assert.deepEqual(cache.relatedRecords(jupiter, 'moons'), [
      callisto,
      europa
    ]);
  });

  test('#peekRelatedRecords - missing record', async function(assert) {
    assert.strictEqual(
      cache.relatedRecords({ type: 'planet', id: 'fake' }, 'moons'),
      undefined
    );
  });

  test('#peekRelatedRecords - existing record, empty relationship', async function(assert) {
    const jupiter = await store.addRecord({
      type: 'planet',
      name: 'Jupiter',
      moons: []
    });
    assert.deepEqual(cache.relatedRecords(jupiter, 'moons'), []);
  });

  test('#peekRelatedRecords - existing record, missing relationship', async function(assert) {
    const jupiter = await store.addRecord({
      type: 'planet',
      name: 'Jupiter'
    });
    assert.strictEqual(cache.relatedRecords(jupiter, 'moons'), undefined);
  });

  test('#peekRecordData - existing record', async function(assert) {
    const jupiter = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter'
    });
    const recordData = cache.raw({ type: 'planet', id: jupiter.id });
    assert.ok(recordData, 'retrieved record data');
    assert.equal(
      recordData?.attributes?.name,
      'Jupiter',
      'retrieved record data has attribute value'
    );
  });

  test('peekRecordData - missing record', async function(assert) {
    assert.strictEqual(cache.raw({ type: 'planet', id: 'fake' }), undefined);
  });

  test('#query - record', async function(assert) {
    const earth = await store.addRecord({ type: 'planet', name: 'Earth' });
    await store.addRecord({ type: 'planet', name: 'Jupiter' });
    const foundRecord = cache.query(q => q.findRecord(earth));
    assert.strictEqual(foundRecord, earth);
  });

  test('#query - missing record', function(assert) {
    assert.throws(
      () => cache.query(q => q.findRecord({ type: 'planet', id: 'fake' })),
      'Record not found: planet:fake'
    );
  });

  test('#query - records', async function(assert) {
    const earth = await store.addRecord({ type: 'planet', name: 'Earth' });
    const jupiter = await store.addRecord({ type: 'planet', name: 'Jupiter' });
    const foundRecords = cache.query(q => q.findRecords('planet')) as Model[];
    assert.equal(foundRecords.length, 2, 'two records found');
    assert.ok(foundRecords.includes(earth), 'earth is included');
    assert.ok(foundRecords.includes(jupiter), 'jupiter is included');
  });

  test('#query - filter', async function(assert) {
    const earth = await store.addRecord({ type: 'planet', name: 'Earth' });
    await store.addRecord({ type: 'planet', name: 'Jupiter' });
    const foundRecords = cache.query(q =>
      q.findRecords('planet').filter({ attribute: 'name', value: 'Earth' })
    ) as Model[];
    assert.deepEqual(foundRecords, [earth]);
    assert.strictEqual(foundRecords[0], earth);
  });
});
