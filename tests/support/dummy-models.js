import { Model, attr, key, hasMany, hasOne } from 'ember-orbit';

export class Planet extends Model {
  @key() remoteId;
  @attr('string') name;
  @attr('boolean') atmosphere;
  @attr('string') classification;
  @hasOne('star') sun;
  @hasMany('moon', { inverse: 'planet' }) moons;
}

export class Moon extends Model {
  @attr('string') name;
  @hasOne('planet', { inverse: 'moons' }) planet;
}

export class Star extends Model {
  @attr('string') name;
  @hasMany('planet') planets;
  @attr('boolean') isStable;
}
