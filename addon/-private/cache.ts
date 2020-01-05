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

import LiveQuery from './live-query';
import Model from './model';
import ModelFactory from './model-factory';
import recordIdentitySerializer from './utils/record-identity-serializer';

export interface CacheSettings {
  sourceCache: MemoryCache;
  modelFactory: ModelFactory;
}

interface LiveQueryContract {
  invalidate(): void;
}

export default class Cache {
  private _sourceCache: MemoryCache;
  private _modelFactory: ModelFactory;

  private _liveQuerySet: Set<LiveQueryContract> = new Set();
  private _patchListener: Listener;
  private _resetListener: Listener;

  identityMap: IdentityMap<RecordIdentity, Model> = new IdentityMap({
    serializer: recordIdentitySerializer
  });

  constructor(settings: CacheSettings) {
    this._sourceCache = settings.sourceCache;
    this._modelFactory = settings.modelFactory;

    this._patchListener = this.generatePatchListener();
    this._resetListener = this.generateResetListener();

    this._sourceCache.on('patch', this._patchListener);
    this._sourceCache.on('reset', this._resetListener);
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

    const liveQuery = LiveQuery.create({
      getContent: () => this.query(query),
      _liveQuerySet: this._liveQuerySet
    });

    this._liveQuerySet.add(liveQuery);

    return liveQuery;
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

  destroy(): void {
    this._sourceCache.off('patch', this._patchListener);
    this._sourceCache.off('reset', this._resetListener);

    for (let record of this.identityMap.values()) {
      record.disconnect();
    }

    this.identityMap.clear();
    this._liveQuerySet.clear();
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

  private notifyLiveQueryChange(): void {
    for (let liveQuery of this._liveQuerySet) {
      liveQuery.invalidate();
    }
  }

  private generatePatchListener(): (operation: RecordOperation) => void {
    return (operation: RecordOperation) => {
      const record = operation.record as Record;
      const { type, id, keys, attributes, relationships } = record;
      const identity = { type, id };

      this.notifyLiveQueryChange();

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

  private generateResetListener(): () => void {
    return () => this.notifyLiveQueryChange();
  }
}

function isQueryResultData(
  _result: QueryResult,
  expressions: number
): _result is QueryResultData[] {
  return expressions > 1;
}
