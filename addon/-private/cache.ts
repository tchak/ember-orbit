import {
  buildQuery,
  RecordIdentity,
  QueryOrExpressions,
  RecordOperation,
  Record,
  cloneRecordIdentity
} from '@orbit/data';
import { QueryResult, QueryResultData } from '@orbit/record-cache';
import { MemoryCache } from '@orbit/memory';
import IdentityMap from '@orbit/identity-map';

import { SyncLiveQuery } from './live-query/sync-live-query';
import LiveArray from './live-array';
import Model from './model';
import ModelFactory from './model-factory';
import recordIdentitySerializer from './utils/record-identity-serializer';

export interface CacheSettings {
  cache: MemoryCache;
  modelFactory: ModelFactory;
}

export default class Cache {
  private _cache: MemoryCache;
  private _patchListener: () => void;

  protected modelFactory: ModelFactory;
  protected subscriptions = new Map<LiveArray, () => void>();
  protected identityMap: IdentityMap<RecordIdentity, Model> = new IdentityMap({
    serializer: recordIdentitySerializer
  });

  constructor(settings: CacheSettings) {
    this._cache = settings.cache;
    this.modelFactory = settings.modelFactory;

    this._patchListener = this._cache.on('patch', this.generatePatchListener());
  }

  has(identifier: RecordIdentity): boolean {
    return !!this.raw(identifier);
  }

  raw(identifier: RecordIdentity): Record | undefined {
    return this._cache.getRecordSync(identifier);
  }

  record(identifier: RecordIdentity): Model | undefined {
    if (this.has(identifier)) {
      return this.lookup(identifier) as Model;
    }
    return undefined;
  }

  records(type: string | RecordIdentity[]): Model[] {
    const identities = this._cache.getRecordsSync(type);
    return this.lookup(identities) as Model[];
  }

  relatedRecord(
    identity: RecordIdentity,
    relationship: string
  ): Model | null | undefined {
    const relatedRecord = this._cache.getRelatedRecordSync(
      identity,
      relationship
    );

    if (relatedRecord) {
      return this.lookup(relatedRecord) as Model;
    } else {
      return relatedRecord;
    }
  }

  relatedRecords(
    identity: RecordIdentity,
    relationship: string
  ): Model[] | undefined {
    const relatedRecords = this._cache.getRelatedRecordsSync(
      identity,
      relationship
    );

    if (relatedRecords) {
      return this.lookup(relatedRecords) as Model[];
    } else {
      return undefined;
    }
  }

  query(
    queryOrExpressions: QueryOrExpressions,
    options?: object,
    id?: string
  ): Model | Model[] | null | (Model | Model[] | null)[] {
    const query = buildQuery(
      queryOrExpressions,
      options,
      id,
      this._cache.queryBuilder
    );
    const result = this._cache.query(query);
    if (result) {
      return this.lookup(result, query.expressions.length);
    } else {
      return result;
    }
  }

  liveQuery<M extends Model = Model>(
    queryOrExpressions: QueryOrExpressions,
    options?: object,
    id?: string
  ) {
    const query = buildQuery(
      queryOrExpressions,
      options,
      id,
      this._cache.queryBuilder
    );

    const liveQuery = new SyncLiveQuery({ query, cache: this._cache });
    const liveArray = new LiveArray<M>({ cache: this, liveQuery });
    const subscription = liveArray.subscribe();

    this.subscriptions.set(liveArray, subscription);

    return liveArray;
  }

  unload(identifier: RecordIdentity): void {
    if (this.has(identifier)) {
      this._cache.patch(t => t.removeRecord(identifier));
    }
    this._unload(identifier);
  }

  private _unload(identifier: RecordIdentity): void {
    const record = this.identityMap.get(identifier);
    if (record) {
      record.disconnect();
      this.identityMap.delete(identifier);
    }
  }

  lookup(
    result: QueryResult,
    expressions = 1
  ): Model | Model[] | null | (Model | Model[] | null)[] {
    if (isQueryResultData(result, expressions)) {
      return (result as QueryResultData[]).map(result => this._lookup(result));
    } else {
      return this._lookup(result);
    }
  }

  private _lookup(result: QueryResultData): Model | Model[] | null {
    if (Array.isArray(result)) {
      return result.map(identity => this._lookup(identity) as Model);
    } else if (result) {
      let record = this.identityMap.get(result);

      if (!record) {
        record = this.modelFactory.create(result);
        this.identityMap.set(result, record);
      }

      return record;
    }

    return null;
  }

  unsubscribeLiveArray(liveArray: LiveArray) {
    const subscription = this.subscriptions.get(liveArray);
    if (subscription) {
      this.subscriptions.delete(liveArray);
      subscription();
    }
  }

  destroy(): void {
    this._patchListener();

    for (let record of this.identityMap.values()) {
      record.disconnect();
    }

    for (let subscription of this.subscriptions.values()) {
      subscription();
    }

    this.identityMap.clear();
    this.subscriptions.clear();
  }

  private notifyPropertyChange(
    identity: RecordIdentity,
    property: string
  ): void {
    const record = this.identityMap.get(identity);

    if (record) {
      record.notifyPropertyChange(property);
    }
  }

  private generatePatchListener(): (operation: RecordOperation) => void {
    return (operation: RecordOperation) => {
      const record = operation.record as Record;
      const { attributes, relationships } = record;
      const identity = cloneRecordIdentity(record);

      switch (operation.op) {
        case 'updateRecord':
          for (let properties of [attributes, relationships]) {
            if (properties) {
              for (let property of Object.getOwnPropertyNames(properties)) {
                this.notifyPropertyChange(identity, property);
              }
            }
          }
          break;
        case 'replaceAttribute':
          this.notifyPropertyChange(identity, operation.attribute);
          break;
        case 'replaceRelatedRecord':
        case 'replaceRelatedRecords':
        case 'addToRelatedRecords':
        case 'removeFromRelatedRecords':
          this.notifyPropertyChange(identity, operation.relationship);
          break;
        case 'removeRecord':
          this._unload(identity);
          break;
      }
    };
  }
}

function isQueryResultData(
  _result: QueryResult,
  expressions: number
): _result is QueryResultData[] {
  return expressions > 1;
}
