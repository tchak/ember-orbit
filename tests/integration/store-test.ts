import { Planet, Moon, Star } from 'dummy/tests/support/dummy-models';
import { createStore } from 'dummy/tests/support/store';
import { buildTransform } from '@orbit/data';
import { module, test } from 'qunit';
import { Store } from 'ember-orbit';
import { waitForLiveArray } from 'ember-orbit/test-support';

module('Integration - Store', function(hooks) {
  let store: Store;
  const models = { planet: Planet, moon: Moon, star: Star };

  hooks.beforeEach(function() {
    store = createStore({ models });
  });

  hooks.afterEach(function() {
    store.destroy();
  });

  test('#records.add', async function(assert) {
    const planet = await store.records<Planet>('planet').add({
      name: 'Earth'
    });

    assert.ok(planet instanceof Planet);
    assert.ok(planet.id, 'assigned id');
    assert.equal(planet.name, 'Earth');
  });

  test('#records.add - with blocking sync updates', async function(assert) {
    store.on('beforeUpdate', transform => {
      return store.sync(transform);
    });

    const planet = await store.records<Planet>('planet').add({
      name: 'Earth'
    });

    assert.ok(planet instanceof Planet);
    assert.ok(planet.id, 'assigned id');
    assert.equal(planet.name, 'Earth');
  });

  test('#record', async function(assert) {
    const earth = await store.records<Planet>('planet').add({
      name: 'Earth'
    });
    const planet = await store.record({ type: 'planet', id: earth.id });
    assert.strictEqual(planet, earth);
  });

  test('#record - missing record', async function(assert) {
    try {
      await store.record({ type: 'planet', id: 'jupiter' });
    } catch (e) {
      assert.equal(e.message, 'Record not found: planet:jupiter');
    }
  });

  test('#record.remove() - when passed a record, it should serialize its identity in a `removeRecord` op', async function(assert) {
    assert.expect(2);

    const record = await store.records('planet').add({ name: 'Earth' });

    store.on('update', data => {
      assert.deepEqual(
        data.operations,
        [
          {
            op: 'removeRecord',
            record: { type: 'planet', id: record.id }
          }
        ],
        'only the identity has been serialized in the operation'
      );
    });

    await store.record(record).remove();

    try {
      await store.record({ type: 'planet', id: record.id });
    } catch (error) {
      assert.ok(error.message.match(/Record not found/));
    }
  });

  test('#record.remove() - when passed an identity', async function(assert) {
    assert.expect(2);

    const record = await store.records('planet').add({ name: 'Earth' });

    store.on('update', data => {
      assert.deepEqual(
        data.operations,
        [
          {
            op: 'removeRecord',
            record: { type: 'planet', id: record.id }
          }
        ],
        'only the identity has been serialized in the operation'
      );
    });

    await store.record(record).remove();

    try {
      await store.record(record);
    } catch (error) {
      assert.ok(error.message.match(/Record not found/));
    }
  });

  test('#getTransform - returns a particular transform given an id', async function(assert) {
    const recordA = {
      id: 'jupiter',
      type: 'planet',
      attributes: { name: 'Jupiter' }
    };

    const addRecordATransform = buildTransform(
      store.transformBuilder.addRecord(recordA)
    );

    await store.sync(addRecordATransform);
    assert.strictEqual(
      store.getTransform(addRecordATransform.id),
      addRecordATransform
    );
  });

  test('#getInverseOperations - returns the inverse operations for a particular transform', async function(assert) {
    const recordA = {
      id: 'jupiter',
      type: 'planet',
      attributes: { name: 'Jupiter' }
    };

    const addRecordATransform = buildTransform(
      store.transformBuilder.addRecord(recordA)
    );

    await store.sync(addRecordATransform);

    assert.deepEqual(store.getInverseOperations(addRecordATransform.id), [
      { op: 'removeRecord', record: { id: 'jupiter', type: 'planet' } }
    ]);
  });

  test('#transformsSince - returns all transforms since a specified transformId', async function(assert) {
    const recordA = {
      id: 'jupiter',
      type: 'planet',
      attributes: { name: 'Jupiter' }
    };
    const recordB = {
      id: 'saturn',
      type: 'planet',
      attributes: { name: 'Saturn' }
    };
    const recordC = {
      id: 'pluto',
      type: 'planet',
      attributes: { name: 'Pluto' }
    };
    const tb = store.transformBuilder;

    const addRecordATransform = buildTransform(tb.addRecord(recordA));
    const addRecordBTransform = buildTransform(tb.addRecord(recordB));
    const addRecordCTransform = buildTransform(tb.addRecord(recordC));

    await store.sync(addRecordATransform);
    await store.sync(addRecordBTransform);
    await store.sync(addRecordCTransform);

    assert.deepEqual(
      store.transformsSince(addRecordATransform.id),
      [addRecordBTransform, addRecordCTransform],
      'returns transforms since the specified transform'
    );
  });

  test('#allTransforms - returns all tracked transforms', async function(assert) {
    const recordA = {
      id: 'jupiter',
      type: 'planet',
      attributes: { name: 'Jupiter' }
    };
    const recordB = {
      id: 'saturn',
      type: 'planet',
      attributes: { name: 'Saturn' }
    };
    const recordC = {
      id: 'pluto',
      type: 'planet',
      attributes: { name: 'Pluto' }
    };
    const tb = store.transformBuilder;

    const addRecordATransform = buildTransform(tb.addRecord(recordA));
    const addRecordBTransform = buildTransform(tb.addRecord(recordB));
    const addRecordCTransform = buildTransform(tb.addRecord(recordC));

    await store.sync(addRecordATransform);
    await store.sync(addRecordBTransform);
    await store.sync(addRecordCTransform);

    assert.deepEqual(
      store.allTransforms(),
      [addRecordATransform, addRecordBTransform, addRecordCTransform],
      'tracks transforms in correct order'
    );
  });

  test('replacing a record invalidates attributes and relationships', async function(assert) {
    const planet = await store.records<Planet>('planet').add({
      id: 'p1',
      name: 'Earth'
    });
    const star = await store.records<Star>('star').add({
      id: 's1',
      name: 'The Sun'
    });

    assert.equal(planet.name, 'Earth', 'initial attribute get is fine');
    assert.equal(planet.sun, null, 'initial hasOne get is fine');
    assert.equal(star.name, 'The Sun', 'star has been created properly');

    await store.update(t =>
      t.updateRecord({
        type: 'planet',
        id: planet.id,
        attributes: { name: 'Jupiter' },
        relationships: { sun: { data: { type: 'star', id: star.id } } }
      })
    );

    assert.strictEqual(planet.name, 'Jupiter', 'attribute has been reset');
    assert.strictEqual(planet.sun, star, 'hasOne has been reset');
  });

  test('#record()', async function(assert) {
    const earth = await store.records('planet').add({ name: 'Earth' });
    const record: Planet = await store.record(earth);
    assert.strictEqual(record, earth);
  });

  test('#records()', async function(assert) {
    const earth = await store.records<Planet>('planet').add({ name: 'Earth' });
    const jupiter = await store
      .records<Planet>('planet')
      .add({ name: 'Jupiter' });

    const records: Planet[] = await store.records('planet');

    assert.equal(records.length, 2);
    assert.ok(records.includes(earth));
    assert.ok(records.includes(jupiter));
  });

  test('#record().relatedRecord()', async function(assert) {
    const sun = await store.records('star').add({ name: 'The Sun' });
    const jupiter = await store.records<Planet>('planet').add({
      name: 'Jupiter',
      sun
    });
    const record = await jupiter.relatedRecord('sun');

    assert.strictEqual(record, sun);
  });

  test('#record().relatedRecords()', async function(assert) {
    const io = await store.records('moon').add({ name: 'Io' });
    const callisto = await store.records('moon').add({ name: 'Callisto' });
    const jupiter = await store.records('planet').add({
      name: 'Jupiter',
      moons: [io, callisto]
    });
    const records = await store
      .record<Planet>(jupiter)
      .peek()
      .relatedRecords('moons');

    assert.deepEqual(records, [io, callisto]);
    assert.strictEqual(records[0], io);
    assert.strictEqual(records[1], callisto);
  });

  test('#query - filter', async function(assert) {
    const earth = await store.records('planet').add({ name: 'Earth' });
    await store.records('planet').add({ name: 'Jupiter' });
    const records = await store
      .records('planet')
      .filter({ attribute: 'name', value: 'Earth' });

    assert.deepEqual(records, [earth]);
    assert.strictEqual(records[0], earth);
  });

  test('#records.live - adds record that becomes a match', async function(assert) {
    const jupiter = await store.records('planet').add({
      id: 'jupiter',
      attributes: { name: 'Jupiter2' }
    });

    const liveArray = await store
      .records<Planet>('planet')
      .filter({ attribute: 'name', value: 'Jupiter' })
      .live();

    assert.equal(liveArray.length, 0);

    await store.record(jupiter).update({ name: 'Jupiter' });

    await waitForLiveArray(liveArray);
    assert.equal(liveArray.length, 1);
  });

  test('#records.peek()', async function(assert) {
    let earth = await store.records<Planet>('planet').add({
      name: 'Earth'
    });
    let jupiter = await store.records<Planet>('planet').add({
      name: 'Jupiter'
    });

    let records: Planet[] = store.records<Planet>('planet').peek();
    assert.equal(records.length, 2);
    assert.ok(records.includes(earth));
    assert.ok(records.includes(jupiter));
  });

  test('#record.peek()', async function(assert) {
    const earth = await store.records<Planet>('planet').add({
      name: 'Earth'
    });
    await store.records<Planet>('planet').add({ name: 'Jupiter' });
    const record = store.record(earth).peek();

    assert.strictEqual(record, earth);
  });

  test('#record.peek() - missing record', function(assert) {
    try {
      store.record({ type: 'planet', id: 'jupiter' }).peek();
    } catch (e) {
      assert.equal(
        e.message,
        'Record not found: planet:jupiter',
        'query - error caught'
      );
    }
  });

  test('#fork - creates a clone of a base store', async function(assert) {
    const forkedStore = store.fork();
    const jupiter = await forkedStore.records('planet').add({
      name: 'Jupiter',
      classification: 'gas giant'
    });

    assert.notOk(
      store.cache.has({ type: 'planet', id: jupiter.id }),
      'store does not contain record'
    );
    assert.ok(
      forkedStore.cache.has({ type: 'planet', id: jupiter.id }),
      'fork includes record'
    );
  });

  test('#merge - merges a forked store back into a base store', async function(assert) {
    const forkedStore = store.fork();
    const jupiter = await forkedStore.records('planet').add({
      name: 'Jupiter',
      classification: 'gas giant'
    });
    await store.merge(forkedStore);

    assert.ok(
      store.cache.has({ type: 'planet', id: jupiter.id }),
      'store includes record'
    );
    assert.ok(
      forkedStore.cache.has({ type: 'planet', id: jupiter.id }),
      'fork includes record'
    );
  });

  test('#rebase - maintains only unique transforms in fork', async function(assert) {
    const recordA = {
      id: 'jupiter',
      type: 'planet',
      attributes: { name: 'Jupiter' }
    };
    const recordB = {
      id: 'saturn',
      type: 'planet',
      attributes: { name: 'Saturn' }
    };
    const recordC = {
      id: 'pluto',
      type: 'planet',
      attributes: { name: 'Pluto' }
    };
    const recordD = {
      id: 'neptune',
      type: 'planet',
      attributes: { name: 'Neptune' }
    };
    const recordE = {
      id: 'uranus',
      type: 'planet',
      attributes: { name: 'Uranus' }
    };

    const tb = store.transformBuilder;
    const addRecordA = buildTransform(tb.addRecord(recordA));
    const addRecordB = buildTransform(tb.addRecord(recordB));
    const addRecordC = buildTransform(tb.addRecord(recordC));
    const addRecordD = buildTransform(tb.addRecord(recordD));
    const addRecordE = buildTransform(tb.addRecord(recordE));

    let fork: Store;

    await store.update(addRecordA);
    await store.update(addRecordB);

    fork = store.fork();

    await fork.update(addRecordD);
    await store.update(addRecordC);
    await fork.update(addRecordE);

    fork.rebase();

    assert.deepEqual(fork.allTransforms(), [addRecordD, addRecordE]);

    assert.deepEqual(fork.records('planet').peek().length, 5);
    assert.ok(fork.cache.has(recordA));
    assert.ok(fork.cache.has(recordB));
    assert.ok(fork.cache.has(recordC));
    assert.ok(fork.cache.has(recordD));
    assert.ok(fork.cache.has(recordE));
  });

  module('Batch Query', function() {
    test('#records().merge()', async function(assert) {
      const jupiter = await store.records<Planet>('planet').add({
        name: 'Jupiter',
        classification: 'gas giant'
      });
      const mars = await store.records<Planet>('planet').add({
        name: 'Mars'
      });
      const callisto = await store
        .records<Moon>('moon')
        .add({ name: 'Callisto' });

      const planets = store.records<Planet>('planet').sort('name');
      const records = await store.records<Moon>('moon').merge<Planet>(planets);

      assert.deepEqual(records[0], [callisto]);
      assert.deepEqual(records[1], [jupiter, mars]);
    });
  });
});
