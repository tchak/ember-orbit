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
    const model = await store.records('star').add({ name: 'The Sun' });
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

    const model: any = await store.records<Star>('star').add({
      name: 'The Sun'
    });
    assert.ok(model.foo, 'service has been injected');
    assert.equal(model.foo.bar, 'bar', 'service is correct');
  });

  test('models can be added to the store', async function(assert) {
    const theSun = await store.records<Star>('star').add({
      name: 'The Sun'
    });
    const callisto = await store.records<Moon>('moon').add({
      name: 'Callisto'
    });
    const record = await store.records<Planet>('planet').add({
      remoteId: 'planet:jupiter',
      name: 'Jupiter',
      sun: theSun,
      moons: [callisto]
    });

    assert.ok(record.id, 'assigned id');
    assert.deepEqual(
      record.$identity,
      { id: record.id, type: 'planet' },
      'assigned identity that includes type and id'
    );
    assert.equal(record.name, 'Jupiter', 'assigned specified attribute');
    assert.strictEqual(record.sun, theSun, 'assigned hasOne');
    assert.strictEqual([...record.moons][0], callisto, 'assigned hasMany');
  });

  test('models can be removed', async function(assert) {
    const record = await store.records<Star>('star').add({
      name: 'The Sun'
    });
    await record.remove();

    assert.notOk(
      store.has({ type: 'star', id: record.id }),
      'record does not exist in cache'
    );
    assert.ok(!record.$connected, 'record has been disconnected from store');
    assert.throws(
      () => record.name,
      Error,
      'record has been removed from Store'
    );
  });

  test('remove model with relationships', async function(assert) {
    const callisto = await store.records<Moon>('moon').add({
      name: 'Callisto'
    });
    const sun = await store.records<Star>('star').add({ name: 'Sun' });
    const jupiter = await store.records<Planet>('planet').add({
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
    const jupiter = await store.records<Planet>('planet').add({
      name: 'Jupiter'
    });
    const callisto = await store.records<Moon>('moon').add({
      name: 'Callisto'
    });

    await jupiter.relatedRecords('moons').add(callisto);

    assert.ok(jupiter.moons.includes(callisto), 'added record to hasMany');
    assert.equal(callisto.planet, jupiter, 'updated inverse');
  });

  test('remove from hasMany', async function(assert) {
    const jupiter = await store.records<Planet>('planet').add({
      name: 'Jupiter'
    });
    const callisto = await store.records<Moon>('moon').add({
      name: 'Callisto'
    });

    await jupiter.relatedRecords('moons').add(callisto);
    await jupiter.relatedRecords('moons').remove(callisto);

    assert.ok(!jupiter.moons.includes(callisto), 'removed record from hasMany');
    assert.ok(!callisto.planet, 'updated inverse');
  });

  test('update via store: replaceRelatedRecords operation invalidates a relationship on model', async function(assert) {
    const jupiter = await store.records<Planet>('planet').add({
      name: 'Jupiter'
    });
    const callisto = await store.records<Moon>('moon').add({
      name: 'Callisto'
    });

    assert.deepEqual([...jupiter.moons], []); // cache the relationship
    await store.update(t =>
      t.replaceRelatedRecords(jupiter, 'moons', [callisto])
    );
    assert.deepEqual(
      [...jupiter.moons],
      [callisto],
      'invalidates the relationship'
    );
  });

  test('replace hasOne with record', async function(assert) {
    const jupiter = await store.records<Planet>('planet').add({
      name: 'Jupiter'
    });
    const callisto = await store.records<Moon>('moon').add({
      name: 'Callisto'
    });

    callisto.planet = jupiter;

    await waitForSource(store);

    assert.equal(callisto.planet, jupiter, 'replaced hasOne with record');
    assert.ok(jupiter.moons.includes(callisto), 'updated inverse');
  });

  test('update via store: replaceRelatedRecord operation invalidates a relationship on model', async function(assert) {
    const jupiter = await store.records<Planet>('planet').add({
      name: 'Jupiter'
    });
    const sun = await store.records<Star>('star').add({ name: 'Sun' });

    assert.equal(jupiter.sun, null); // cache the relationship
    await store.update(t => t.replaceRelatedRecord(jupiter, 'sun', sun));
    assert.equal(jupiter.sun, sun, 'invalidates the relationship');
  });

  test('replace hasOne with null', async function(assert) {
    const jupiter = await store.records<Planet>('planet').add({
      name: 'Jupiter'
    });
    const callisto = await store.records<Moon>('moon').add({
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
    const record = await store.records<Planet>('planet').add({
      name: 'Jupiter'
    });

    record.name = 'Jupiter2';

    assert.equal(record.name, 'Jupiter2');
  });

  test('update via store: replaceAttribute operation invalidates attribute on model', async function(assert) {
    const record = await store.records<Planet>('planet').add({
      name: 'Jupiter'
    });
    assert.equal(record.name, 'Jupiter'); // cache the name
    await store.update(t => t.replaceAttribute(record, 'name', 'Jupiter2'));
    assert.equal(record.name, 'Jupiter2');
  });

  test('#getAttribute', async function(assert) {
    const record = await store.records<Planet>('planet').add({
      name: 'Jupiter'
    });
    assert.equal(record.$getAttribute<string>('name'), 'Jupiter');
  });

  test('destroy model', async function(assert) {
    const record = await store.records<Planet>('planet').add({
      name: 'Jupiter'
    });
    const identifier = record.$identity;
    record.unload();

    await waitForSource(store);

    assert.ok(!store.has(identifier), 'removed from identity map');
  });

  test('#relatedRecord', async function(assert) {
    const jupiter = await store.records<Planet>('planet').add({
      name: 'Jupiter'
    });
    const sun = await store.records<Star>('star').add({ name: 'Sun' });

    assert.strictEqual(jupiter.sun, null);
    assert.strictEqual(jupiter.$getRelatedRecord('sun'), undefined);

    await jupiter.relatedRecord('sun').replace(sun);

    assert.strictEqual(jupiter.sun, sun);
    assert.strictEqual(jupiter.$getRelatedRecord('sun'), sun);
    assert.strictEqual(await jupiter.relatedRecord('sun'), sun);

    await jupiter.relatedRecord('sun').replace(null);
    assert.strictEqual(jupiter.sun, null);
    assert.strictEqual(jupiter.$getRelatedRecord('sun'), null);
  });

  test('#relatedRecords always returns the same relationship', async function(assert) {
    const callisto = await store.records<Moon>('moon').add({
      name: 'Callisto'
    });
    const sun = await store.records<Star>('star').add({ name: 'Sun' });
    const jupiter = await store.records<Planet>('planet').add({
      name: 'Jupiter',
      moons: [callisto],
      sun
    });
    assert.deepEqual(
      [...jupiter.moons],
      [callisto],
      'moons relationship has been added'
    );
    assert.deepEqual(
      jupiter.moons,
      jupiter.relatedRecords('moons').peek(),
      'hasMany().value returns the expected array'
    );
    assert.deepEqual(
      jupiter.moons,
      await jupiter.relatedRecords('moons'),
      'hasMany().query() returns the expected array'
    );
    assert.strictEqual(
      jupiter.moons,
      jupiter.moons,
      'hasMany attribute does not create additional arrays'
    );
  });

  test('#relatedRecords.add()', async function(assert) {
    const jupiter = await store
      .records<Planet>('planet')
      .add({ name: 'Jupiter' });
    const europa = await store.records('moon').add({ name: 'Europa' });
    const io = await store.records('moon').add({ name: 'Io' });

    assert.deepEqual(jupiter.$getRelatedRecords('moons'), undefined);
    assert.deepEqual(jupiter.moons, []);

    await jupiter.relatedRecords('moons').add(europa);

    assert.deepEqual(jupiter.$getRelatedRecords('moons'), [europa]);
    assert.deepEqual(jupiter.moons, [europa]);

    await jupiter.relatedRecords('moons').add(io);

    assert.deepEqual(jupiter.relatedRecords('moons').peek(), [europa, io]);
  });

  test('#relatedRecords.remove()', async function(assert) {
    const europa = await store.records('moon').add({ name: 'Europa' });
    const io = await store.records('moon').add({ name: 'Io' });
    const jupiter = await store.records('planet').add({
      name: 'Jupiter',
      moons: [europa, io]
    });

    assert.deepEqual(jupiter.$getRelatedRecords('moons'), [europa, io]);

    await jupiter.relatedRecords('moons').remove(europa);

    assert.deepEqual(jupiter.$getRelatedRecords('moons'), [io]);

    await jupiter.relatedRecords('moons').remove(io);

    assert.deepEqual(jupiter.relatedRecords('moons').peek(), []);
  });

  test('#update - updates attribute and relationships (with records)', async function(assert) {
    const jupiter = await store.records<Planet>('planet').add({
      name: 'Jupiter'
    });
    const sun = await store.records<Star>('star').add({ name: 'Sun' });
    const callisto = await store.records<Moon>('moon').add({
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
    const jupiter = await store.records<Planet>('planet').add({
      name: 'Jupiter'
    });
    const sun = await store.records<Star>('star').add({ name: 'Sun' });
    const callisto = await store.records<Moon>('moon').add({
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

  module('Model#fork', function() {
    test('fork + save', async function(assert) {
      const jupiter = await store.records<Planet>('planet').add({
        name: 'Jupiter'
      });

      const jupiterBis = jupiter.fork();

      jupiterBis.name = 'Jupiter Bis';

      assert.notEqual(jupiter.$source, jupiterBis.$source);
      assert.equal(
        jupiter.$source,
        jupiterBis.$source.base,
        'record should be forked'
      );
      assert.notEqual(jupiter, jupiterBis);
      assert.equal(jupiter.name, 'Jupiter');
      assert.equal(jupiterBis.name, 'Jupiter Bis');

      const jupiterOrig = await jupiterBis.save();

      assert.equal(jupiter.name, 'Jupiter Bis');
      assert.equal(jupiterOrig.name, 'Jupiter Bis');
      assert.equal(jupiter, jupiterOrig);

      assert.notOk(jupiterBis.$connected, 'forked record should be discarded');
    });
  });
});
