import {
  RecordIdentity,
  FindRelatedRecord,
  cloneRecordIdentity
} from '@orbit/data';

import Store from '../store';
import Model from '../model';
import {
  sourceQuery,
  cacheQuery,
  peekRelationMeta,
  peekRelationLinks,
  peekRelatedRecord
} from '../cache';
import { BaseQueryOrTransformBuilder } from './base';
import { mergeOptions } from './utils';
import { BatchQueryBuilder } from './batch';

export class FindRelatedRecordQueryOrTransformBuilder<T extends Model>
  extends BaseQueryOrTransformBuilder
  implements PromiseLike<T> {
  expression: FindRelatedRecord;

  constructor(
    source: Store,
    record: RecordIdentity,
    relationship: string,
    options?: object
  ) {
    const expression: FindRelatedRecord = {
      op: 'findRelatedRecord',
      record: cloneRecordIdentity(record),
      relationship
    };

    super(source, expression, options);
    this.expression = expression as FindRelatedRecord;
  }

  peek(): T {
    return cacheQuery<T>(
      this.source,
      this.toQueryExpression(),
      this.options
    ) as T;
  }

  then<T>(
    onfullfiled?: null | ((value: any) => T | PromiseLike<T>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<T> {
    return sourceQuery(
      this.source,
      this.toQueryExpression(),
      this.options
    ).then<T>(onfullfiled, onrejected);
  }

  reload(): Promise<T | null> {
    return sourceQuery(
      this.source,
      this.toQueryExpression(),
      mergeOptions(this.options, { reload: true })
    ) as Promise<T | null>;
  }

  merge<K extends Model = T>(
    ...queryBuilders: BaseQueryOrTransformBuilder[]
  ): BatchQueryBuilder<T | K> {
    return BatchQueryBuilder.merge<T | K>(this, ...queryBuilders);
  }

  value(): T | null | undefined {
    const record = peekRelatedRecord(
      this.source.cache,
      this.expression.record,
      this.expression.relationship
    );
    if (record) {
      return this.source.identityMap.lookup<T>(record) as T | null;
    }
    return record;
  }

  meta() {
    return peekRelationMeta(
      this.source.cache,
      this.expression.record,
      this.expression.relationship
    );
  }

  links() {
    return peekRelationLinks(
      this.source.cache,
      this.expression.record,
      this.expression.relationship
    );
  }

  async replace(
    record: RecordIdentity | null,
    options?: object
  ): Promise<void> {
    await this.source.update(
      t =>
        t.replaceRelatedRecord(
          this.expression.record,
          this.expression.relationship,
          record ? cloneRecordIdentity(record) : null
        ),
      mergeOptions(this.options, options)
    );
  }
}
