import { getOwner, setOwner } from '@ember/application';

import { RecordIdentity } from '@orbit/data';
import MemorySource, { MemorySourceSettings } from '@orbit/memory';

import { IdentityMap, ModelIdentity } from './identity-map';
import Model from './model';
import {
  FindRecordQueryOrTransformBuilder,
  FindRecordsQueryOrTransformBuilder
} from './query-or-transform-builders';

export interface StoreSettings extends MemorySourceSettings {}

export default class Store<
  T extends ModelIdentity = Model
> extends MemorySource {
  get identityMap(): IdentityMap<T> {
    return IdentityMap.for<T>(this.cache);
  }

  static create<T extends ModelIdentity = Model>(
    injections: StoreSettings = {}
  ): Store<T> {
    injections.name = injections.name || 'store';
    const owner = getOwner(injections);
    const store = new this<T>(injections);
    const modelFactory = store.identityMap.createModelFactory(store);

    setOwner(store, owner);
    setOwner(modelFactory, owner);

    return store;
  }

  destroy() {
    this.identityMap.destroy();
  }

  fork(settings: StoreSettings = {}): Store<T> {
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

    return Store.create<T>(injections);
  }

  record<K extends T = T>(
    identifier: RecordIdentity,
    options?: object
  ): FindRecordQueryOrTransformBuilder<K> {
    return new FindRecordQueryOrTransformBuilder<K>(this, identifier, options);
  }

  records<K extends T = T>(
    typeOrIdentifiers: string | RecordIdentity[],
    options?: object
  ): FindRecordsQueryOrTransformBuilder<K> {
    return new FindRecordsQueryOrTransformBuilder<K>(
      this,
      typeOrIdentifiers,
      options
    );
  }

  has(identifier: RecordIdentity): boolean {
    return !!this.cache.getRecordSync(identifier);
  }
}
