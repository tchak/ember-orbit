import Store from '../-private/store';
import SchemaFactory from '../-private/factories/schema-factory';
import CoordinatorFactory from '../-private/factories/coordinator-factory';
import MemorySourceFactory from '../-private/factories/memory-source-factory';

export function initialize(application) {
  let orbitConfig = application.resolveRegistration('ember-orbit:config') || {};

  if (!orbitConfig.skipSchemaService) {
    // Register a schema service
    application.register(
      `service:${orbitConfig.services.schema}`,
      SchemaFactory
    );

    // Inject schema into all sources
    application.inject(
      orbitConfig.types.source,
      'schema',
      `service:${orbitConfig.services.schema}`
    );
  }

  if (!orbitConfig.skipCoordinatorService) {
    // Register a coordinator service
    application.register(
      `service:${orbitConfig.services.coordinator}`,
      CoordinatorFactory
    );
  }

  if (!orbitConfig.skipStoreService) {
    application.register(`service:${orbitConfig.services.store}`, Store);

    // Store source (which is injected in store service)
    application.register(
      `${orbitConfig.types.source}:store`,
      MemorySourceFactory
    );
    application.inject(
      `service:${orbitConfig.services.store}`,
      'source',
      `${orbitConfig.types.source}:store`
    );
  }
}

export default {
  name: 'ember-orbit-services',
  after: 'ember-orbit-config',
  initialize
};
