import { DEBUG } from '@glimmer/env';

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

import Store from './store';
import Model from './model';
import LiveArray, { SyncLiveQuery } from './live-array';

export class RecordIdentitySerializer<T extends RecordIdentity>
  implements IdentitySerializer<RecordIdentity> {
  serialize(identity: RecordIdentity) {
    return serializeRecordIdentity(identity);
  }
  deserialize(identifier: string) {
    return deserializeRecordIdentity(identifier) as T;
  }
}

export default class IdentityMap extends OrbitIdentityMap<
  RecordIdentity,
  Model
> {
  private _patchListener: () => void;
  private _liveArrays: Set<LiveArray<Model>>;

  source: Store;

  get cache(): SyncRecordCache {
    return this.source.cache;
  }

  constructor(source: Store) {
    const serializer = new RecordIdentitySerializer<Model>();
    super({ serializer });

    this.source = source;
    this._patchListener = this.cache.on('patch', generatePatchListener(this));
    this._liveArrays = new Set();
  }

  lookup<T extends Model>(result: QueryResult, n = 1): LookupResult<T> {
    if (isQueryResultData(result, n)) {
      return (result as QueryResultData[]).map(result =>
        lookupQueryResultData(this, result)
      );
    } else {
      return lookupQueryResultData<T>(this, result);
    }
  }

  lookupLiveQuery<T extends Model>(liveQuery: SyncLiveQuery): LiveArray<T> {
    const liveArray = new LiveArray<T>(this.source, liveQuery);

    liveArray.subscribe();
    this._liveArrays.add(liveArray);

    return liveArray;
  }

  unload(identifier: RecordIdentity, force = true): void {
    const record = this.get(identifier);

    if (force && this.cache.getRecordSync(identifier)) {
      this.cache.patch(t => t.removeRecord(identifier));
    }

    if (record) {
      delete (record as any)._store;
      this.delete(identifier);
    }
  }

  destroy(): void {
    this._patchListener();

    for (let record of this.values()) {
      delete (record as any)._store;
    }
    this.clear();

    for (let liveArray of this._liveArrays) {
      liveArray.unsubscribe();
    }
    this._liveArrays.clear();
  }
}

export type LookupResult<T> = T | T[] | null | (T | T[] | null)[];
export type LookupCacheResult<T> = LookupResult<T> | undefined;

function lookupQueryResultData<T extends Model>(
  identityMap: IdentityMap,
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
    let record: T = identityMap.get(result) as T;

    if (!record) {
      record = Store.modelFor<T>(identityMap.source, result);
      identityMap.set(result, record);
    }

    return record;
  }

  return null;
}

function generatePatchListener(
  identityMap: IdentityMap
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

function notifyPropertyChange(
  identityMap: IdentityMap,
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
