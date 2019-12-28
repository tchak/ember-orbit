import { ConnectionStrategy } from '@orbit/coordinator';
import MemorySource, { MemoryCache } from '@orbit/memory';
import {
  Query,
  FindRecord,
  FindRelatedRecord,
  FindRelatedRecords,
  FindRecords
} from '@orbit/data';

export function cacheStrategyFilter(this: ConnectionStrategy, query: Query) {
  const cache = getCache(this);

  if (cache && this._event === 'beforeQuery') {
    if (query.options.reload || query.options.backgroundReload) {
      return true;
    }

    return !hasQueryInCache(cache, query);
  }

  return true;
}

export function cacheStrategyBlocking(this: ConnectionStrategy, query: Query) {
  const cache = getCache(this);

  if (cache && this._event === 'beforeQuery') {
    if (query.options.reload || !hasQueryInCache(cache, query)) {
      return true;
    }

    return false;
  }

  return true;
}

export function markTypeAsLoaded(cache: MemoryCache, query: Query) {
  if (query.expression.op === 'findRecords') {
    const expression = query.expression as FindRecords;
    if (expression.type && !getLoadedTypeMap(cache)[expression.type]) {
      getLoadedTypeMap(cache)[expression.type] = true;
    }
  }
}

function getCache(strategy: ConnectionStrategy): MemoryCache | false {
  const source = strategy.source as MemorySource;

  if (source && source.cache) {
    return source.cache;
  }

  return false;
}

function hasQueryInCache(cache: MemoryCache, query: Query) {
  if (query.expression.op === 'findRecord') {
    const expression = query.expression as FindRecord;
    return cache.getRecordSync(expression.record) !== undefined;
  } else if (query.expression.op === 'findRecords') {
    const expression = query.expression as FindRecords;
    if (expression.type) {
      return getLoadedTypeMap(cache)[expression.type];
    } else if (expression.records) {
      return (
        cache.getRecordsSync(expression.records).length ===
        expression.records.length
      );
    }
  } else if (query.expression.op === 'findRelatedRecord') {
    const expression = query.expression as FindRelatedRecord;
    return (
      cache.getRelatedRecordSync(expression.record, expression.relationship) !==
      undefined
    );
  } else if (query.expression.op === 'findRelatedRecords') {
    const expression = query.expression as FindRelatedRecords;
    return (
      cache.getRelatedRecordsSync(
        expression.record,
        expression.relationship
      ) !== undefined
    );
  }
  return false;
}

type LoadeTypeMap = Record<string, boolean>;

const loadedTypeMaps = new WeakMap<MemoryCache, LoadeTypeMap>();

function getLoadedTypeMap(cache: MemoryCache) {
  let loadedTypeMap = loadedTypeMaps.get(cache);

  if (!loadedTypeMap) {
    loadedTypeMap = {};
    loadedTypeMaps.set(cache, loadedTypeMap);
  }

  return loadedTypeMap;
}
