import {
  RecordIdentity,
  buildQuery,
  QueryOrExpressions,
  Record as OrbitRecord
} from '@orbit/data';
import { deepGet } from '@orbit/utils';
import { SyncRecordCache } from '@orbit/record-cache';

import Store from './store';
import Model from './model';
import LiveArray, { SyncLiveQuery } from './live-array';

export type LookupResult<T> = T | T[] | null | (T | T[] | null)[];

export function cacheQuery<T extends Model>(
  source: Store,
  queryOrExpressions: QueryOrExpressions,
  options?: object,
  id?: string
): LookupResult<T> {
  const query = buildQuery(
    queryOrExpressions,
    options,
    id,
    source.cache.queryBuilder
  );
  const result = source.cache.query(query);

  return source.identityMap.lookup<T>(result, query.expressions.length);
}

export function liveQuery<T extends Model>(
  source: Store,
  queryOrExpressions: QueryOrExpressions,
  options?: object,
  id?: string
): LiveArray<T> {
  const query = buildQuery(
    queryOrExpressions,
    options,
    id,
    source.cache.queryBuilder
  );

  const liveQuery = new SyncLiveQuery({ cache: source.cache, query });

  return source.identityMap.lookupLiveQuery<T>(liveQuery);
}

export async function sourceQuery<T extends Model>(
  source: Store,
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

  return source.identityMap.lookup<T>(result, query.expressions.length);
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
