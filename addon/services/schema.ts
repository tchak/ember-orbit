import { getOwner } from '@ember/application';
import { singularize, pluralize } from 'ember-inflector';
import { Schema, SchemaSettings, ModelDefinition } from '@orbit/data';

export interface SchemaInjections extends SchemaSettings {
  modelNames?: string[];
}

export default {
  create(injections: SchemaInjections = {}) {
    if (!injections.models) {
      const owner = getOwner(injections);
      const models: Record<string, ModelDefinition> = {};
      const { types } = owner.lookup('ember-orbit:config');
      const modelNames = injections.modelNames || [];

      for (let modelName of modelNames) {
        models[modelName] = owner.factoryFor(
          `${types.model}:${modelName}`
        ).class.schema;
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
