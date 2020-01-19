import {
  RecordIdentity,
  FindRelatedRecord,
  cloneRecordIdentity
} from '@orbit/data';

import {
  sourceQuery,
  cacheQuery,
  peekRelationMeta,
  peekRelationLinks,
  QueryableAndTransfomableSource
} from '../cache';
import { ModelIdentity } from '../identity-map';
import { BaseQueryOrTransformBuilder } from './base';
import { mergeOptions } from './utils';

export class FindRelatedRecordQueryOrTransformBuilder<T extends ModelIdentity>
  extends BaseQueryOrTransformBuilder
  implements PromiseLike<T> {
  expression: FindRelatedRecord;

  constructor(
    source: QueryableAndTransfomableSource,
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
      this.source.cache,
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

  get meta() {
    return peekRelationMeta(
      this.source.cache,
      this.expression.record,
      this.expression.relationship
    );
  }

  get links() {
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
