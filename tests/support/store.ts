import Ember from 'ember';

import { Store } from 'ember-orbit';
import { initialize as initializeConfig } from 'ember-orbit/initializers/ember-orbit-config';
import { initialize as initializeServices } from 'ember-orbit/initializers/ember-orbit-services';

import Owner from './owner';

export function createOwner() {
  const registry = new Ember.Registry();
  const owner = Owner.create({ __registry__: registry });
  const container = (registry as any).container({ owner });

  owner.__container__ = container;

  return owner;
}

export function createStore(options) {
  options = options || {};

  const { models } = options;
  const owner = options.owner || createOwner();
  initializeConfig(owner);
  initializeServices(owner);

  const orbitConfig = owner.lookup('ember-orbit:config');

  if (models) {
    const modelNames: string[] = Object.keys(models).map(type => {
      owner.register(`${orbitConfig.types.model}:${type}`, models[type]);
      return type;
    });

    owner.register('ember-orbit:model-names', modelNames, {
      instantiate: false
    });
  }

  return owner.lookup('service:store').service as Store;
}
