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
import { DEBUG } from '@glimmer/env';

import { BaseQueryOrTransformBuilder } from './base';
import {
  sourceQuery,
  cacheQuery,
  liveQuery,
  peekRelationMeta,
  peekRelationLinks,
  QueryableAndTransfomableSource
} from '../cache';
import { IdentityMap, ModelIdentity } from '../identity-map';
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

export class FilteredFindRelatedRecordsQueryOrTransformBuilder<
  T extends ModelIdentity
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
    const records = cacheQuery<T>(
      this.source.cache,
      this.toQueryExpression(),
      this.options
    ) as T[];

    if (DEBUG) {
      Object.freeze(records);
    }

    return records;
  }

  then<K = T[]>(
    onfullfiled?: null | ((value: any) => K | PromiseLike<K>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<K> {
    return sourceQuery<T>(this.source, this.toQueryExpression(), this.options)
      .then(records => {
        if (DEBUG) {
          Object.freeze(records);
        }

        return records as T[];
      })
      .then<K>(onfullfiled, onrejected);
  }
}

export class LiveFindRelatedRecordsQueryBuilder<T extends ModelIdentity>
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
}

export class FindRelatedRecordsQueryOrTransformBuilder<
  T extends ModelIdentity
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
