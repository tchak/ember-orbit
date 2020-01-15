import { DEBUG } from '@glimmer/env';
import {
  RecordIdentity,
  QueryExpression,
  FindRecord,
  FindRecords,
  FilterQBParam,
  cloneRecordIdentity,
  FilterSpecifier,
  RelatedRecordFilterQBParam,
  RelatedRecordFilterSpecifier,
  RelatedRecordsFilterQBParam,
  RelatedRecordsFilterSpecifier,
  AttributeFilterQBParam,
  PageSpecifier,
  PageQBParam,
  AttributeFilterSpecifier,
  SortQBParam,
  SortSpecifier,
  AttributeSortQBParam,
  AttributeSortSpecifier,
  SortOrder,
  FindRelatedRecord,
  FindRelatedRecords
} from '@orbit/data';
import { deepMerge, clone, isObject, deepGet } from '@orbit/utils';

import Store from '../services/store';
import Model from './model';
import LiveArray from './live-array';
import normalizeRecordProperties, {
  Properties
} from './utils/normalize-record-properties';

export class BaseTerm {
  store: Store;
  expression: QueryExpression;
  _options?: object;

  constructor(store: Store, expression: QueryExpression, options?: object) {
    this.store = store;
    this.expression = expression;
    this._options = options;
  }

  toQueryExpression(): QueryExpression {
    return this.expression;
  }
}

export class RecordTerm<M extends Model = Model> extends BaseTerm
  implements PromiseLike<M> {
  expression: FindRecord;

  constructor(store: Store, expression: QueryExpression, options?: object) {
    super(store, expression, options);
    this.expression = expression as FindRecord;
  }

  peek(): M | undefined {
    return this.store.cache.query(this.toQueryExpression(), this._options) as M;
  }

  then<T = M>(
    onfullfiled?: null | ((value: any) => T | PromiseLike<T>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<T> {
    return this.store
      .query(this.toQueryExpression(), this._options)
      .then<T>(onfullfiled, onrejected);
  }

  options(options: object): RecordTerm<M> {
    return new RecordTerm<M>(
      this.store,
      this.expression,
      mergeOptions(this._options, options)
    );
  }
}

export class MutableRecordTerm<M extends Model = Model> extends RecordTerm<M> {
  constructor(store: Store, record: RecordIdentity, options?: object) {
    let expression: FindRecord = {
      op: 'findRecord',
      record: cloneRecordIdentity(record)
    };

    super(store, expression, options);
  }

  async remove(options?: object): Promise<void> {
    await this.store.update(
      t => t.removeRecord(this.expression.record),
      mergeOptions(this._options, options)
    );
  }

  async update(properties: Properties, options?: object): Promise<M> {
    const record = normalizeRecordProperties(this.store.schema, {
      ...properties,
      ...cloneRecordIdentity(this.expression.record)
    });

    await this.store.update(
      t => t.updateRecord(record),
      mergeOptions(this._options, options)
    );

    return this.store.cache.lookup(record) as M;
  }
}

// RecordsTerm

export class RecordsTerm<M extends Model = Model> extends BaseTerm
  implements PromiseLike<M[]> {
  expression: FindRecords;

  constructor(store: Store, expression: QueryExpression, options?: object) {
    super(store, expression, options);
    this.expression = expression as FindRecords;
  }

  options(options: object): RecordsTerm<M> {
    return new RecordsTerm<M>(
      this.store,
      this.expression,
      mergeOptions(this._options, options)
    );
  }

  live(): RecordsTerm<M> {
    const options = mergeOptions(this._options, {
      source: { cache: { live: true } }
    });
    return new RecordsTerm<M>(this.store, this.expression, options);
  }

  sort(...params: SortQBParam[]): RecordsTerm<M> {
    const specifiers = params.map(sortParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.sort = (expression.sort || []).concat(specifiers);
    return new RecordsTerm<M>(this.store, expression);
  }

  page(param: PageQBParam): RecordsTerm<M> {
    const expression: FindRecords = clone(this.expression);
    expression.page = pageParamToSpecifier(param);
    return new RecordsTerm<M>(this.store, expression);
  }

  filter(...params: FilterQBParam[]): RecordsTerm<M> {
    const specifiers = params.map(filterParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.filter = (expression.filter || []).concat(specifiers);
    return new RecordsTerm<M>(this.store, expression);
  }

  peek(): M[] | LiveArray<M> {
    if (isLive(this._options)) {
      return this.store.cache.liveQuery<M>(
        this.toQueryExpression(),
        this._options
      );
    }

    return this.store.cache.query(
      this.toQueryExpression(),
      this._options
    ) as M[];
  }

  then<T = M[]>(
    onfullfiled?: null | ((value: any) => T | PromiseLike<T>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<T> {
    return this.store
      .query(this.toQueryExpression(), this._options)
      .then(result => {
        if (isLive(this._options)) {
          return this.peek();
        }
        return result as M[];
      })
      .then<T>(onfullfiled, onrejected);
  }
}

export class MutableRecordsTerm<M extends Model = Model> extends RecordsTerm {
  constructor(
    store: Store,
    typeOrIdentities?: string | RecordIdentity[],
    options?: object
  ) {
    let expression: FindRecords = {
      op: 'findRecords'
    };

    if (typeof typeOrIdentities === 'string') {
      expression.type = typeOrIdentities;
    } else if (Array.isArray(typeOrIdentities)) {
      expression.records = typeOrIdentities;
    }

    super(store, expression, options);
  }

  async add(properties: Properties = {}, options?: object) {
    properties.type = this.expression.type;
    const record = normalizeRecordProperties(this.store.schema, properties);

    await this.store.update(
      t => t.addRecord(record),
      mergeOptions(this._options, options)
    );

    return this.store.cache.lookup(record) as M;
  }
}

// RelatedRecordTerm

export class RelatedRecordTerm<M extends Model = Model> extends BaseTerm
  implements PromiseLike<M> {
  expression: FindRelatedRecord;

  constructor(store: Store, expression: QueryExpression, options?: object) {
    super(store, expression, options);
    this.expression = expression as FindRelatedRecord;
  }

  peek(): M | null | undefined {
    return this.store.cache.query(
      this.toQueryExpression(),
      this._options
    ) as M | null;
  }

  then<T = M>(
    onfullfiled?: null | ((value: any) => T | PromiseLike<T>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<T> {
    return this.store
      .query(this.toQueryExpression(), this._options)
      .then<T>(onfullfiled, onrejected);
  }

  options(options: object): RelatedRecordTerm<M> {
    return new RelatedRecordTerm<M>(
      this.store,
      this.expression,
      mergeOptions(this._options, options)
    );
  }
}

export class MutableRelatedRecordTerm<
  M extends Model = Model
> extends RelatedRecordTerm<M> {
  constructor(
    store: Store,
    record: RecordIdentity,
    relationship: string,
    options?: object
  ) {
    let expression: FindRelatedRecord = {
      op: 'findRelatedRecord',
      record: cloneRecordIdentity(record),
      relationship
    };

    super(store, expression, options);
  }

  get value() {
    return (
      this.store.cache.relatedRecord(
        this.expression.record,
        this.expression.relationship
      ) || null
    );
  }

  async replace(
    record: RecordIdentity | null,
    options?: object
  ): Promise<void> {
    await this.store.update(
      t =>
        t.replaceRelatedRecord(
          this.expression.record,
          this.expression.relationship,
          record ? cloneRecordIdentity(record) : null
        ),
      mergeOptions(this._options, options)
    );
  }
}

// RelatedRecordsTerm

export class RelatedRecordsTerm<M extends Model = Model> extends BaseTerm
  implements PromiseLike<M[]> {
  expression: FindRelatedRecords;

  constructor(store: Store, expression: QueryExpression, options?: object) {
    super(store, expression, options);
    this.expression = expression as FindRelatedRecords;
  }

  options(options: object): RelatedRecordsTerm<M> {
    return new RelatedRecordsTerm<M>(
      this.store,
      this.expression,
      mergeOptions(this._options, options)
    );
  }

  live(): RelatedRecordsTerm<M> {
    const options = mergeOptions(this._options, {
      source: { cache: { live: true } }
    });
    return new RelatedRecordsTerm<M>(this.store, this.expression, options);
  }

  sort(...params: SortQBParam[]): RecordsTerm<M> {
    const specifiers = params.map(sortParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.sort = (expression.sort || []).concat(specifiers);
    return new RecordsTerm<M>(this.store, expression);
  }

  page(param: PageQBParam): RecordsTerm<M> {
    const expression: FindRecords = clone(this.expression);
    expression.page = pageParamToSpecifier(param);
    return new RecordsTerm<M>(this.store, expression);
  }

  filter(...params: FilterQBParam[]): RecordsTerm<M> {
    const specifiers = params.map(filterParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.filter = (expression.filter || []).concat(specifiers);
    return new RecordsTerm<M>(this.store, expression);
  }

  peek(): M[] | LiveArray<M> {
    if (isLive(this._options)) {
      return this.store.cache.liveQuery<M>(
        this.toQueryExpression(),
        this._options
      );
    }

    return this.store.cache.query(
      this.toQueryExpression(),
      this._options
    ) as M[];
  }

  then<T = M[]>(
    onfullfiled?: null | ((value: any) => T | PromiseLike<T>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<T> {
    return this.store
      .query(this.toQueryExpression(), this._options)
      .then(result => {
        if (isLive(this._options)) {
          return this.peek();
        }
        return result as M[];
      })
      .then<T>(onfullfiled, onrejected);
  }
}

export class MutableRelatedRecordsTerm<
  M extends Model = Model
> extends RelatedRecordsTerm<M> {
  constructor(
    store: Store,
    record: RecordIdentity,
    relationship: string,
    options?: object
  ) {
    const expression: FindRelatedRecords = {
      op: 'findRelatedRecords',
      record: cloneRecordIdentity(record),
      relationship
    };

    super(store, expression, options);
  }

  get value(): M[] {
    const records =
      this.store.cache.relatedRecords(
        this.expression.record,
        this.expression.relationship
      ) || [];

    if (DEBUG) {
      Object.freeze(records);
    }

    return records as M[];
  }

  async add(record: RecordIdentity, options?: object): Promise<void> {
    await this.store.update(
      t =>
        t.addToRelatedRecords(
          this.expression.record,
          this.expression.relationship,
          cloneRecordIdentity(record)
        ),
      mergeOptions(this._options, options)
    );
  }

  async remove(record: RecordIdentity, options?: object): Promise<void> {
    await this.store.update(
      t =>
        t.removeFromRelatedRecords(
          this.expression.record,
          this.expression.relationship,
          cloneRecordIdentity(record)
        ),
      mergeOptions(this._options, options)
    );
  }

  async replace(records: RecordIdentity[], options?: object): Promise<void> {
    await this.store.update(
      t =>
        t.replaceRelatedRecords(
          this.expression.record,
          this.expression.relationship,
          records.map(record => cloneRecordIdentity(record))
        ),
      mergeOptions(this._options, options)
    );
  }
}

function isLive(options?: object): boolean {
  return !!options && !!deepGet(options, ['source', 'cache', 'live']);
}

function mergeOptions(
  options?: object,
  newOptions?: object
): object | undefined {
  if (options) {
    if (newOptions) {
      return deepMerge(clone(options), newOptions);
    }
    return clone(options);
  }
  return undefined;
}

function hasOwnProperty(obj: any, property: string) {
  return Object.prototype.hasOwnProperty.call(obj, property);
}

function filterParamToSpecifier(param: FilterQBParam): FilterSpecifier {
  if (hasOwnProperty(param, 'kind')) {
    return param as FilterSpecifier;
  }
  const op = param.op || 'equal';
  if (hasOwnProperty(param, 'relation')) {
    if (hasOwnProperty(param, 'record')) {
      return {
        kind: 'relatedRecord',
        op,
        relation: (param as RelatedRecordFilterQBParam).relation,
        record: (param as RelatedRecordFilterQBParam).record
      } as RelatedRecordFilterSpecifier;
    } else if (hasOwnProperty(param, 'records')) {
      return {
        kind: 'relatedRecords',
        op,
        relation: (param as RelatedRecordsFilterQBParam).relation,
        records: (param as RelatedRecordsFilterQBParam).records
      } as RelatedRecordsFilterSpecifier;
    }
  } else if (hasOwnProperty(param, 'attribute')) {
    return {
      kind: 'attribute',
      op,
      attribute: (param as AttributeFilterQBParam).attribute,
      value: (param as AttributeFilterQBParam).value
    } as AttributeFilterSpecifier;
  }
  throw new Error('Unrecognized filter param.');
}

function pageParamToSpecifier(param: PageQBParam): PageSpecifier {
  if (hasOwnProperty(param, 'offset') || hasOwnProperty(param, 'limit')) {
    return {
      kind: 'offsetLimit',
      offset: param.offset,
      limit: param.limit
    };
  }
  throw new Error('Unrecognized page param.');
}

function sortParamToSpecifier(param: SortQBParam): SortSpecifier {
  if (isObject(param)) {
    if (hasOwnProperty(param, 'kind')) {
      return param as SortSpecifier;
    } else if (hasOwnProperty(param, 'attribute')) {
      return {
        kind: 'attribute',
        attribute: (param as AttributeSortQBParam).attribute,
        order: (param as AttributeSortQBParam).order || 'ascending'
      } as AttributeSortSpecifier;
    }
  } else if (typeof param === 'string') {
    return parseSortParamString(param);
  }
  throw new Error('Unrecognized sort param.');
}

function parseSortParamString(sortSpecifier: string): AttributeSortSpecifier {
  let attribute: string;
  let order: SortOrder;

  if (sortSpecifier[0] === '-') {
    attribute = sortSpecifier.slice(1);
    order = 'descending';
  } else {
    attribute = sortSpecifier;
    order = 'ascending';
  }

  return {
    kind: 'attribute',
    attribute,
    order
  };
}
