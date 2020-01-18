import { RecordIdentity, QueryOrExpressions, Record } from '@orbit/data';
import { MemoryCache } from '@orbit/memory';

import {
  lookup,
  unload,
  has,
  peekRecord,
  cacheQuery,
  liveQuery,
  LookupResult,
  ModelIdentity,
  peekRelatedRecord,
  peekRelatedRecords
} from './cache';

export interface CacheSettings {
  cache: MemoryCache;
}

export default class Cache {
  private _cache: MemoryCache;

  constructor(settings: CacheSettings) {
    this._cache = settings.cache;
  }

  has(identifier: RecordIdentity): boolean {
    return has(this._cache, identifier);
  }

  raw(identifier: RecordIdentity): Record | undefined {
    return peekRecord(this._cache, identifier);
  }

  record(identifier: RecordIdentity): ModelIdentity | undefined {
    if (this.has(identifier)) {
      return lookup(this._cache, identifier) as ModelIdentity;
    }
    return undefined;
  }

  records(type: string | RecordIdentity[]): ModelIdentity[] {
    const identities = this._cache.getRecordsSync(type);
    return lookup(this._cache, identities) as ModelIdentity[];
  }

  relatedRecord(
    identity: RecordIdentity,
    relationship: string
  ): ModelIdentity | null | undefined {
    const relatedRecord = peekRelatedRecord(
      this._cache,
      identity,
      relationship
    );

    if (relatedRecord) {
      return lookup(this._cache, relatedRecord) as ModelIdentity;
    } else {
      return relatedRecord;
    }
  }

  relatedRecords(
    identity: RecordIdentity,
    relationship: string
  ): ModelIdentity[] | undefined {
    const relatedRecords = peekRelatedRecords(
      this._cache,
      identity,
      relationship
    );

    if (relatedRecords) {
      return lookup(this._cache, relatedRecords) as ModelIdentity[];
    } else {
      return undefined;
    }
  }

  query(
    queryOrExpressions: QueryOrExpressions,
    options?: object,
    id?: string
  ): LookupResult<ModelIdentity> {
    return cacheQuery<ModelIdentity>(
      this._cache,
      queryOrExpressions,
      options,
      id
    );
  }

  liveQuery(
    queryOrExpressions: QueryOrExpressions,
    options?: object,
    id?: string
  ) {
    return liveQuery(this._cache, queryOrExpressions, options, id);
  }

  unload(identifier: RecordIdentity): void {
    unload(this._cache, identifier, true);
  }
}
