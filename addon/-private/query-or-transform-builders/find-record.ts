import { RecordIdentity, FindRecord, cloneRecordIdentity } from '@orbit/data';

import { BaseQueryOrTransformBuilder } from './base';
import {
  sourceQuery,
  cacheQuery,
  peekRecordMeta,
  peekRecordLinks,
  QueryableAndTransfomableSource
} from '../cache';
import { IdentityMap, ModelIdentity } from '../identity-map';
import normalizeRecordProperties, {
  Properties
} from '../utils/normalize-record-properties';
import { mergeOptions } from './utils';

export class FindRecordQueryOrTransformBuilder<T extends ModelIdentity>
  extends BaseQueryOrTransformBuilder
  implements PromiseLike<T> {
  expression: FindRecord;

  constructor(
    source: QueryableAndTransfomableSource,
    record: RecordIdentity,
    options?: object
  ) {
    const expression: FindRecord = {
      op: 'findRecord',
      record: cloneRecordIdentity(record)
    };

    super(source, expression, options);
    this.expression = expression as FindRecord;
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
    return peekRecordMeta(this.source.cache, this.expression.record);
  }

  get links() {
    return peekRecordLinks(this.source.cache, this.expression.record);
  }

  async remove(options?: object): Promise<void> {
    await this.source.update(
      t => t.removeRecord(this.expression.record),
      mergeOptions(this.options, options)
    );
  }

  async update(properties: Properties, options?: object): Promise<T> {
    const record = normalizeRecordProperties(this.source.schema, {
      ...properties,
      ...cloneRecordIdentity(this.expression.record)
    });

    await this.source.update(
      t => t.updateRecord(record),
      mergeOptions(this.options, options)
    );

    return IdentityMap.for<T>(this.source.cache).lookup(record) as T;
  }

  unload() {
    IdentityMap.for<T>(this.source.cache).unload(this.expression.record);
  }
}
