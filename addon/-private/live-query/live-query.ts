import { Evented } from '@orbit/core';
import {
  QueryExpression,
  FindRecord,
  FindRecords,
  FindRelatedRecord,
  FindRelatedRecords,
  equalRecordIdentities,
  Query,
  Schema,
  RecordOperation,
  RecordException
} from '@orbit/data';

import { QueryResult } from '@orbit/record-cache';
import { recordOperationChange, RecordChange } from './utils';

export interface LiveQuerySettings {
  query: Query;
}

export interface LiveQuerySubscription {
  unsubscribe(): void;
  execute(): void;
}

export class LiveQuery {
  cache!: Evented;
  schema!: Schema;
  query: Query;

  executeQuery(
    _onNext: (result: QueryResult) => void,
    _onError?: (error: RecordException) => void
  ): void {
    throw new TypeError('executeQuery: Not Implemented.');
  }

  subscribe(
    onNext: (result: QueryResult) => void,
    onError?: (error: RecordException) => void
  ): LiveQuerySubscription {
    const execute = onceTick(() => this.executeQuery(onNext, onError));

    const unsubscribePatch = this.cache.on(
      'patch',
      (operation: RecordOperation) => {
        if (this.match(operation)) {
          execute();
        }
      }
    );

    const unsubscribeReset = this.cache.on('reset', () => {
      execute();
    });

    function unsubscribe() {
      cancelTick(execute);
      unsubscribePatch();
      unsubscribeReset();
    }

    return { unsubscribe, execute };
  }

  constructor(settings: LiveQuerySettings) {
    this.query = settings.query;
  }

  match(operation: RecordOperation): boolean {
    const change = recordOperationChange(operation);
    return !!this.query.expressions.find(expression =>
      this._queryExpressionMatchChange(expression, change)
    );
  }

  protected _queryExpressionMatchChange(
    expression: QueryExpression,
    change: RecordChange
  ): boolean {
    switch (expression.op) {
      case 'findRecord':
        return this._findRecordQueryExpressionMatchChange(
          expression as FindRecord,
          change
        );
      case 'findRecords':
        return this._findRecordsQueryExpressionMatchChange(
          expression as FindRecords,
          change
        );
      case 'findRelatedRecord':
        return this._findRelatedRecordQueryExpressionMatchChange(
          expression as FindRelatedRecord,
          change
        );
      case 'findRelatedRecords':
        return this._findRelatedRecordsQueryExpressionMatchChange(
          expression as FindRelatedRecords,
          change
        );
      default:
        return true;
    }
  }

  protected _findRecordQueryExpressionMatchChange(
    expression: FindRecord,
    change: RecordChange
  ): boolean {
    return equalRecordIdentities(expression.record, change);
  }

  protected _findRecordsQueryExpressionMatchChange(
    expression: FindRecords,
    change: RecordChange
  ): boolean {
    if (expression.type) {
      return expression.type === change.type;
    } else if (expression.records) {
      for (let record of expression.records) {
        if (record.type === change.type) {
          return true;
        }
      }
      return false;
    }
    return true;
  }

  protected _findRelatedRecordQueryExpressionMatchChange(
    expression: FindRelatedRecord,
    change: RecordChange
  ): boolean {
    return (
      equalRecordIdentities(expression.record, change) &&
      (change.relationships.includes(expression.relationship) || change.remove)
    );
  }

  protected _findRelatedRecordsQueryExpressionMatchChange(
    expression: FindRelatedRecords,
    change: RecordChange
  ): boolean {
    const { type } = this.schema.getRelationship(
      expression.record.type,
      expression.relationship
    );

    if (Array.isArray(type) && type.find(type => type === change.type)) {
      return true;
    } else if (type === change.type) {
      return true;
    }

    return (
      equalRecordIdentities(expression.record, change) &&
      (change.relationships.includes(expression.relationship) || change.remove)
    );
  }
}

const nextTick = window.setImmediate || setTimeout;

function onceTick(fn: () => void) {
  return function tick() {
    if (!ticks.has(tick)) {
      ticks.add(tick);
      nextTick(() => {
        fn();
        cancelTick(tick);
      });
    }
  };
}

function cancelTick(tick: () => void) {
  ticks.delete(tick);
}

const ticks = new WeakSet();
