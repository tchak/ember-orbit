import {
  RecordIdentity,
  serializeRecordIdentity,
  deserializeRecordIdentity,
  buildQuery,
  QueryOrExpressions,
  RecordOperation,
  cloneRecordIdentity,
  Record as OrbitRecord,
  Source,
  Queryable,
  Updatable
} from '@orbit/data';
import { deepGet } from '@orbit/utils';
import {
  QueryResult,
  QueryResultData,
  SyncRecordCache
} from '@orbit/record-cache';
import IdentityMap, { IdentitySerializer } from '@orbit/identity-map';

import LiveArray from './live-array';
import { SyncLiveQuery } from './live-query/sync-live-query';

export class RecordIdentitySerializer<T extends RecordIdentity>
  implements IdentitySerializer<RecordIdentity> {
  serialize(identity: RecordIdentity) {
    return serializeRecordIdentity(identity);
  }
  deserialize(identifier: string) {
    return deserializeRecordIdentity(identifier) as T;
  }
}

export interface QueryableAndTransfomableSource
  extends Source,
    Queryable,
    Updatable {
  cache: SyncRecordCache;
}

export interface ModelIdentity
  extends RecordIdentity,
    Record<string, unknown> {}

export interface ModelFactory<T extends ModelIdentity> {
  create(identifier: RecordIdentity): T;
}

export type LookupResult<T> = T | T[] | null | (T | T[] | null)[];
export type LookupCacheResult<T> = LookupResult<T> | undefined;

export function cacheQuery<T extends ModelIdentity>(
  cache: SyncRecordCache,
  queryOrExpressions: QueryOrExpressions,
  options?: object,
  id?: string
): LookupResult<T> {
  const query = buildQuery(queryOrExpressions, options, id, cache.queryBuilder);
  const result = cache.query(query);

  return lookup<T>(cache, result, query.expressions.length);
}

export function liveQuery<T extends ModelIdentity>(
  cache: SyncRecordCache,
  queryOrExpressions: QueryOrExpressions,
  options?: object,
  id?: string
): LiveArray<T> {
  const query = buildQuery(queryOrExpressions, options, id, cache.queryBuilder);

  const liveQuery = new SyncLiveQuery({ query, cache });
  const liveArray = new LiveArray<T>({ liveQuery });

  liveArray.subscribe();
  registerLiveArray(cache, liveArray);

  return liveArray;
}

export async function sourceQuery<T extends ModelIdentity>(
  source: QueryableAndTransfomableSource,
  queryOrExpressions: QueryOrExpressions,
  options?: object,
  id?: string
): Promise<LookupResult<T>> {
  const query = buildQuery(
    queryOrExpressions,
    options,
    id,
    source.queryBuilder
  );
  const result = await source.query(query, options);

  return lookup<T>(source.cache, result, query.expressions.length);
}

export function lookup<T extends ModelIdentity>(
  cache: SyncRecordCache,
  result: QueryResult,
  n = 1
): LookupResult<T> {
  const identityMap = getIdentityMap<T>(cache);

  if (isQueryResultData(result, n)) {
    return (result as QueryResultData[]).map(result =>
      lookupQueryResultData(identityMap, result)
    );
  } else {
    return lookupQueryResultData(identityMap, result);
  }
}

export function unload<T extends ModelIdentity>(
  cache: SyncRecordCache,
  identifier: RecordIdentity,
  force = true
) {
  const identityMap = getIdentityMap<T>(cache);
  const record = identityMap.get(identifier);

  if (force && has(cache, identifier)) {
    cache.patch(t => t.removeRecord(identifier));
  }

  if (record) {
    recordSourceCache.delete(record);
    identityMap.delete(identifier);
  }
}

function getIdentityMap<T extends ModelIdentity>(
  cache: SyncRecordCache,
  create = true
): IdentityMap<RecordIdentity, T> {
  let identityMap = identityMapCache.get(cache);

  if (create && !identityMap) {
    const serializer = new RecordIdentitySerializer<T>();
    identityMap = new IdentityMap({ serializer });

    const off = cache.on('patch', generatePatchListener(cache, identityMap));
    identityMapCache.set(cache, identityMap);
    patchListenerCache.set(cache, off);
  }

  return identityMap as IdentityMap<RecordIdentity, T>;
}

export function setModelFactory<T extends ModelIdentity>(
  cache: SyncRecordCache,
  modelFactory: ModelFactory<T>
): void {
  const identityMap = getIdentityMap<T>(cache);
  modelFactoryCache.set(identityMap, modelFactory);
}

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

export function destroyIdentityMap<T extends ModelIdentity>(
  cache: SyncRecordCache
) {
  const off = patchListenerCache.get(cache);
  const identityMap = getIdentityMap<T>(cache, false);
  const subscriptions = liveArrayCache.get(cache);

  if (off) {
    off();
  }

  if (identityMap) {
    for (let record of identityMap.values()) {
      recordSourceCache.delete(record);
    }
    identityMap.clear();
  }

  if (subscriptions) {
    for (let subscription of subscriptions) {
      subscription.unsubscribe();
    }
    subscriptions.clear();
  }

  patchListenerCache.delete(cache);
  identityMapCache.delete(cache);
  liveArrayCache.delete(cache);
}

export function has(
  cache: SyncRecordCache,
  identifier: RecordIdentity
): boolean {
  return !!peekRecord(cache, identifier);
}

export function peekRecord(
  cache: SyncRecordCache,
  identifier: RecordIdentity
): OrbitRecord | undefined {
  return cache.getRecordSync(identifier);
}

export function peekRelatedRecord(
  cache: SyncRecordCache,
  identifier: RecordIdentity,
  relationship: string
): OrbitRecord | undefined | null {
  return cache.getRelatedRecordSync(identifier, relationship);
}

export function peekRelatedRecords(
  cache: SyncRecordCache,
  identifier: RecordIdentity,
  relationship: string
): OrbitRecord[] | undefined {
  return cache.getRelatedRecordsSync(identifier, relationship);
}

export function peekRecordMeta(
  cache: SyncRecordCache,
  identifier: RecordIdentity
): Record<string, unknown> | undefined {
  const record = peekRecord(cache, identifier);
  return record && deepGet(record, ['meta']);
}

export function peekRecordLinks(
  cache: SyncRecordCache,
  identifier: RecordIdentity
): Record<string, unknown> | undefined {
  const record = peekRecord(cache, identifier);
  return record && deepGet(record, ['links']);
}

export function peekRelationMeta(
  cache: SyncRecordCache,
  identifier: RecordIdentity,
  relationship: string
): Record<string, unknown> | undefined {
  const record = peekRecord(cache, identifier);
  return record && deepGet(record, ['relationships', relationship, 'meta']);
}

export function peekRelationLinks(
  cache: SyncRecordCache,
  identifier: RecordIdentity,
  relationship: string
): Record<string, unknown> | undefined {
  const record = peekRecord(cache, identifier);
  return record && deepGet(record, ['relationships', relationship, 'links']);
}

export function peekRecordAttribute(
  cache: SyncRecordCache,
  identifier: RecordIdentity,
  attribute: string
): unknown | undefined {
  const record = peekRecord(cache, identifier);
  return record && deepGet(record, ['attributes', attribute]);
}

function lookupQueryResultData<T extends ModelIdentity>(
  identityMap: IdentityMap<RecordIdentity, T>,
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

function registerLiveArray<T extends ModelIdentity>(
  cache: SyncRecordCache,
  liveArray: LiveArray<T>
) {
  const liveArrays = liveArrayCache.get(cache) || new Set();
  liveArrays.add(liveArray);
}

function generatePatchListener<T extends ModelIdentity>(
  cache: SyncRecordCache,
  identityMap: IdentityMap<RecordIdentity, T>
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
        unload(cache, identity, false);
        break;
    }
  };
}

function notifyPropertyChange<T extends ModelIdentity>(
  identityMap: IdentityMap<RecordIdentity, T>,
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
  IdentityMap<RecordIdentity, ModelIdentity>
>();

const modelFactoryCache = new WeakMap<
  IdentityMap<RecordIdentity, ModelIdentity>,
  ModelFactory<ModelIdentity>
>();

const liveArrayCache = new WeakMap<
  SyncRecordCache,
  Set<LiveArray<ModelIdentity>>
>();

const patchListenerCache = new WeakMap<SyncRecordCache, () => void>();

const recordSourceCache = new WeakMap<
  ModelIdentity,
  QueryableAndTransfomableSource
>();
