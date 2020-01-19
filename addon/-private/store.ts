import { getOwner, setOwner } from '@ember/application';

import { RecordIdentity } from '@orbit/data';
import MemorySource, { MemorySourceSettings } from '@orbit/memory';

import { setModelFactory, destroyIdentityMap } from './cache';
import Model from './model';
import ModelFactory from './model-factory';
import {
  FindRecordQueryOrTransformBuilder,
  FindRecordsQueryOrTransformBuilder
} from './query-or-transform-builders';

export interface StoreSettings extends MemorySourceSettings {}

export default class Store extends MemorySource {
  static create(injections: StoreSettings = {}): Store {
    injections.name = injections.name || 'store';
    const owner = getOwner(injections);
    const store = new this(injections);
    const modelFactory = new ModelFactory(store);

    setOwner(store, owner);
    setOwner(modelFactory, owner);
    setModelFactory(store.cache, modelFactory);

    return store;
  }

  destroy() {
    destroyIdentityMap(this.cache);
  }

  fork(settings: StoreSettings = {}): Store {
    const owner = getOwner(this);
    const schema = this.schema;
    const injections = owner.ownerInjection();

    Object.assign(injections, settings);
    injections.schema = schema;
    injections.cacheSettings = settings.cacheSettings || { schema };
    injections.keyMap = this.keyMap;
    injections.queryBuilder = this.queryBuilder;
    injections.transformBuilder = this.transformBuilder;
    injections.base = this;

    return Store.create(injections);
  }

  record<T extends Model = Model>(
    identifier: RecordIdentity,
    options?: object
  ): FindRecordQueryOrTransformBuilder<T> {
    return new FindRecordQueryOrTransformBuilder<T>(this, identifier, options);
  }

  records<T extends Model = Model>(
    typeOrIdentifiers: string | RecordIdentity[],
    options?: object
  ): FindRecordsQueryOrTransformBuilder<T> {
    return new FindRecordsQueryOrTransformBuilder<T>(
      this,
      typeOrIdentifiers,
      options
    );
  }

  has(identifier: RecordIdentity): boolean {
    return !!this.cache.getRecordSync(identifier);
  }
}
