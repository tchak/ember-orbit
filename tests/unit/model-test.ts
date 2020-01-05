import { key, attr, hasOne, hasMany, Model } from 'ember-orbit';
import { module, test } from 'qunit';
import { gte } from 'ember-compatibility-helpers';

module('Unit - Model', function(hooks) {
  let Planet: any, Moon: any, Star: any;

  hooks.beforeEach(function() {
    if (gte('3.15.0')) {
      class PlanetClass extends Model {
        @attr('string') name;
        @attr('string') classification;
        @hasOne('star') sun;
        @hasMany('moon') moons;
      }

      class MoonClass extends Model {
        @attr('string') name;
        @hasOne('planet') planet;
      }

      class StarClass extends Model {
        @attr('string') name;
        @hasMany('planet') planets;
      }

      Planet = PlanetClass;
      Moon = MoonClass;
      Star = StarClass;
    } else {
      Planet = Model.extend({
        name: attr('string'),
        classification: attr('string'),
        sun: hasOne('star'),
        moons: hasMany('moon')
      });
      Moon = Model.extend({
        name: attr('string'),
        planet: hasOne('planet')
      });
      Star = Model.extend({
        name: attr('string'),
        planets: hasMany('planet')
      });
    }
  });

  hooks.afterEach(function() {
    Planet = null;
    Moon = null;
    Star = null;
  });

  test('it exists', function(assert) {
    assert.ok(Planet);
  });

  test('#keys returns no keys by default', function(assert) {
    var keys, names;

    keys = Planet.keys;
    names = Object.keys(keys);
    assert.equal(names.length, 0);
  });

  test('#keys returns defined custom secondary keys', function(assert) {
    var keys, names;

    if (gte('3.15.0')) {
      class PlanetClass extends Planet {
        @key() remoteId;
      }

      Planet = PlanetClass;
    } else {
      Planet.reopen({
        remoteId: key()
      });
    }

    keys = Planet.keys;
    names = Object.keys(keys);
    assert.equal(names.length, 1);
    assert.equal(names[0], 'remoteId');
  });

  test('#attributes returns defined attributes', function(assert) {
    var attributes, keys;

    attributes = Planet.attributes;
    keys = Object.keys(attributes);
    assert.equal(keys.length, 2);
    assert.equal(keys[0], 'name');
    assert.equal(keys[1], 'classification');
  });

  test('#relationships returns defined relationships', function(assert) {
    var relationships, keys;

    relationships = Planet.relationships;
    keys = Object.keys(relationships);
    assert.equal(keys.length, 2);
    assert.equal(keys[0], 'sun');
    assert.equal(keys[1], 'moons');

    relationships = Moon.relationships;
    keys = Object.keys(relationships);
    assert.equal(keys.length, 1);
    assert.equal(keys[0], 'planet');

    relationships = Star.relationships;
    keys = Object.keys(relationships);
    assert.equal(keys.length, 1);
    assert.equal(keys[0], 'planets');
  });
});
