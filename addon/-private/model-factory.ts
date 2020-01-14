import { getOwner } from '@ember/application';

import { RecordIdentity, cloneRecordIdentity } from '@orbit/data';
import Store from './store';
import Model from './model';

export default class ModelFactory {
  private store: Store;
  private modelFactoryMap: Record<string, any>;

  constructor(store: Store) {
    this.store = store;
    this.modelFactoryMap = {};
  }

  create(identifier: RecordIdentity): Model {
    const modelFactory = this.modelFactoryFor(identifier.type);

    return modelFactory.create({
      identity: cloneRecordIdentity(identifier),
      store: this.store
    });
  }

  private modelFactoryFor(type: string) {
    let modelFactory = this.modelFactoryMap[type];

    if (!modelFactory) {
      const owner = getOwner(this.store);
      const orbitConfig = owner.lookup('ember-orbit:config');
      modelFactory = owner.factoryFor(`${orbitConfig.types.model}:${type}`);
      this.modelFactoryMap[type] = modelFactory;
    }

    return modelFactory;
  }
}
