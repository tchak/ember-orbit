import { Planet, Moon, Star } from 'dummy/tests/support/dummy-models';
import { createStore } from 'dummy/tests/support/store';
import { module, test } from 'qunit';

import normalizeRecordProperties from 'ember-orbit/-private/utils/normalize-record-properties';
import { Store } from 'ember-orbit';

module('Integration - normalizeRecordProperties', function(hooks) {
  let store: Store;
  const models = { planet: Planet, moon: Moon, star: Star };

  hooks.beforeEach(function() {
    store = createStore({ models });
  });

  hooks.afterEach(function() {
    store.destroy();
  });

  test('#normalizeRecordProperties', async function(assert) {
    const callisto = await store.records('moon').add({
      id: 'callisto',
      name: 'Callisto'
    });
    const sun = await store.records('star').add({
      id: 'sun',
      name: 'The Sun'
    });
    const normalized = normalizeRecordProperties(store.source.schema, {
      type: 'planet',
      id: 'jupiter',
      name: 'Jupiter',
      moons: [callisto],
      sun: sun
    });

    assert.equal(normalized.id, 'jupiter', 'normalized id');
    assert.equal(normalized.type, 'planet', 'normalized type');
    assert.deepEqual(normalized.attributes, { name: 'Jupiter' });
    assert.deepEqual(
      normalized.relationships?.moons,
      { data: [{ type: 'moon', id: 'callisto' }] },
      'normalized hasMany'
    );
    assert.deepEqual(
      normalized.relationships?.sun,
      { data: { type: 'star', id: 'sun' } },
      'normalized hasOne'
    );
  });

  test('#normalizeRecordProperties - undefined relationships', function(assert) {
    const normalized = normalizeRecordProperties(store.source.schema, {
      type: 'planet',
      id: 'jupiter',
      name: 'Jupiter'
    });

    assert.strictEqual(
      normalized.relationships,
      undefined,
      'normalized hasMany'
    );
  });

  test('#normalizeRecordProperties - nullable relationships', function(assert) {
    const normalized = normalizeRecordProperties(store.source.schema, {
      type: 'planet',
      id: 'jupiter',
      name: 'Jupiter',
      sun: null
    });

    assert.deepEqual(
      normalized.relationships?.sun,
      { data: null },
      'normalized nullable hasOne'
    );
  });
});
