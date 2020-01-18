import { getOwner } from '@ember/application';

import MemorySource from '@orbit/memory';
import { RecordIdentity, cloneRecordIdentity } from '@orbit/data';

import Model from './model';

export default class ModelFactory {
  private source: MemorySource;
  private modelFactoryMap: Record<string, any>;

  constructor(source: MemorySource) {
    this.source = source;
    this.modelFactoryMap = new Map();
  }

  create(identifier: RecordIdentity): Model {
    const modelFactory = this.modelFactoryFor(identifier.type);

    return modelFactory.create({
      identity: cloneRecordIdentity(identifier),
      source: this.source
    });
  }

  private modelFactoryFor(type: string) {
    let modelFactory = this.modelFactoryMap.get(type);

    if (!modelFactory) {
      const owner = getOwner(this);
      const { types } = owner.lookup('ember-orbit:config');
      modelFactory = owner.factoryFor(`${types.model}:${type}`);
      this.modelFactoryMap.set(type, modelFactory);
    }

    return modelFactory;
  }
}
