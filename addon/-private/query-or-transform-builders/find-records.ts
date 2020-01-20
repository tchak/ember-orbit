import {
  RecordIdentity,
  FindRecords,
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
  QueryableAndTransfomableSource
} from '../cache';
import IdentityMap, { ModelIdentity } from '../identity-map';
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

export class FilteredFindRecordsQueryOrTransformBuilder<T extends ModelIdentity>
  extends BaseQueryOrTransformBuilder
  implements PromiseLike<T[]> {
  expression: FindRecords;

  constructor(
    source: QueryableAndTransfomableSource,
    expression: QueryExpression,
    options?: object
  ) {
    super(source, expression, options);
    this.expression = expression as FindRecords;
  }

  live(): LiveFindRecordsQueryBuilder<T> {
    return new LiveFindRecordsQueryBuilder<T>(
      this.source,
      this.expression,
      this.options
    );
  }

  sort(
    ...params: SortQBParam[]
  ): FilteredFindRecordsQueryOrTransformBuilder<T> {
    const specifiers = params.map(sortParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.sort = (expression.sort || []).concat(specifiers);
    return new FilteredFindRecordsQueryOrTransformBuilder<T>(
      this.source,
      expression,
      this.options
    );
  }

  page(param: PageQBParam): FilteredFindRecordsQueryOrTransformBuilder<T> {
    const expression: FindRecords = clone(this.expression);
    expression.page = pageParamToSpecifier(param);
    return new FilteredFindRecordsQueryOrTransformBuilder<T>(
      this.source,
      expression,
      this.options
    );
  }

  filter(
    ...params: FilterQBParam[]
  ): FilteredFindRecordsQueryOrTransformBuilder<T> {
    const specifiers = params.map(filterParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.filter = (expression.filter || []).concat(specifiers);
    return new FilteredFindRecordsQueryOrTransformBuilder<T>(
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

  merge<K extends ModelIdentity = T>(
    ...queryBuilders: BaseQueryOrTransformBuilder[]
  ): BatchQueryBuilder<T | K> {
    return BatchQueryBuilder.merge<T | K>(this, ...queryBuilders);
  }
}

export class LiveFindRecordsQueryBuilder<T extends ModelIdentity>
  extends BaseQueryOrTransformBuilder
  implements PromiseLike<LiveArray<T>> {
  expression: FindRecords;

  constructor(
    source: QueryableAndTransfomableSource,
    expression: QueryExpression,
    options?: object
  ) {
    super(source, expression, options);
    this.expression = expression as FindRecords;
  }

  sort(...params: SortQBParam[]): LiveFindRecordsQueryBuilder<T> {
    const specifiers = params.map(sortParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.sort = (expression.sort || []).concat(specifiers);
    return new LiveFindRecordsQueryBuilder<T>(
      this.source,
      expression,
      this.options
    );
  }

  page(param: PageQBParam): LiveFindRecordsQueryBuilder<T> {
    const expression: FindRecords = clone(this.expression);
    expression.page = pageParamToSpecifier(param);
    return new LiveFindRecordsQueryBuilder<T>(
      this.source,
      expression,
      this.options
    );
  }

  filter(...params: FilterQBParam[]): LiveFindRecordsQueryBuilder<T> {
    const specifiers = params.map(filterParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.filter = (expression.filter || []).concat(specifiers);
    return new LiveFindRecordsQueryBuilder<T>(
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

export class FindRecordsQueryOrTransformBuilder<
  T extends ModelIdentity
> extends FilteredFindRecordsQueryOrTransformBuilder<T> {
  constructor(
    source: QueryableAndTransfomableSource,
    typeOrIdentities?: string | RecordIdentity[],
    options?: object
  ) {
    const expression: FindRecords = {
      op: 'findRecords'
    };

    if (typeof typeOrIdentities === 'string') {
      expression.type = typeOrIdentities;
    } else if (Array.isArray(typeOrIdentities)) {
      expression.records = typeOrIdentities;
    }

    super(source, expression, options);
  }

  async add(properties: Properties = {}, options?: object) {
    properties.type = this.expression.type;
    const record = normalizeRecordProperties(this.source.schema, properties);

    await this.source.update(
      t => t.addRecord(record),
      mergeOptions(this.options, options)
    );

    return IdentityMap.for<T>(this.source.cache).lookup(record) as T;
  }
}
