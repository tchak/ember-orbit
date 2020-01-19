import StoreSource from '../-private/store';
import Store from '../services/store';
import Schema from '../services/schema';
import Coordinator from '../services/coordinator';

export function initialize(application) {
  const {
    types: { source }
  } = application.resolveRegistration('ember-orbit:config') || {};

  application.register('service:store', Store);
  application.register('service:schema', Schema);
  application.register('service:coordinator', Coordinator);
  application.register(`${source}:store`, StoreSource);

  application.inject(source, 'schema', 'service:schema');
}

export default {
  name: 'ember-orbit-services',
  after: 'ember-orbit-config',
  initialize
};
