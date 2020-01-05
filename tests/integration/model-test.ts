import EmberObject from '@ember/object';
import { Planet, Moon, Star } from 'dummy/tests/support/dummy-models';
import { createStore } from 'dummy/tests/support/store';
import { module, test } from 'qunit';
import { getOwner } from '@ember/application';
import { waitForSource } from 'ember-orbit/test-support';
import { Store } from 'ember-orbit';

module('Integration - Model', function(hooks) {
  let store: Store;

  hooks.beforeEach(function() {
    const models = { planet: Planet, moon: Moon, star: Star };
    store = createStore({ models });
  });

  hooks.afterEach(function() {
    store.destroy();
  });

  test('models are assigned the same owner as the store', async function(assert) {
    const model = await store.addRecord({ type: 'star', name: 'The Sun' });
    assert.ok(getOwner(model), 'model has an owner');
    assert.strictEqual(
      getOwner(model),
      getOwner(store),
      'model has same owner as store'
    );
  });

  test('models can receive registered injections', async function(assert) {
    const Foo = EmberObject.extend({
      bar: 'bar'
    });

    const app = getOwner(store);
    app.register('service:foo', Foo);
    app.inject('data-model:star', 'foo', 'service:foo');

    const model: any = await store.addRecord<Star>({
      type: 'star',
      name: 'The Sun'
    });
    assert.ok(model.foo, 'service has been injected');
    assert.equal(model.foo.bar, 'bar', 'service is correct');
  });

  test('models can be added to the store', async function(assert) {
    const theSun = await store.addRecord<Star>({
      type: 'star',
      name: 'The Sun'
    });
    const callisto = await store.addRecord<Moon>({
      type: 'moon',
      name: 'Callisto'
    });
    const record = await store.addRecord<Planet>({
      type: 'planet',
      remoteId: 'planet:jupiter',
      name: 'Jupiter',
      sun: theSun,
      moons: [callisto]
    });

    assert.ok(record.id, 'assigned id');
    assert.deepEqual(
      record.identity,
      { id: record.id, type: 'planet' },
      'assigned identity that includes type and id'
    );
    assert.equal(record.name, 'Jupiter', 'assigned specified attribute');
    assert.strictEqual(record.sun, theSun, 'assigned hasOne');
    assert.strictEqual([...record.moons][0], callisto, 'assigned hasMany');
  });

  test('models can be removed', async function(assert) {
    const cache = store.cache;
    const record = await store.addRecord<Star>({
      type: 'star',
      name: 'The Sun'
    });
    await record.remove();

    assert.notOk(
      cache.has({ type: 'star', id: record.id }),
      'record does not exist in cache'
    );
    assert.ok(record.disconnected, 'record has been disconnected from store');
    assert.throws(
      () => record.name,
      Error,
      'record has been removed from Store'
    );
  });

  test('remove model with relationships', async function(assert) {
    const callisto = await store.addRecord<Planet>({
      type: 'moon',
      name: 'Callisto'
    });
    const sun = await store.addRecord<Star>({ type: 'star', name: 'Sun' });
    const jupiter = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter',
      moons: [callisto],
      sun
    });
    assert.deepEqual(
      [...jupiter.moons],
      [callisto],
      'moons relationship has been added'
    );
    assert.strictEqual(jupiter.sun, sun, 'sun relationship has been added');

    await jupiter.remove();
  });

  test('add to hasMany', async function(assert) {
    const jupiter = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter'
    });
    const callisto = await store.addRecord<Moon>({
      type: 'moon',
      name: 'Callisto'
    });

    await jupiter.moons.pushObject(callisto);

    assert.ok(jupiter.moons.includes(callisto), 'added record to hasMany');
    assert.equal(callisto.planet, jupiter, 'updated inverse');
  });

  test('remove from hasMany', async function(assert) {
    const jupiter = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter'
    });
    const callisto = await store.addRecord<Moon>({
      type: 'moon',
      name: 'Callisto'
    });

    await jupiter.moons.pushObject(callisto);
    await jupiter.moons.removeObject(callisto);

    assert.ok(!jupiter.moons.includes(callisto), 'removed record from hasMany');
    assert.ok(!callisto.planet, 'updated inverse');
  });

  test('update via store: replaceRelatedRecords operation invalidates a relationship on model', async function(assert) {
    const jupiter = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter'
    });
    const callisto = await store.addRecord<Moon>({
      type: 'moon',
      name: 'Callisto'
    });

    assert.deepEqual([...jupiter.moons], []); // cache the relationship
    await store.source.update(t =>
      t.replaceRelatedRecords(jupiter, 'moons', [callisto])
    );
    assert.deepEqual(
      [...jupiter.moons],
      [callisto],
      'invalidates the relationship'
    );
  });

  test('replace hasOne with record', async function(assert) {
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

    assert.equal(callisto.planet, jupiter, 'replaced hasOne with record');
    assert.ok(jupiter.moons.includes(callisto), 'updated inverse');
  });

  test('update via store: replaceRelatedRecord operation invalidates a relationship on model', async function(assert) {
    const jupiter = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter'
    });
    const sun = await store.addRecord<Star>({ type: 'star', name: 'Sun' });

    assert.equal(jupiter.sun, null); // cache the relationship
    await store.source.update(t => t.replaceRelatedRecord(jupiter, 'sun', sun));
    assert.equal(jupiter.sun, sun, 'invalidates the relationship');
  });

  test('replace hasOne with null', async function(assert) {
    const jupiter = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter'
    });
    const callisto = await store.addRecord<Moon>({
      type: 'moon',
      name: 'Callisto'
    });

    assert.equal(callisto.planet, null, 'hasOne is null');

    callisto.planet = jupiter;

    await waitForSource(store);

    assert.equal(callisto.planet, jupiter, 'hasOne is jupiter');

    callisto.planet = null;

    await waitForSource(store);

    assert.equal(callisto.planet, null, 'replaced hasOne with null');
    assert.ok(
      !jupiter.moons.includes(callisto),
      'removed from inverse hasMany'
    );
  });

  test('replace attribute on model', async function(assert) {
    const record = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter'
    });

    record.name = 'Jupiter2';

    assert.equal(record.name, 'Jupiter2');
  });

  test('update via store: replaceAttribute operation invalidates attribute on model', async function(assert) {
    const record = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter'
    });
    assert.equal(record.name, 'Jupiter'); // cache the name
    await store.update(t => t.replaceAttribute(record, 'name', 'Jupiter2'));
    assert.equal(record.name, 'Jupiter2');
  });

  test('#getAttribute', async function(assert) {
    const record = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter'
    });
    assert.equal(record.getAttribute('name'), 'Jupiter');
  });

  test('#replaceAttribute', async function(assert) {
    const record = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter'
    });
    await record.replaceAttribute('name', 'Jupiter2');
    assert.equal(record.getAttribute('name'), 'Jupiter2');
  });

  test('destroy model', async function(assert) {
    const cache = store.cache;

    const record = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter'
    });
    const identifier = record.identity;
    record.destroy();

    await waitForSource(store);

    assert.ok(!cache.identityMap.has(identifier), 'removed from identity map');
  });

  test('#getRelatedRecord / #replaceRelatedRecord', async function(assert) {
    const jupiter = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter'
    });
    const sun = await store.addRecord<Star>({ type: 'star', name: 'Sun' });

    assert.strictEqual(jupiter.sun, undefined);
    assert.strictEqual(jupiter.getRelatedRecord('sun'), undefined);

    await jupiter.replaceRelatedRecord('sun', sun);

    assert.strictEqual(jupiter.sun, sun);
    assert.strictEqual(jupiter.getRelatedRecord('sun'), sun);

    await jupiter.replaceRelatedRecord('sun', null);
    assert.strictEqual(jupiter.sun, null);
    assert.strictEqual(jupiter.getRelatedRecord('sun'), null);
  });

  test('#getRelatedRecords always returns the same LiveQuery', async function(assert) {
    const callisto = await store.addRecord<Moon>({
      type: 'moon',
      name: 'Callisto'
    });
    const sun = await store.addRecord<Star>({ type: 'star', name: 'Sun' });
    const jupiter = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter',
      moons: [callisto],
      sun
    });
    assert.deepEqual(
      [...jupiter.moons],
      [callisto],
      'moons relationship has been added'
    );
    assert.strictEqual(
      jupiter.moons,
      jupiter.getRelatedRecords('moons'),
      'getRelatedRecords returns the expected LiveQuery'
    );
    assert.strictEqual(
      jupiter.getRelatedRecords('moons'),
      jupiter.getRelatedRecords('moons'),
      'getRelatedRecords does not create additional LiveQueries'
    );
  });

  // test('#addToRelatedRecords', async function(assert) {
  //   const jupiter = await store.addRecord<Planet>({
  //     type: 'planet',
  //     name: 'Jupiter'
  //   });
  //   const europa = await store.addRecord<Moon>({
  //     type: 'moon',
  //     name: 'Europa'
  //   });
  //   const io = await store.addRecord<Moon>({ type: 'moon', name: 'Io' });

  //   assert.deepEqual(jupiter.getRelatedRecords('moons'), undefined);

  //   await jupiter.addToRelatedRecords('moons', europa);

  //   assert.deepEqual(jupiter.getRelatedRecords('moons'), [europa]);

  //   await jupiter.addToRelatedRecords('moons', io);

  //   assert.deepEqual(jupiter.getRelatedRecords('moons'), [europa, io]);
  // });

  // test('#removeFromRelatedRecords', async function(assert) {
  //   const europa = await store.addRecord<Moon>({
  //     type: 'moon',
  //     name: 'Europa'
  //   });
  //   const io = await store.addRecord<Moon>({ type: 'moon', name: 'Io' });
  //   const jupiter = await store.addRecord<Planet>({
  //     type: 'planet',
  //     name: 'Jupiter',
  //     moons: [europa, io]
  //   });

  //   assert.deepEqual(jupiter.getRelatedRecords('moons').content, [europa, io]);

  //   await jupiter.removeFromRelatedRecords('moons', europa);

  //   assert.deepEqual(jupiter.getRelatedRecords('moons').content, [io]);

  //   await jupiter.removeFromRelatedRecords('moons', io);

  //   assert.deepEqual(jupiter.getRelatedRecords('moons').content, []);
  // });

  test('#update - updates attribute and relationships (with records)', async function(assert) {
    const jupiter = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter'
    });
    const sun = await store.addRecord<Star>({ type: 'star', name: 'Sun' });
    const callisto = await store.addRecord<Moon>({
      type: 'moon',
      name: 'Callisto'
    });

    assert.equal(jupiter.name, 'Jupiter');
    assert.equal(jupiter.sun, null);
    assert.deepEqual([...jupiter.moons], []);

    await jupiter.update({
      name: 'Jupiter2',
      sun,
      moons: [callisto]
    });

    assert.equal(jupiter.name, 'Jupiter2');
    assert.equal(jupiter.sun, sun, 'invalidates has one relationship');
    assert.deepEqual(
      [...jupiter.moons],
      [callisto],
      'invalidates has many relationship'
    );
  });

  test('#update - updates relationships (with IDs)', async function(assert) {
    const jupiter = await store.addRecord<Planet>({
      type: 'planet',
      name: 'Jupiter'
    });
    const sun = await store.addRecord<Star>({ type: 'star', name: 'Sun' });
    const callisto = await store.addRecord<Moon>({
      type: 'moon',
      name: 'Callisto'
    });

    assert.equal(jupiter.sun, null);
    assert.deepEqual([...jupiter.moons], []);

    await jupiter.update({
      sun: sun.id,
      moons: [callisto.id]
    });

    assert.equal(jupiter.sun, sun, 'invalidates has one relationship');
    assert.deepEqual(
      [...jupiter.moons],
      [callisto],
      'invalidates has many relationship'
    );
  });
});