import { Listener } from '@orbit/core';
import { deepGet } from '@orbit/utils';
import {
  buildQuery,
  RecordIdentity,
  QueryOrExpressions,
  RecordOperation,
  Record
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
  sourceCache: MemoryCache;
  modelFactory: ModelFactory;
}

export default class Cache {
  private _sourceCache: MemoryCache;
  private _modelFactory: ModelFactory;

  private _patchListener: Listener;

  subscriptions = new Map<LiveArray, () => void>();
  identityMap: IdentityMap<RecordIdentity, Model> = new IdentityMap({
    serializer: recordIdentitySerializer
  });

  constructor(settings: CacheSettings) {
    this._sourceCache = settings.sourceCache;
    this._modelFactory = settings.modelFactory;

    this._patchListener = this.generatePatchListener();
    this._sourceCache.on('patch', this._patchListener);
  }

  has(identifier: RecordIdentity): boolean {
    return !!this.raw(identifier);
  }

  raw(identifier: RecordIdentity): Record | undefined {
    return this._sourceCache.getRecordSync(identifier);
  }

  record(identifier: RecordIdentity): Model | undefined {
    if (this.has(identifier)) {
      return this.lookup(identifier) as Model;
    }
    return undefined;
  }

  records(type: string | RecordIdentity[]): Model[] {
    const identities = this._sourceCache.getRecordsSync(type);
    return this.lookup(identities) as Model[];
  }

  peekAttribute(identity: RecordIdentity, attribute: string): any {
    const record = this._sourceCache.getRecordSync(identity);
    return record && deepGet(record, ['attributes', attribute]);
  }

  relatedRecord(
    identity: RecordIdentity,
    relationship: string
  ): Model | null | undefined {
    const relatedRecord = this._sourceCache.getRelatedRecordSync(
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
    const relatedRecords = this._sourceCache.getRelatedRecordsSync(
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
      this._sourceCache.queryBuilder
    );
    const result = this._sourceCache.query(query);
    if (result) {
      return this.lookup(result, query.expressions.length);
    } else {
      return result;
    }
  }

  liveQuery(
    queryOrExpressions: QueryOrExpressions,
    options?: object,
    id?: string
  ) {
    const query = buildQuery(
      queryOrExpressions,
      options,
      id,
      this._sourceCache.queryBuilder
    );

    const liveQuery = new SyncLiveQuery({ query, cache: this._sourceCache });
    const liveArray = new LiveArray({ cache: this, liveQuery });
    const subscription = liveArray.subscribe();

    this.subscriptions.set(liveArray, subscription);

    return liveArray;
  }

  unload(identity: RecordIdentity): void {
    const record = this.identityMap.get(identity);
    if (record) {
      record.disconnect();
      this.identityMap.delete(identity);
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
        record = this._modelFactory.create(result);
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
    this._sourceCache.off('patch', this._patchListener);

    for (let record of this.identityMap.values()) {
      record.disconnect();
    }

    for (let [, subscription] of this.subscriptions) {
      subscription();
    }

    this.subscriptions.clear();
    this.identityMap.clear();
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
      const { type, id, keys, attributes, relationships } = record;
      const identity = { type, id };

      switch (operation.op) {
        case 'updateRecord':
          for (let properties of [attributes, keys, relationships]) {
            if (properties) {
              for (let property of Object.keys(properties)) {
                if (
                  Object.prototype.hasOwnProperty.call(properties, property)
                ) {
                  this.notifyPropertyChange(identity, property);
                }
              }
            }
          }
          break;
        case 'replaceAttribute':
          this.notifyPropertyChange(identity, operation.attribute);
          break;
        case 'replaceKey':
          this.notifyPropertyChange(identity, operation.key);
          break;
        case 'replaceRelatedRecord':
        case 'replaceRelatedRecords':
        case 'addToRelatedRecords':
        case 'removeFromRelatedRecords':
          this.notifyPropertyChange(identity, operation.relationship);
          break;
        case 'removeRecord':
          this.unload(identity);
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
