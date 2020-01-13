import { camelize } from '@ember/string';
import { getOwner } from '@ember/application';
import { Schema } from '@orbit/data';
import { singularize, pluralize } from 'ember-inflector';

import modulesOfType from '../system/modules-of-type';

function getRegisteredModels(prefix, modelsCollection) {
  return modulesOfType(prefix, modelsCollection).map(camelize);
}

export default {
  create(injections = {}) {
    if (!injections.models) {
      const app = getOwner(injections);
      const modelSchemas = {};

      const orbitConfig = app.lookup('ember-orbit:config');
      const modelNames =
        injections.modelNames ||
        getRegisteredModels(
          app.base.modulePrefix,
          orbitConfig.collections.models
        );

      for (let name of modelNames) {
        modelSchemas[name] = app.factoryFor(
          `${orbitConfig.types.model}:${name}`
        ).class.schema;
      }

      injections.models = modelSchemas;
    }

    if (!injections.pluralize) {
      injections.pluralize = pluralize;
    }

    if (!injections.singularize) {
      injections.singularize = singularize;
    }

    return new Schema(injections);
  }
};
