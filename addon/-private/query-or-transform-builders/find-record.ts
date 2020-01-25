import {
  RecordIdentity,
  FindRecord,
  cloneRecordIdentity,
  Record as OrbitRecord
} from '@orbit/data';

import Store from '../store';
import Model from '../model';
import { BaseQueryOrTransformBuilder } from './base';
import {
  sourceQuery,
  cacheQuery,
  peekRecordMeta,
  peekRecordLinks,
  peekRecordAttribute,
  peekRecord
} from '../cache';
import normalizeRecordProperties, {
  Properties
} from '../utils/normalize-record-properties';
import { mergeOptions } from './utils';
import { BatchQueryBuilder } from './batch';

export class FindRecordQueryOrTransformBuilder<T extends Model>
  extends BaseQueryOrTransformBuilder
  implements PromiseLike<T> {
  expression: FindRecord;

  constructor(source: Store, record: RecordIdentity, options?: object) {
    const expression: FindRecord = {
      op: 'findRecord',
      record: cloneRecordIdentity(record)
    };

    super(source, expression, options);
    this.expression = expression as FindRecord;
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

  reload(): Promise<T> {
    return sourceQuery(
      this.source,
      this.toQueryExpression(),
      mergeOptions(this.options, { reload: true })
    ) as Promise<T>;
  }

  merge<K extends Model = T>(
    ...queryBuilders: BaseQueryOrTransformBuilder[]
  ): BatchQueryBuilder<T | K> {
    return BatchQueryBuilder.merge<T | K>(this, ...queryBuilders);
  }

  value(): T | undefined {
    const record = this.raw();
    if (record) {
      return this.source.identityMap.lookup(record) as T;
    }
    return record;
  }

  raw(): OrbitRecord | undefined {
    return peekRecord(this.source.cache, this.expression.record);
  }

  attribute<T = unknown>(attribute: string): T {
    return peekRecordAttribute(
      this.source.cache,
      this.expression.record,
      attribute
    ) as T;
  }

  meta() {
    return peekRecordMeta(this.source.cache, this.expression.record);
  }

  links() {
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

    return this.source.identityMap.lookup<T>(record) as T;
  }

  unload(): void {
    this.source.identityMap.unload(this.expression.record);
  }
}
