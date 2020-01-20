import {
  RecordIdentity,
  FindRelatedRecords,
  cloneRecordIdentity,
  QueryExpression,
  FilterQBParam,
  PageQBParam,
  SortQBParam
} from '@orbit/data';
import { clone } from '@orbit/utils';

import { BaseQueryOrTransformBuilder } from './base';
import {
  sourceQuery,
  cacheQuery,
  liveQuery,
  peekRelationMeta,
  peekRelationLinks,
  QueryableAndTransfomableSource,
  peekRelatedRecords
} from '../cache';
import IdentityMap from '../identity-map';
import {
  mergeOptions,
  sortParamToSpecifier,
  filterParamToSpecifier,
  pageParamToSpecifier
} from './utils';
import normalizeRecordProperties, {
  Properties
} from '../utils/normalize-record-properties';
import LiveArray from '../live-array';
import { BatchQueryBuilder } from './batch';

export class FilteredFindRelatedRecordsQueryOrTransformBuilder<
  T extends RecordIdentity
> extends BaseQueryOrTransformBuilder implements PromiseLike<T[]> {
  expression: FindRelatedRecords;

  constructor(
    source: QueryableAndTransfomableSource,
    expression: QueryExpression,
    options?: object
  ) {
    super(source, expression, options);
    this.expression = expression as FindRelatedRecords;
  }

  live(): LiveFindRelatedRecordsQueryBuilder<T> {
    return new LiveFindRelatedRecordsQueryBuilder<T>(
      this.source,
      this.expression,
      this.options
    );
  }

  sort(
    ...params: SortQBParam[]
  ): FilteredFindRelatedRecordsQueryOrTransformBuilder<T> {
    const specifiers = params.map(sortParamToSpecifier);
    const expression: FindRelatedRecords = clone(this.expression);
    expression.sort = (expression.sort || []).concat(specifiers);
    return new FilteredFindRelatedRecordsQueryOrTransformBuilder<T>(
      this.source,
      expression,
      this.options
    );
  }

  page(
    param: PageQBParam
  ): FilteredFindRelatedRecordsQueryOrTransformBuilder<T> {
    const expression: FindRelatedRecords = clone(this.expression);
    expression.page = pageParamToSpecifier(param);
    return new FilteredFindRelatedRecordsQueryOrTransformBuilder<T>(
      this.source,
      expression,
      this.options
    );
  }

  filter(
    ...params: FilterQBParam[]
  ): FilteredFindRelatedRecordsQueryOrTransformBuilder<T> {
    const specifiers = params.map(filterParamToSpecifier);
    const expression: FindRelatedRecords = clone(this.expression);
    expression.filter = (expression.filter || []).concat(specifiers);
    return new FilteredFindRelatedRecordsQueryOrTransformBuilder<T>(
      this.source,
      expression,
      this.options
    );
  }

  unload() {
    const identifiers = this.source.cache.query(
      this.toQueryExpression(),
      this.options
    ) as RecordIdentity[];
    const identityMap = IdentityMap.for<T>(this.source.cache);

    for (let record of identifiers) {
      identityMap.unload(record);
    }
  }

  async update(properties: Properties, options?: object): Promise<void> {
    const identifiers = this.source.cache.query(
      this.toQueryExpression(),
      this.options
    ) as RecordIdentity[];

    const records = identifiers.map(identifier =>
      normalizeRecordProperties(this.source.schema, {
        ...properties,
        ...cloneRecordIdentity(identifier)
      })
    );

    await this.source.update(
      t => records.map(record => t.updateRecord(record)),
      mergeOptions(this.options, options)
    );
  }

  async remove(options?: object): Promise<void> {
    const identifiers = this.source.cache.query(
      this.toQueryExpression(),
      this.options
    ) as RecordIdentity[];

    await this.source.update(
      t => identifiers.map(identifier => t.removeRecord(identifier)),
      mergeOptions(this.options, options)
    );
  }

  peek(): T[] {
    return cacheQuery<T>(
      this.source.cache,
      this.toQueryExpression(),
      this.options
    ) as T[];
  }

  then<K = T[]>(
    onfullfiled?: null | ((value: any) => K | PromiseLike<K>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<K> {
    return sourceQuery<T>(
      this.source,
      this.toQueryExpression(),
      this.options
    ).then<K>(onfullfiled, onrejected);
  }

  reload(): Promise<T[]> {
    return sourceQuery(
      this.source,
      this.toQueryExpression(),
      mergeOptions(this.options, { reload: true })
    ) as Promise<T[]>;
  }

  merge<K extends RecordIdentity = T>(
    ...queryBuilders: BaseQueryOrTransformBuilder[]
  ): BatchQueryBuilder<T | K> {
    return BatchQueryBuilder.merge<T | K>(this, ...queryBuilders);
  }
}

export class LiveFindRelatedRecordsQueryBuilder<T extends RecordIdentity>
  extends BaseQueryOrTransformBuilder
  implements PromiseLike<LiveArray<T>> {
  expression: FindRelatedRecords;

  constructor(
    source: QueryableAndTransfomableSource,
    expression: QueryExpression,
    options?: object
  ) {
    super(source, expression, options);
    this.expression = expression as FindRelatedRecords;
  }

  sort(...params: SortQBParam[]): LiveFindRelatedRecordsQueryBuilder<T> {
    const specifiers = params.map(sortParamToSpecifier);
    const expression: FindRelatedRecords = clone(this.expression);
    expression.sort = (expression.sort || []).concat(specifiers);
    return new LiveFindRelatedRecordsQueryBuilder<T>(
      this.source,
      expression,
      this.options
    );
  }

  page(param: PageQBParam): LiveFindRelatedRecordsQueryBuilder<T> {
    const expression: FindRelatedRecords = clone(this.expression);
    expression.page = pageParamToSpecifier(param);
    return new LiveFindRelatedRecordsQueryBuilder<T>(
      this.source,
      expression,
      this.options
    );
  }

  filter(...params: FilterQBParam[]): LiveFindRelatedRecordsQueryBuilder<T> {
    const specifiers = params.map(filterParamToSpecifier);
    const expression: FindRelatedRecords = clone(this.expression);
    expression.filter = (expression.filter || []).concat(specifiers);
    return new LiveFindRelatedRecordsQueryBuilder<T>(
      this.source,
      expression,
      this.options
    );
  }

  peek(): LiveArray<T> {
    return liveQuery<T>(
      this.source.cache,
      this.toQueryExpression(),
      this.options
    );
  }

  then<K = LiveArray<T>>(
    onfullfiled?: null | ((value: any) => K | PromiseLike<K>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<K> {
    return sourceQuery(this.source, this.toQueryExpression(), this.options)
      .then(() => this.peek())
      .then<K>(onfullfiled, onrejected);
  }

  reload(): Promise<LiveArray<T>> {
    return sourceQuery(
      this.source,
      this.toQueryExpression(),
      mergeOptions(this.options, { reload: true })
    ).then(() => this.peek());
  }
}

export class FindRelatedRecordsQueryOrTransformBuilder<
  T extends RecordIdentity
> extends FilteredFindRelatedRecordsQueryOrTransformBuilder<T> {
  constructor(
    source: QueryableAndTransfomableSource,
    record: RecordIdentity,
    relationship: string,
    options?: object
  ) {
    const expression: FindRelatedRecords = {
      op: 'findRelatedRecords',
      record: cloneRecordIdentity(record),
      relationship
    };

    super(source, expression, options);
    this.expression = expression as FindRelatedRecords;
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

  value(): T[] | undefined {
    const record = peekRelatedRecords(
      this.source.cache,
      this.expression.record,
      this.expression.relationship
    );
    if (record) {
      return IdentityMap.for<T>(this.source.cache).lookup(record) as T[];
    }
    return record;
  }

  async add(record: RecordIdentity, options?: object): Promise<void> {
    await this.source.update(
      t =>
        t.addToRelatedRecords(
          this.expression.record,
          this.expression.relationship,
          cloneRecordIdentity(record)
        ),
      mergeOptions(this.options, options)
    );
  }

  async remove(record: RecordIdentity, options?: object): Promise<void> {
    await this.source.update(
      t =>
        t.removeFromRelatedRecords(
          this.expression.record,
          this.expression.relationship,
          cloneRecordIdentity(record)
        ),
      mergeOptions(this.options, options)
    );
  }

  async replace(records: RecordIdentity[], options?: object): Promise<void> {
    await this.source.update(
      t =>
        t.replaceRelatedRecords(
          this.expression.record,
          this.expression.relationship,
          records.map(record => cloneRecordIdentity(record))
        ),
      mergeOptions(this.options, options)
    );
  }
}
