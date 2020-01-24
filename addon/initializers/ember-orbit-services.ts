import { getOwner, setOwner } from '@ember/application';

import Store, { StoreSettings } from '../-private/store';
import StoreService from '../services/store';
import Schema from '../services/schema';
import Coordinator from '../services/coordinator';

export function initialize(application) {
  const {
    types: { source }
  } = application.resolveRegistration('ember-orbit:config') || {};

  application.register('service:store', StoreService);
  application.register('service:schema', Schema);
  application.register('service:coordinator', Coordinator);

  application.register(`${source}:store`, {
    create(injections: StoreSettings = {}): Store {
      injections.name = injections.name || 'store';

      const owner = getOwner(injections);
      const store = new Store(injections);
      setOwner(store, owner);

      return store;
    }
  });

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
