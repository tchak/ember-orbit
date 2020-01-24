import { RecordIdentity } from '@orbit/data';
import MemorySource, {
  MemorySourceSettings,
  MemorySourceMergeOptions,
  MemoryCache
} from '@orbit/memory';

import Model from './model';
import IdentityMap from './identity-map';
import {
  FindRecordQueryOrTransformBuilder,
  FindRecordsQueryOrTransformBuilder
} from './query-or-transform-builders';

export interface StoreSettings extends MemorySourceSettings {}
export interface StoreMergeOptions extends MemorySourceMergeOptions {}

export default class Store extends MemorySource {
  identityMap = new IdentityMap(this);

  constructor(settings: StoreSettings = {}) {
    super(settings);
    patchStoreCache(this.cache);
  }

  destroy(): void {
    this.identityMap.destroy();
  }

  get base(): Store {
    return super.base as Store;
  }

  fork(settings: StoreSettings = {}): Store {
    const schema = this.schema;

    settings.schema = schema;
    settings.cacheSettings = settings.cacheSettings || { schema };
    settings.keyMap = this.keyMap;
    settings.queryBuilder = this.queryBuilder;
    settings.transformBuilder = this.transformBuilder;
    settings.base = this;

    const store = new Store(settings);

    if (storeConfig && storeConfig.afterFork) {
      storeConfig.afterFork(this, store);
    }

    return store;
  }

  merge(source: Store, options?: StoreMergeOptions): Promise<void> {
    return super.merge(source, options);
  }

  record<T extends Model>(
    identifier: RecordIdentity,
    options?: object
  ): FindRecordQueryOrTransformBuilder<T> {
    return new FindRecordQueryOrTransformBuilder<T>(this, identifier, options);
  }

  records<T extends Model>(
    typeOrIdentifiers: string | RecordIdentity[],
    options?: object
  ): FindRecordsQueryOrTransformBuilder<T> {
    return new FindRecordsQueryOrTransformBuilder<T>(
      this,
      typeOrIdentifiers,
      options
    );
  }

  get cache(): StoreCache {
    return super.cache as StoreCache;
  }

  static config(config: Partial<StoreConfig>): void {
    storeConfig = config;
  }

  static storeFor(modelClass: typeof Model): Store {
    if (storeConfig && storeConfig.storeFor) {
      return storeConfig.storeFor(modelClass);
    }
    throw new Error(`Can't find a Store for ${modelClass}.`);
  }

  static modelFor<T extends Model>(
    store: Store,
    identifier: RecordIdentity
  ): T {
    if (storeConfig && storeConfig.modelFor) {
      return storeConfig.modelFor(store, identifier);
    }
    return new Model(store, identifier) as T;
  }
}

let storeConfig: Partial<StoreConfig>;

interface StoreCache extends MemoryCache {
  has(identifier: RecordIdentity): boolean;
  record<T extends Model>(identifier: RecordIdentity): T | undefined;
}

function patchStoreCache(cache: StoreCache): void {
  if (!cache.has) {
    cache.has = function(identifier: RecordIdentity): boolean {
      return !!this.getRecordSync(identifier);
    };
  }
}

export interface StoreConfig {
  storeFor(model: typeof Model): Store;
  modelFor<T extends Model>(store: Store, identifier: RecordIdentity): T;
  afterFork(store: Store, forkedStore: Store): void;
}
