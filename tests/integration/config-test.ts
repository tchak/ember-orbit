import { Planet, Moon, Star } from 'dummy/tests/support/dummy-models';
import { createOwner, createStore } from 'dummy/tests/support/store';
import { module, test } from 'qunit';
import Controller from '@ember/controller';
import Route from '@ember/routing/route';
import { Store } from 'ember-orbit';

module('Integration - Config', function(hooks) {
  let owner;
  let store: Store;

  hooks.beforeEach(function() {
    owner = createOwner();
    owner.register(
      'config:environment',
      {
        orbit: {
          types: {
            bucket: 'orbit-bucket',
            model: 'orbit-model',
            source: 'orbit-source',
            strategy: 'orbit-strategy'
          },
          collections: {
            buckets: 'orbit-buckets',
            models: 'orbit-models',
            sources: 'orbit-sources',
            strategies: 'orbit-strategies'
          }
        }
      },
      { instantiate: false }
    );
    const models = { planet: Planet, moon: Moon, star: Star };
    store = createStore({ models, owner });
    owner.register('controller:application', Controller);
    owner.register('route:application', Route);
  });

  hooks.afterEach(function() {
    store.destroy();
    owner = null;
  });

  test('registrations respect config', async function(assert) {
    assert.equal(
      owner.lookup('service:store'),
      store,
      'store service registration is named from configuration'
    );
    assert.ok(
      owner.resolveRegistration('orbit-model:planet'),
      'model factory registration is named from configuration'
    );
    assert.ok(
      owner.lookup('orbit-source:store'),
      'source registation is named from configuration'
    );
    assert.ok(
      owner.lookup('orbit-source:store').schema,
      'schema is injected successfully on sources'
    );
    assert.ok(
      owner.lookup('service:schema'),
      'unconfigured lookup type falls back to default configuration'
    );
  });
});
