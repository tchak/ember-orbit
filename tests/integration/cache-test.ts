import { Planet, Moon, Star } from 'dummy/tests/support/dummy-models';
import { createStore } from 'dummy/tests/support/store';
import { module, test } from 'qunit';
import { waitForSource, waitForLiveArray } from 'ember-orbit/test-support';
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
    const planets = cache.liveQuery(q =>
      q.findRecords('planet').filter({ attribute: 'name', value: 'Jupiter' })
    );

    await store.records('planet').add({
      id: 'jupiter',
      attributes: { name: 'Jupiter' }
    });

    await waitForLiveArray(planets);
    assert.equal(planets.length, 0);

    await store.update(t =>
      t.replaceAttribute({ type: 'planet', id: 'jupiter' }, 'name', 'Jupiter')
    );

    await waitForLiveArray(planets);
    assert.equal(planets.length, 1);
  });

  test('liveQuery - updates when matching record is added', async function(assert) {
    const planets = cache.liveQuery(q => q.findRecords('planet'));
    const jupiter = await store.records('planet').add({
      id: 'jupiter',
      name: 'Jupiter'
    });

    await waitForLiveArray(planets);
    assert.ok(planets.has(jupiter));
    assert.deepEqual([...planets], [jupiter]);
  });

  test('liveQuery - updates when matching record is removed', async function(assert) {
    const planets = cache.liveQuery(q => q.findRecords('planet'));
    const jupiter = await store.records('planet').add({ name: 'Jupiter' });
    await store.record(jupiter).remove();

    await waitForLiveArray(planets);
    assert.notOk(planets.has(jupiter));
  });

  test('liveQuery - ignores non matching record', async function(assert) {
    const planets = cache.liveQuery(q => q.findRecords('planet'));
    const callisto = await store.records('moon').add({ name: 'Callisto' });

    await waitForLiveArray(planets);
    assert.notOk(planets.has(callisto));
  });

  test('liveQuery - removes record that has been removed', async function(assert) {
    const planets = cache.liveQuery(q => q.findRecords('planet'));

    await store.update(t => [
      t.addRecord({ type: 'planet', id: 'Jupiter' }),
      t.addRecord({ type: 'planet', id: 'Earth' })
    ]);

    await waitForLiveArray(planets);
    assert.equal(planets.length, 2);

    await store.update(t => t.removeRecord({ type: 'planet', id: 'Jupiter' }));

    await waitForLiveArray(planets);
    assert.equal(planets.length, 1);
  });

  test('liveQuery - removes record that no longer matches', async function(assert) {
    const planets = cache.liveQuery(q =>
      q.findRecords('planet').filter({ attribute: 'name', value: 'Jupiter' })
    );

    const jupiter = await store.records('planet').add({ name: 'Jupiter' });

    await waitForLiveArray(planets);
    assert.equal(planets.length, 1);
    assert.ok(planets.has(jupiter));

    await store.update(t => t.replaceAttribute(jupiter, 'name', 'Jupiter2'));

    await waitForLiveArray(planets);
    assert.equal(planets.length, 0);
    assert.notOk(planets.has(jupiter));
  });

  test('#record - existing record', async function(assert) {
    const jupiter = await store.records('planet').add({ name: 'Jupiter' });
    assert.strictEqual(
      cache.record({ type: 'planet', id: jupiter.id }),
      jupiter,
      'retrieved record'
    );
  });

  test('#record - missing record', async function(assert) {
    assert.strictEqual(cache.record({ type: 'planet', id: 'fake' }), undefined);
  });

  test('#records', async function(assert) {
    const earth = await store.records('planet').add({ name: 'Earth' });
    const jupiter = await store.records('planet').add({ name: 'Jupiter' });
    await store.records('moon').add({ name: 'Io' });

    const planets = cache.records('planet');
    assert.equal(planets.length, 2);
    assert.ok(planets.includes(earth));
    assert.ok(planets.includes(jupiter));
  });

  test('#relatedRecord - existing record + relationship', async function(assert) {
    const jupiter = await store.records<Planet>('planet').add({
      name: 'Jupiter'
    });
    const callisto = await store.records<Moon>('moon').add({
      name: 'Callisto'
    });

    callisto.planet = jupiter;

    await waitForSource(store);
    assert.strictEqual(cache.relatedRecord(callisto, 'planet'), jupiter);
  });

  test('#relatedRecord - missing record', async function(assert) {
    assert.strictEqual(
      cache.relatedRecord({ type: 'planet', id: 'fake' }, 'planet'),
      undefined
    );
  });

  test('#relatedRecord - existing record, empty relationship', async function(assert) {
    const callisto = await store.records('moon').add({
      name: 'Callisto',
      planet: null
    });
    assert.strictEqual(cache.relatedRecord(callisto, 'planet'), null);
  });

  test('#relatedRecord - existing record, missing relationship', async function(assert) {
    const callisto = await store.records('moon').add({ name: 'Callisto' });
    assert.strictEqual(cache.relatedRecord(callisto, 'planet'), undefined);
  });

  test('#relatedRecords - existing record + relatedRecords', async function(assert) {
    const callisto = await store.records('moon').add({ name: 'Callisto' });
    const europa = await store.records('moon').add({ name: 'Europa' });
    const jupiter = await store.records('planet').add({
      name: 'Jupiter',
      moons: [callisto, europa]
    });
    assert.deepEqual(cache.relatedRecords(jupiter, 'moons'), [
      callisto,
      europa
    ]);
  });

  test('#relatedRecords - missing record', async function(assert) {
    assert.strictEqual(
      cache.relatedRecords({ type: 'planet', id: 'fake' }, 'moons'),
      undefined
    );
  });

  test('#relatedRecords - existing record, empty relationship', async function(assert) {
    const jupiter = await store.records('planet').add({
      name: 'Jupiter',
      moons: []
    });
    assert.deepEqual(cache.relatedRecords(jupiter, 'moons'), []);
  });

  test('#relatedRecords - existing record, missing relationship', async function(assert) {
    const jupiter = await store.records('planet').add({
      name: 'Jupiter'
    });
    assert.strictEqual(cache.relatedRecords(jupiter, 'moons'), undefined);
  });

  test('#raw - existing record', async function(assert) {
    const jupiter = await store.records<Planet>('planet').add({
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

  test('#raw - missing record', async function(assert) {
    assert.strictEqual(cache.raw({ type: 'planet', id: 'fake' }), undefined);
  });

  test('#query - record', async function(assert) {
    const earth = await store.records('planet').add({ name: 'Earth' });
    await store.records('planet').add({ name: 'Jupiter' });
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
    const earth = await store.records('planet').add({ name: 'Earth' });
    const jupiter = await store.records('planet').add({ name: 'Jupiter' });
    const foundRecords = cache.query(q => q.findRecords('planet')) as Model[];

    assert.equal(foundRecords.length, 2, 'two records found');
    assert.ok(foundRecords.includes(earth), 'earth is included');
    assert.ok(foundRecords.includes(jupiter), 'jupiter is included');
  });

  test('#query - filter', async function(assert) {
    const earth = await store.records('planet').add({ name: 'Earth' });
    await store.records('planet').add({ name: 'Jupiter' });
    const foundRecords = cache.query(q =>
      q.findRecords('planet').filter({ attribute: 'name', value: 'Earth' })
    ) as Model[];

    assert.deepEqual(foundRecords, [earth]);
    assert.strictEqual(foundRecords[0], earth);
  });
});
