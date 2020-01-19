import {
  RecordIdentity,
  serializeRecordIdentity,
  deserializeRecordIdentity,
  RecordOperation,
  cloneRecordIdentity,
  Record as OrbitRecord
} from '@orbit/data';
import {
  QueryResult,
  QueryResultData,
  SyncRecordCache
} from '@orbit/record-cache';
import OrbitIdentityMap, { IdentitySerializer } from '@orbit/identity-map';

import LiveArray from './live-array';
import { has, QueryableAndTransfomableSource } from './cache';
import ModelFactory from './model-factory';

export class RecordIdentitySerializer<T extends RecordIdentity>
  implements IdentitySerializer<RecordIdentity> {
  serialize(identity: RecordIdentity) {
    return serializeRecordIdentity(identity);
  }
  deserialize(identifier: string) {
    return deserializeRecordIdentity(identifier) as T;
  }
}

export interface ModelIdentity
  extends RecordIdentity,
    Record<string, unknown> {}

export class IdentityMap<T extends ModelIdentity> extends OrbitIdentityMap<
  RecordIdentity,
  T
> {
  protected cache: SyncRecordCache;
  protected patchListener: () => void;
  protected liveArrays: Set<LiveArray<T>>;

  constructor(cache: SyncRecordCache) {
    const serializer = new RecordIdentitySerializer<T>();
    super({ serializer });

    this.cache = cache;
    this.patchListener = cache.on('patch', generatePatchListener(this));
    this.liveArrays = new Set();

    identityMapCache.set(cache, this);
  }

  static for<T extends ModelIdentity>(cache: SyncRecordCache): IdentityMap<T> {
    let identityMap = identityMapCache.get(cache);

    if (!identityMap) {
      identityMap = new this<T>(cache);
    }

    return identityMap as IdentityMap<T>;
  }

  createModelFactory(source: QueryableAndTransfomableSource) {
    const modelFactory = new ModelFactory(source);
    modelFactoryCache.set(this, modelFactory);
    return modelFactory;
  }

  lookup(result: QueryResult, n = 1): LookupResult<T> {
    if (isQueryResultData(result, n)) {
      return (result as QueryResultData[]).map(result =>
        lookupQueryResultData(this, result)
      );
    } else {
      return lookupQueryResultData(this, result);
    }
  }

  registerLiveArray(liveArray: LiveArray<T>) {
    liveArray.subscribe();
    this.liveArrays.add(liveArray);
  }

  unload(identifier: RecordIdentity, force = true) {
    const record = this.get(identifier);

    if (force && has(this.cache, identifier)) {
      this.cache.patch(t => t.removeRecord(identifier));
    }

    if (record) {
      recordSourceCache.delete(record);
      this.delete(identifier);
    }
  }

  destroy() {
    if (this.patchListener) {
      this.patchListener();
    }

    for (let record of this.values()) {
      recordSourceCache.delete(record);
    }
    this.clear();

    for (let liveArray of this.liveArrays) {
      liveArray.unsubscribe();
    }
    this.liveArrays.clear();

    identityMapCache.delete(this.cache);
  }
}

export type LookupResult<T> = T | T[] | null | (T | T[] | null)[];
export type LookupCacheResult<T> = LookupResult<T> | undefined;

export function getSource<T extends ModelIdentity>(
  record: T
): QueryableAndTransfomableSource {
  const source = recordSourceCache.get(record);

  if (!source) {
    throw new Error('record has been removed from the Store');
  }

  return source;
}

export function setSource<T extends ModelIdentity>(
  record: T,
  source: QueryableAndTransfomableSource
) {
  recordSourceCache.set(record, source);
}

export function hasSource<T extends ModelIdentity>(record: T) {
  return recordSourceCache.has(record);
}

function lookupQueryResultData<T extends ModelIdentity>(
  identityMap: IdentityMap<T>,
  result: QueryResultData
): T | T[] | null {
  if (Array.isArray(result)) {
    return result.map(
      identity => lookupQueryResultData(identityMap, identity) as T
    );
  } else if (result) {
    let record: T = identityMap.get(result);

    if (!record) {
      const modelFactory = modelFactoryCache.get(identityMap) as ModelFactory<
        T
      >;
      record = modelFactory.create(result);
      identityMap.set(result, record);
    }

    return record;
  }

  return null;
}

function generatePatchListener<T extends ModelIdentity>(
  identityMap: IdentityMap<T>
): (operation: RecordOperation) => void {
  return (operation: RecordOperation) => {
    const record = operation.record as OrbitRecord;
    const { attributes, relationships } = record;
    const identity = cloneRecordIdentity(record);

    switch (operation.op) {
      case 'updateRecord':
        for (let properties of [attributes, relationships]) {
          if (properties) {
            for (let property of Object.getOwnPropertyNames(properties)) {
              notifyPropertyChange(identityMap, identity, property);
            }
          }
        }
        break;
      case 'replaceAttribute':
        notifyPropertyChange(identityMap, identity, operation.attribute);
        break;
      case 'replaceRelatedRecord':
      case 'replaceRelatedRecords':
      case 'addToRelatedRecords':
      case 'removeFromRelatedRecords':
        notifyPropertyChange(identityMap, identity, operation.relationship);
        break;
      case 'removeRecord':
        identityMap.unload(identity, false);
        break;
    }
  };
}

function notifyPropertyChange<T extends ModelIdentity>(
  identityMap: IdentityMap<T>,
  identifier: RecordIdentity,
  property: string
) {
  const record = identityMap.get(identifier);

  if (record) {
    const notifier = Reflect.getMetadata('orbit:notifier', record, property);

    if (notifier) {
      notifier(record);
    }
  }
}

function isQueryResultData(
  _result: QueryResult,
  expressions: number
): _result is QueryResultData[] {
  return expressions > 1;
}

const identityMapCache = new WeakMap<
  SyncRecordCache,
  IdentityMap<ModelIdentity>
>();

const modelFactoryCache = new WeakMap<
  IdentityMap<ModelIdentity>,
  ModelFactory<ModelIdentity>
>();

const recordSourceCache = new WeakMap<
  ModelIdentity,
  QueryableAndTransfomableSource
>();
