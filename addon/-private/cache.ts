import {
  RecordIdentity,
  buildQuery,
  QueryOrExpressions,
  Record as OrbitRecord,
  Source,
  Queryable,
  Updatable
} from '@orbit/data';
import { deepGet } from '@orbit/utils';
import { SyncRecordCache } from '@orbit/record-cache';

import LiveArray from './live-array';
import { SyncLiveQuery } from './live-query/sync-live-query';
import { IdentityMap, ModelIdentity } from './identity-map';

export interface QueryableAndTransfomableSource
  extends Source,
    Queryable,
    Updatable {
  cache: SyncRecordCache;
}

export type LookupResult<T> = T | T[] | null | (T | T[] | null)[];

export function cacheQuery<T extends ModelIdentity>(
  cache: SyncRecordCache,
  queryOrExpressions: QueryOrExpressions,
  options?: object,
  id?: string
): LookupResult<T> {
  const query = buildQuery(queryOrExpressions, options, id, cache.queryBuilder);
  const result = cache.query(query);

  return IdentityMap.for<T>(cache).lookup(result, query.expressions.length);
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

  IdentityMap.for<T>(cache).registerLiveArray(liveArray);

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

  return IdentityMap.for<T>(source.cache).lookup(
    result,
    query.expressions.length
  );
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
