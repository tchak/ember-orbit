import { deepMerge } from '@orbit/utils';
import { camelize } from '@orbit/utils';
import { Store } from 'ember-orbit';
import { EmberStoreConfig } from 'ember-orbit/store-config';

export function modulesOfType(prefix, type) {
  const regex = new RegExp('^' + prefix + '/' + type + '/?/');
  const moduleNames = Object.keys(self.requirejs._eak_seen);
  const found: string[] = [];

  for (let moduleName of moduleNames) {
    const matches = regex.exec(moduleName);
    if (matches && matches.length === 1) {
      // eslint-disable-next-line no-useless-escape
      let name = moduleName.match(/[^\/]+\/?$/);
      if (name && name[0]) {
        found.push(name[0]);
      }
    }
  }

  return found;
}

export const DEFAULT_ORBIT_CONFIG = {
  types: {
    bucket: 'data-bucket',
    model: 'data-model',
    source: 'data-source',
    strategy: 'data-strategy'
  },
  collections: {
    buckets: 'data-buckets',
    models: 'data-models',
    sources: 'data-sources',
    strategies: 'data-strategies'
  }
};

export function initialize(application) {
  const envConfig = application.resolveRegistration('config:environment') || {};
  const config = deepMerge({}, DEFAULT_ORBIT_CONFIG, envConfig.orbit || {});

  // Customize pluralization rules
  if (
    application.__registry__ &&
    application.__registry__.resolver &&
    application.__registry__.resolver.pluralizedTypes
  ) {
    application.__registry__.resolver.pluralizedTypes[config.types.bucket] =
      config.collections.buckets;
    application.__registry__.resolver.pluralizedTypes[config.types.model] =
      config.collections.models;
    application.__registry__.resolver.pluralizedTypes[config.types.source] =
      config.collections.sources;
    application.__registry__.resolver.pluralizedTypes[config.types.strategy] =
      config.collections.strategies;
  }

  application.register('ember-orbit:config', config, {
    instantiate: false
  });

  if (application.base) {
    const modelNames = modulesOfType(
      application.base.modulePrefix,
      config.collections.models
    ).map(camelize);

    application.register('ember-orbit:model-names', modelNames, {
      instantiate: false
    });

    const sourceNames = modulesOfType(
      application.base.modulePrefix,
      config.collections.sources
    ).concat(['store']);

    application.register('ember-orbit:source-names', sourceNames, {
      instantiate: false
    });

    const strategyNames = modulesOfType(
      application.base.modulePrefix,
      config.collections.strategies
    );

    application.register('ember-orbit:strategy-names', strategyNames, {
      instantiate: false
    });
  }

  Store.config(EmberStoreConfig);
}

export default {
  name: 'ember-orbit-config',
  initialize
};
