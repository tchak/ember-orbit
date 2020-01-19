import { getOwner } from '@ember/application';
import { singularize, pluralize } from 'ember-inflector';

import { Schema, SchemaSettings, ModelDefinition } from '@orbit/data';
import { camelize } from '@orbit/utils';

import modulesOfType from '../-private/utils/modules-of-type';

function getRegisteredModels(prefix, modelsCollection) {
  return modulesOfType(prefix, modelsCollection).map(camelize);
}

export interface SchemaInjections extends SchemaSettings {
  modelNames?: string[];
}

export default {
  create(injections: SchemaInjections = {}) {
    if (!injections.models) {
      const owner = getOwner(injections);
      const models: Record<string, ModelDefinition> = {};

      const { types, collections } = owner.lookup('ember-orbit:config');
      const modelNames =
        injections.modelNames ||
        getRegisteredModels(owner.base.modulePrefix, collections.models);

      for (let name of modelNames) {
        models[name] = owner.factoryFor(`${types.model}:${name}`).class.schema;
      }

      injections.models = models;
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
