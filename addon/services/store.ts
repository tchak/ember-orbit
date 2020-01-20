import { getOwner } from '@ember/application';
import { StoreSettings } from '../-private/store';
import { ModelClass } from 'ember-orbit/-private/model';

export default {
  create(injections: StoreSettings = {}) {
    const owner = getOwner(injections);
    const {
      types: { source, model }
    } = owner.lookup('ember-orbit:config');

    const modelNames = owner.lookup('ember-orbit:model-names');
    const store = owner.lookup(`${source}:store`);

    for (let modelName of modelNames) {
      const klass = owner.factoryFor(`${model}:${modelName}`)
        .class as ModelClass;
      klass.modelName = modelName;
      klass.setSource(store);
    }

    return store;
  }
};
