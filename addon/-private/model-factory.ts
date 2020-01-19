import { getOwner } from '@ember/application';

import { RecordIdentity, cloneRecordIdentity } from '@orbit/data';

import { QueryableAndTransfomableSource } from './cache';
import { ModelIdentity } from './identity-map';

export default class ModelFactory<T extends ModelIdentity> {
  private source: QueryableAndTransfomableSource;
  private modelFactoryMap: Record<string, any>;

  constructor(source: QueryableAndTransfomableSource) {
    this.source = source;
    this.modelFactoryMap = new Map();
  }

  create(identifier: RecordIdentity): T {
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
