import { Model, attr, key, hasMany, hasOne } from 'ember-orbit';
import { gte } from 'ember-compatibility-helpers';

let Planet, Moon, Star;

if (gte('3.15.0')) {
  Planet = class PlanetClass extends Model {
    @key() remoteId;
    @attr('string') name;
    @attr('boolean') atmosphere;
    @attr('string') classification;
    @hasOne('star') sun;
    @hasMany('moon', { inverse: 'planet' }) moons;
  };

  Moon = class MoonClass extends Model {
    @attr('string') name;
    @hasOne('planet', { inverse: 'moons' }) planet;
  };

  Star = class StarClass extends Model {
    @attr('string') name;
    @hasMany('planet') planets;
    @attr('boolean') isStable;
  };
} else {
  Planet = Model.extend({
    remoteId: key(),
    name: attr('string'),
    atmosphere: attr('boolean'),
    classification: attr('string'),
    sun: hasOne('star'),
    moons: hasMany('moon', { inverse: 'planet' })
  });

  Moon = Model.extend({
    name: attr('string'),
    planet: hasOne('planet', { inverse: 'moons' })
  });

  Star = Model.extend({
    name: attr('string'),
    planets: hasMany('planet'),
    isStable: attr('boolean')
  });
}

export { Planet, Moon, Star };
