import { getOwner, setOwner } from '@ember/application';

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
  static create(injections: StoreSettings = {}): Store {
    const owner = injections.base
      ? getOwner(injections.base)
      : getOwner(injections);

    Object.assign(injections, owner.ownerInjection());
    const store = new this(injections);

    setOwner(store, owner);

    return store;
  }

  constructor(settings: StoreSettings = {}) {
    settings.name = settings.name || 'store';
    super(settings);

    patchStoreCache(this.cache);
    IdentityMap.setup(this);
  }

  destroy(): void {
    IdentityMap.teardown(this);
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

    return Store.create(settings);
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
}

interface StoreCache extends MemoryCache {
  has(identifier: RecordIdentity): boolean;
  record<T extends Model>(identifier: RecordIdentity): T | undefined;
}

function patchStoreCache(cache: StoreCache): void {
  if (!cache.has) {
    cache.has = function(identifier: RecordIdentity): boolean {
      return !!this.getRecordSync(identifier);
    };

    cache.record = function<T extends Model>(
      identifier: RecordIdentity
    ): T | undefined {
      const record = this.getRecordSync(identifier);
      if (record) {
        return IdentityMap.for<T>(this).lookup(record) as T;
      }
      return record;
    };
  }
}
