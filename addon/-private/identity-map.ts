import { DEBUG } from '@glimmer/env';
import { getOwner } from '@ember/application';

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

import { SyncLiveQuery } from './live-query/sync-live-query';
import LiveArray from './live-array';
import { QueryableAndTransfomableSource, has } from './cache';
import { modelFor } from '../-ember/model-for';
import Model from './model';

export class RecordIdentitySerializer<T extends RecordIdentity>
  implements IdentitySerializer<RecordIdentity> {
  serialize(identity: RecordIdentity) {
    return serializeRecordIdentity(identity);
  }
  deserialize(identifier: string) {
    return deserializeRecordIdentity(identifier) as T;
  }
}

export default class IdentityMap<
  T extends RecordIdentity
> extends OrbitIdentityMap<RecordIdentity, T> {
  private _patchListener: () => void;
  private _liveArrays: Set<LiveArray<T>>;

  source: QueryableAndTransfomableSource;

  get cache(): SyncRecordCache {
    return this.source.cache;
  }

  constructor(source: QueryableAndTransfomableSource) {
    const serializer = new RecordIdentitySerializer<T>();
    super({ serializer });

    this.source = source;
    this._patchListener = this.cache.on('patch', generatePatchListener(this));
    this._liveArrays = new Set();

    identityMapCache.set(this.cache, this);
  }

  static for<T extends RecordIdentity>(cache: SyncRecordCache): IdentityMap<T> {
    const identityMap = identityMapCache.get(cache);

    if (!identityMap) {
      throw new Error(`IdentityMap for ${cache} is not initialized.`);
    }

    return identityMap as IdentityMap<T>;
  }

  static setup(source: QueryableAndTransfomableSource): void {
    new IdentityMap(source);
  }

  static teardown(source: QueryableAndTransfomableSource): void {
    this.for(source.cache).destroy();
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

  lookupLiveQuery(liveQuery: SyncLiveQuery): LiveArray<T> {
    const liveArray = new LiveArray<T>(liveQuery);

    liveArray.subscribe();
    this._liveArrays.add(liveArray);

    return liveArray;
  }

  unload(identifier: RecordIdentity, force = true): void {
    const record = this.get(identifier);

    if (force && has(this.cache, identifier)) {
      this.cache.patch(t => t.removeRecord(identifier));
    }

    if (record) {
      recordSourceCache.delete(record);
      this.delete(identifier);
    }
  }

  destroy(): void {
    this._patchListener();

    for (let record of this.values()) {
      recordSourceCache.delete(record);
    }
    this.clear();

    for (let liveArray of this._liveArrays) {
      liveArray.unsubscribe();
    }
    this._liveArrays.clear();

    identityMapCache.delete(this.cache);
  }
}

export type LookupResult<T> = T | T[] | null | (T | T[] | null)[];
export type LookupCacheResult<T> = LookupResult<T> | undefined;

export function getRecordSource(
  record: RecordIdentity
): QueryableAndTransfomableSource {
  const source = recordSourceCache.get(record);

  if (!source) {
    throw new Error('record has been removed from the Store');
  }

  return source;
}

export function getModelSource(
  model: typeof Model
): QueryableAndTransfomableSource {
  const owner = getOwner(model);
  const {
    types: { source }
  } = owner.lookup('ember-orbit:config');

  return owner.lookup(`${source}:store`);
}

export function hasSource<T extends RecordIdentity>(record: T): boolean {
  return recordSourceCache.has(record);
}

function lookupQueryResultData<T extends RecordIdentity>(
  identityMap: IdentityMap<T>,
  result: QueryResultData
): T | T[] | null {
  if (Array.isArray(result)) {
    const records = result.map(
      identity => lookupQueryResultData(identityMap, identity) as T
    );

    if (DEBUG) {
      Object.freeze(records);
    }

    return records;
  } else if (result) {
    let record: T = identityMap.get(result);

    if (!record) {
      record = modelFor<T>(identityMap.source, result);

      recordSourceCache.set(record, identityMap.source);
      identityMap.set(result, record);
    }

    return record;
  }

  return null;
}

function generatePatchListener<T extends RecordIdentity>(
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

function notifyPropertyChange<T extends RecordIdentity>(
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
  IdentityMap<RecordIdentity>
>();

const recordSourceCache = new WeakMap<
  RecordIdentity,
  QueryableAndTransfomableSource
>();
