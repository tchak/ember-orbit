import { Planet, Moon, Star } from 'dummy/tests/support/dummy-models';
import { createStore } from 'dummy/tests/support/store';
import { buildTransform } from '@orbit/data';
import { module, test } from 'qunit';
import { Store } from 'ember-orbit';

module('Integration - Store', function(hooks) {
  let store: Store;
  const models = { planet: Planet, moon: Moon, star: Star };

  hooks.beforeEach(function() {
    store = createStore({ models });
  });

  hooks.afterEach(function() {
    store.destroy();
  });

  test('exposes properties from source', function(assert) {
    assert.strictEqual(store.schema, store.source.schema);
    assert.strictEqual(store.transformLog, store.source.transformLog);
    assert.strictEqual(store.requestQueue, store.source.requestQueue);
    assert.strictEqual(store.syncQueue, store.source.syncQueue);
  });

  test('#addRecord', async function(assert) {
    const planet = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Earth'
    });

    assert.ok(planet instanceof Planet);
    assert.ok(planet.id, 'assigned id');
    assert.equal(planet.name, 'Earth');
  });

  test('#addRecord - with blocking sync updates', async function(assert) {
    store.source.on('beforeUpdate', transform => {
      return store.source.sync(transform);
    });

    const planet = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Earth'
    });
    assert.ok(planet instanceof Planet);
    assert.ok(planet.id, 'assigned id');
    assert.equal(planet.name, 'Earth');
  });

  test('#findRecord', async function(assert) {
    const earth = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Earth'
    });
    const planet = await store.findRecord({ type: 'planet', id: earth.id });
    assert.strictEqual(planet, earth);
  });

  test('#findRecord - missing record', async function(assert) {
    try {
      await store.findRecord({ type: 'planet', id: 'jupiter' });
    } catch (e) {
      assert.equal(e.message, 'Record not found: planet:jupiter');
    }
  });

  test('#peekRecord - existing record', async function(assert) {
    const jupiter = await store.addRecord({ type: 'planet', name: 'Jupiter' });
    assert.strictEqual(
      store.peekRecord({ type: 'planet', id: jupiter.id }),
      jupiter,
      'retrieved record'
    );
  });

  test('#peekRecord - missing record', async function(assert) {
    assert.strictEqual(
      store.peekRecord({ type: 'planet', id: 'fake' }),
      undefined
    );
  });

  test('#peekRecords', async function(assert) {
    const earth = await store.addRecord({ type: 'planet', name: 'Earth' });
    const jupiter = await store.addRecord({ type: 'planet', name: 'Jupiter' });
    await store.addRecord({ type: 'moon', name: 'Io' });

    const planets = store.peekRecords('planet');
    assert.equal(planets.length, 2);
    assert.ok(planets.includes(earth));
    assert.ok(planets.includes(jupiter));
  });

  test('#removeRecord - when passed a record, it should serialize its identity in a `removeRecord` op', async function(assert) {
    assert.expect(2);

    const record = await store.addRecord({ type: 'planet', name: 'Earth' });

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

    await store.removeRecord(record);

    try {
      await store.findRecord({ type: 'planet', id: record.id });
    } catch (error) {
      assert.ok(error.message.match(/Record not found/));
    }
  });

  test('#removeRecord - when passed an identity', async function(assert) {
    assert.expect(2);

    const record = await store.addRecord({ type: 'planet', name: 'Earth' });

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

    await store.removeRecord({ type: 'planet', id: record.id });

    try {
      await store.findRecord({ type: 'planet', id: record.id });
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
    const planet = await store.addRecord<Planet>({
      type: 'planet',
      id: 'p1',
      name: 'Earth'
    });
    const star = await store.addRecord<Star>({
      type: 'star',
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

  test('#query - findRecord', async function(assert) {
    const earth = await store.addRecord({ type: 'planet', name: 'Earth' });
    const record = await store.query(q => q.findRecord(earth));
    assert.strictEqual(record, earth);
  });

  test('#query - findRecords', async function(assert) {
    const earth = await store.addRecord({ type: 'planet', name: 'Earth' });
    const jupiter = await store.addRecord({ type: 'planet', name: 'Jupiter' });
    const records = await store.query(q => q.findRecords('planet'));

    assert.equal(records.length, 2);
    assert.ok(records.includes(earth));
    assert.ok(records.includes(jupiter));
  });

  test('#query - findRelatedRecord', async function(assert) {
    const sun = await store.addRecord({ type: 'star', name: 'The Sun' });
    const jupiter = await store.addRecord({
      type: 'planet',
      name: 'Jupiter',
      sun
    });
    const record = await store.query(q =>
      q.findRelatedRecord(jupiter.identity, 'sun')
    );
    assert.strictEqual(record, sun);
  });

  test('#query - findRelatedRecords', async function(assert) {
    const io = await store.addRecord({ type: 'moon', name: 'Io' });
    const callisto = await store.addRecord({ type: 'moon', name: 'Callisto' });
    const jupiter = await store.addRecord({
      type: 'planet',
      name: 'Jupiter',
      moons: [io, callisto]
    });
    const records = await store.query(q =>
      q.findRelatedRecords(jupiter.identity, 'moons')
    );

    assert.deepEqual(records, [io, callisto]);
    assert.strictEqual(records[0], io);
    assert.strictEqual(records[1], callisto);
  });

  test('#query - filter', async function(assert) {
    const earth = await store.addRecord({ type: 'planet', name: 'Earth' });
    await store.addRecord({ type: 'planet', name: 'Jupiter' });
    const records = await store.query(q =>
      q.findRecords('planet').filter({ attribute: 'name', value: 'Earth' })
    );

    assert.deepEqual(records, [earth]);
    assert.strictEqual(records[0], earth);
  });

  // test('liveQuery - adds record that becomes a match', async function(assert) {
  //   store.addRecord({
  //     id: 'jupiter',
  //     type: 'planet',
  //     attributes: { name: 'Jupiter2' }
  //   });

  //   let liveQuery = await store
  //     .findRecords('planet')
  //     .live()
  //     .filter({ attribute: 'name', value: 'Jupiter' });

  //   assert.equal(liveQuery.length, 0);

  //   await store.update(t =>
  //     t.replaceAttribute({ type: 'planet', id: 'jupiter' }, 'name', 'Jupiter')
  //   );
  //   assert.equal(liveQuery.length, 1);
  // });

  test('#findRecords().peek()', async function(assert) {
    let earth = await store.addRecord({ type: 'planet', name: 'Earth' });
    let jupiter = await store.addRecord({ type: 'planet', name: 'Jupiter' });

    let records = store.findRecords('planet').peek();
    assert.equal(records.length, 2);
    assert.ok(records.includes(earth));
    assert.ok(records.includes(jupiter));
  });

  test('#findRecord().peek()', async function(assert) {
    const earth = await store.addRecord({ type: 'planet', name: 'Earth' });
    await store.addRecord({ type: 'planet', name: 'Jupiter' });
    const record = store.findRecord({ type: 'planet', id: earth.id }).peek();

    assert.strictEqual(record, earth);
  });

  test('#findRecord().peek() - missing record', function(assert) {
    try {
      store.findRecord({ type: 'planet', id: 'jupiter' }).peek();
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
    const jupiter = await forkedStore.addRecord({
      type: 'planet',
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
    const jupiter = await forkedStore.addRecord({
      type: 'planet',
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

    assert.deepEqual(fork.cache.records('planet').length, 5);
    assert.ok(fork.cache.has(recordA));
    assert.ok(fork.cache.has(recordB));
    assert.ok(fork.cache.has(recordC));
    assert.ok(fork.cache.has(recordD));
    assert.ok(fork.cache.has(recordE));
  });
});