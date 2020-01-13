import { attr, hasOne, hasMany, Model } from 'ember-orbit';
import { module, test } from 'qunit';

module('Unit - Model', function(hooks) {
  let Planet: any, Moon: any, Star: any;

  hooks.beforeEach(function() {
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
  });

  hooks.afterEach(function() {
    Planet = null;
    Moon = null;
    Star = null;
  });

  test('it exists', function(assert) {
    assert.ok(Planet);
  });

  test('#attributes returns defined attributes', function(assert) {
    var attributes, keys;

    attributes = Planet.schema.attributes;
    keys = Object.keys(attributes);
    assert.equal(keys.length, 2);
    assert.equal(keys[0], 'name');
    assert.equal(keys[1], 'classification');
  });

  test('#relationships returns defined relationships', function(assert) {
    var relationships, keys;

    relationships = Planet.schema.relationships;
    keys = Object.keys(relationships);
    assert.equal(keys.length, 2);
    assert.equal(keys[0], 'sun');
    assert.equal(keys[1], 'moons');

    relationships = Moon.schema.relationships;
    keys = Object.keys(relationships);
    assert.equal(keys.length, 1);
    assert.equal(keys[0], 'planet');

    relationships = Star.schema.relationships;
    keys = Object.keys(relationships);
    assert.equal(keys.length, 1);
    assert.equal(keys[0], 'planets');
  });
});
