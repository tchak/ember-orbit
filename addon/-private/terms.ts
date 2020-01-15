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
  FindRelatedRecords,
  ReplaceAttributeOperation
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
  protected _options?: object;

  constructor(store: Store, expression: QueryExpression, options?: object) {
    this.store = store;
    this.expression = expression;
    this._options = options;
  }

  toQueryExpression(): QueryExpression {
    return this.expression;
  }
}

export class RecordTerm<M extends Model> extends BaseTerm
  implements PromiseLike<M> {
  expression: FindRecord;

  constructor(store: Store, expression: QueryExpression, options?: object) {
    super(store, expression, options);
    this.expression = expression as FindRecord;
  }

  peek(): M {
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

export class RootRecordTerm<M extends Model> extends RecordTerm<M> {
  constructor(store: Store, record: RecordIdentity, options?: object) {
    const expression: FindRecord = {
      op: 'findRecord',
      record: cloneRecordIdentity(record)
    };

    super(store, expression, options);
  }

  options(options: object): RootRecordTerm<M> {
    return new RootRecordTerm<M>(
      this.store,
      this.expression.record,
      mergeOptions(this._options, options)
    );
  }

  get meta() {
    const record = this.store.cache.raw(this.expression.record);
    if (record) {
      return record.meta;
    }
    return undefined;
  }

  get links() {
    const record = this.store.cache.raw(this.expression.record);
    if (record) {
      return record.links;
    }
    return undefined;
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

export class RecordsTerm<M extends Model> extends BaseTerm
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

  live(): LiveRecordsTerm<M> {
    return new LiveRecordsTerm<M>(this.store, this.expression, this._options);
  }

  sort(...params: SortQBParam[]): RecordsTerm<M> {
    const specifiers = params.map(sortParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.sort = (expression.sort || []).concat(specifiers);
    return new RecordsTerm<M>(this.store, expression, this._options);
  }

  page(param: PageQBParam): RecordsTerm<M> {
    const expression: FindRecords = clone(this.expression);
    expression.page = pageParamToSpecifier(param);
    return new RecordsTerm<M>(this.store, expression, this._options);
  }

  filter(...params: FilterQBParam[]): RecordsTerm<M> {
    const specifiers = params.map(filterParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.filter = (expression.filter || []).concat(specifiers);
    return new RecordsTerm<M>(this.store, expression, this._options);
  }

  peek(): M[] {
    const records = this.store.cache.query(
      this.toQueryExpression(),
      this._options
    );

    if (DEBUG) {
      Object.freeze(records);
    }

    return records as M[];
  }

  then<T = M[]>(
    onfullfiled?: null | ((value: any) => T | PromiseLike<T>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<T> {
    return this.store
      .query(this.toQueryExpression(), this._options)
      .then(records => {
        if (DEBUG) {
          Object.freeze(records);
        }

        return records as M[];
      })
      .then<T>(onfullfiled, onrejected);
  }
}

export class LiveRecordsTerm<M extends Model> extends BaseTerm
  implements PromiseLike<LiveArray<M>> {
  expression: FindRecords;

  constructor(store: Store, expression: QueryExpression, options?: object) {
    super(store, expression, options);
    this.expression = expression as FindRecords;
  }

  options(options: object): LiveRecordsTerm<M> {
    return new LiveRecordsTerm<M>(
      this.store,
      this.expression,
      mergeOptions(this._options, options)
    );
  }

  sort(...params: SortQBParam[]): LiveRecordsTerm<M> {
    const specifiers = params.map(sortParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.sort = (expression.sort || []).concat(specifiers);
    return new LiveRecordsTerm<M>(this.store, expression, this._options);
  }

  page(param: PageQBParam): LiveRecordsTerm<M> {
    const expression: FindRecords = clone(this.expression);
    expression.page = pageParamToSpecifier(param);
    return new LiveRecordsTerm<M>(this.store, expression, this._options);
  }

  filter(...params: FilterQBParam[]): LiveRecordsTerm<M> {
    const specifiers = params.map(filterParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.filter = (expression.filter || []).concat(specifiers);
    return new LiveRecordsTerm<M>(this.store, expression, this._options);
  }

  peek(): LiveArray<M> {
    return this.store.cache.liveQuery<M>(
      this.toQueryExpression(),
      this._options
    );
  }

  then<T = LiveArray<M>>(
    onfullfiled?: null | ((value: any) => T | PromiseLike<T>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<T> {
    return this.store
      .query(this.toQueryExpression(), this._options)
      .then(() => this.peek())
      .then<T>(onfullfiled, onrejected);
  }
}

export class RootRecordsTerm<M extends Model> extends RecordsTerm<M> {
  constructor(
    store: Store,
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

    super(store, expression, options);
  }

  options(options: object): RootRecordsTerm<M> {
    return new RootRecordsTerm<M>(
      this.store,
      this.expression.type ? this.expression.type : this.expression.records,
      mergeOptions(this._options, options)
    );
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

export class RelatedRecordTerm<M extends Model> extends BaseTerm
  implements PromiseLike<M> {
  expression: FindRelatedRecord;

  constructor(store: Store, expression: QueryExpression, options?: object) {
    super(store, expression, options);
    this.expression = expression as FindRelatedRecord;
  }

  options(options: object): RelatedRecordTerm<M> {
    return new RelatedRecordTerm<M>(
      this.store,
      this.expression,
      mergeOptions(this._options, options)
    );
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
}

export class RootRelatedRecordTerm<
  M extends Model = Model
> extends RelatedRecordTerm<M> {
  constructor(
    store: Store,
    record: RecordIdentity,
    relationship: string,
    options?: object
  ) {
    const expression: FindRelatedRecord = {
      op: 'findRelatedRecord',
      record: cloneRecordIdentity(record),
      relationship
    };

    super(store, expression, options);
  }

  options(options: object): RootRelatedRecordTerm<M> {
    return new RootRelatedRecordTerm<M>(
      this.store,
      this.expression.record,
      this.expression.relationship,
      mergeOptions(this._options, options)
    );
  }

  get value() {
    return (
      this.store.cache.relatedRecord(
        this.expression.record,
        this.expression.relationship
      ) || null
    );
  }

  get meta() {
    const record = this.store.cache.raw(this.expression.record);
    if (record) {
      return deepGet(record, [
        'relationships',
        this.expression.relationship,
        'meta'
      ]);
    }
    return undefined;
  }

  get links() {
    const record = this.store.cache.raw(this.expression.record);
    if (record) {
      return deepGet(record, [
        'relationships',
        this.expression.relationship,
        'links'
      ]);
    }
    return undefined;
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

export class RelatedRecordsTerm<M extends Model> extends BaseTerm
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

  live(): LiveRelatedRecordsTerm<M> {
    return new LiveRelatedRecordsTerm<M>(
      this.store,
      this.expression,
      this._options
    );
  }

  sort(...params: SortQBParam[]): RecordsTerm<M> {
    const specifiers = params.map(sortParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.sort = (expression.sort || []).concat(specifiers);
    return new RecordsTerm<M>(this.store, expression, this._options);
  }

  page(param: PageQBParam): RecordsTerm<M> {
    const expression: FindRecords = clone(this.expression);
    expression.page = pageParamToSpecifier(param);
    return new RecordsTerm<M>(this.store, expression, this._options);
  }

  filter(...params: FilterQBParam[]): RecordsTerm<M> {
    const specifiers = params.map(filterParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.filter = (expression.filter || []).concat(specifiers);
    return new RecordsTerm<M>(this.store, expression, this._options);
  }

  peek(): M[] {
    const records = this.store.cache.query(
      this.toQueryExpression(),
      this._options
    );

    if (DEBUG) {
      Object.freeze(records);
    }

    return records as M[];
  }

  then<T = M[]>(
    onfullfiled?: null | ((value: any) => T | PromiseLike<T>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<T> {
    return this.store
      .query(this.toQueryExpression(), this._options)
      .then(records => {
        if (DEBUG) {
          Object.freeze(records);
        }

        return records as M[];
      })
      .then<T>(onfullfiled, onrejected);
  }
}

export class LiveRelatedRecordsTerm<M extends Model> extends BaseTerm
  implements PromiseLike<LiveArray<M>> {
  expression: FindRelatedRecords;

  constructor(store: Store, expression: QueryExpression, options?: object) {
    super(store, expression, options);
    this.expression = expression as FindRelatedRecords;
  }

  options(options: object): LiveRelatedRecordsTerm<M> {
    return new LiveRelatedRecordsTerm<M>(
      this.store,
      this.expression,
      mergeOptions(this._options, options)
    );
  }

  sort(...params: SortQBParam[]): LiveRelatedRecordsTerm<M> {
    const specifiers = params.map(sortParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.sort = (expression.sort || []).concat(specifiers);
    return new LiveRelatedRecordsTerm<M>(this.store, expression, this._options);
  }

  page(param: PageQBParam): LiveRelatedRecordsTerm<M> {
    const expression: FindRecords = clone(this.expression);
    expression.page = pageParamToSpecifier(param);
    return new LiveRelatedRecordsTerm<M>(this.store, expression, this._options);
  }

  filter(...params: FilterQBParam[]): LiveRelatedRecordsTerm<M> {
    const specifiers = params.map(filterParamToSpecifier);
    const expression: FindRecords = clone(this.expression);
    expression.filter = (expression.filter || []).concat(specifiers);
    return new LiveRelatedRecordsTerm<M>(this.store, expression, this._options);
  }

  peek(): LiveArray<M> {
    return this.store.cache.liveQuery<M>(
      this.toQueryExpression(),
      this._options
    );
  }

  then<T = LiveArray<M>>(
    onfullfiled?: null | ((value: any) => T | PromiseLike<T>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<T> {
    return this.store
      .query(this.toQueryExpression(), this._options)
      .then(() => this.peek())
      .then<T>(onfullfiled, onrejected);
  }
}

export class RootRelatedRecordsTerm<M extends Model> extends RelatedRecordsTerm<
  M
> {
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

  options(options: object): RootRelatedRecordsTerm<M> {
    return new RootRelatedRecordsTerm<M>(
      this.store,
      this.expression.record,
      this.expression.relationship,
      mergeOptions(this._options, options)
    );
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

  get meta() {
    const record = this.store.cache.raw(this.expression.record);
    if (record) {
      return deepGet(record, [
        'relationships',
        this.expression.relationship,
        'meta'
      ]);
    }
    return undefined;
  }

  get links() {
    const record = this.store.cache.raw(this.expression.record);
    if (record) {
      return deepGet(record, [
        'relationships',
        this.expression.relationship,
        'links'
      ]);
    }
    return undefined;
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

export class AttributeTerm {
  store: Store;
  operation: ReplaceAttributeOperation;
  protected _options?: object;

  constructor(
    store: Store,
    operation: ReplaceAttributeOperation,
    options?: object
  ) {
    this.store = store;
    this.operation = operation;
    this._options = options;
  }

  options(options: object): AttributeTerm {
    return new AttributeTerm(
      this.store,
      this.operation,
      mergeOptions(this._options, options)
    );
  }

  async replace(value: unknown, options?: object) {
    await this.store.update(
      Object.assign({}, this.operation, { value }),
      mergeOptions(this._options, options)
    );
  }
}

export class RootAttributeTerm extends AttributeTerm {
  constructor(
    store: Store,
    record: RecordIdentity,
    attribute: string,
    options?: object
  ) {
    const operation: ReplaceAttributeOperation = {
      op: 'replaceAttribute',
      record: cloneRecordIdentity(record),
      attribute,
      value: undefined
    };

    super(store, operation, options);
  }

  get value() {
    const record = this.store.cache.raw(this.operation.record);
    return record && deepGet(record, ['attributes', this.operation.attribute]);
  }
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
