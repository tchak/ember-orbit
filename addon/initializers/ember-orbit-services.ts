import { getOwner, setOwner } from '@ember/application';

import StoreSource, { StoreSettings } from '../-private/store';

import Store from '../services/store';
import Schema from '../services/schema';
import Coordinator from '../services/coordinator';

const StoreFactory = {
  create(injections: StoreSettings = {}): StoreSource {
    injections.name = injections.name || 'store';

    const owner = getOwner(injections);
    const store = new StoreSource(injections);
    setOwner(store, owner);

    return store;
  }
};

export function initialize(application) {
  const {
    types: { source }
  } = application.resolveRegistration('ember-orbit:config') || {};

  application.register('service:store', Store);
  application.register('service:schema', Schema);
  application.register('service:coordinator', Coordinator);
  application.register(`${source}:store`, StoreFactory);

  application.inject('service:store', 'source', `${source}:store`);
  application.inject('service:schema', 'modelNames', 'ember-orbit:model-names');
  application.inject(
    'service:coordinator',
    'sourceNames',
    'ember-orbit:source-names'
  );
  application.inject(
    'service:coordinator',
    'strategyNames',
    'ember-orbit:strategy-names'
  );
  application.inject(source, 'schema', 'service:schema');
}

export default {
  name: 'ember-orbit-services',
  after: 'ember-orbit-config',
  initialize
};
