import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import { Planet } from 'dummy/tests/support/dummy-models';
import { createStore } from 'dummy/tests/support/store';
import { waitForSource } from 'ember-orbit/test-support';
import { Store } from 'ember-orbit';

module('waitForSource helper', function(hooks) {
  let store: Store;

  setupTest(hooks);

  hooks.beforeEach(function() {
    store = createStore({ models: { planet: Planet } });
  });

  hooks.afterEach(function() {
    store.destroy();
  });

  test('it resolves once all the pending requests to the given source have synced', async function(assert) {
    const backup = createStore({ models: { planet: Planet } });

    store.on('update', transform => {
      backup.update(transform);
    });

    await store.records('planet').add({ name: 'Earth' });

    await waitForSource(backup);

    assert.ok(backup.source.requestQueue.empty);
    assert.ok(backup.source.syncQueue.empty);
  });

  test('it looks up data sources by name if a string is provided', async function(assert) {
    const backup = createStore({ models: { planet: Planet } });

    this.owner.register('data-source:backup', backup, { instantiate: false });

    store.on('update', transform => {
      backup.update(transform);
    });

    await store.records('planet').add({ name: 'Earth' });

    await waitForSource('backup');

    assert.ok(backup.source.requestQueue.empty);
    assert.ok(backup.source.syncQueue.empty);
  });
});
