import { getOwner, setOwner } from '@ember/application';

import { Log, TaskQueue, Listener } from '@orbit/core';
import {
  buildQuery,
  QueryOrExpressions,
  RecordIdentity,
  Transform,
  TransformOrOperations,
  cloneRecordIdentity,
  RecordOperation,
  Schema,
  TransformBuilder
} from '@orbit/data';
import MemorySource, { MemorySourceMergeOptions } from '@orbit/memory';

import Cache from './cache';
import Model from './model';
import ModelFactory from './model-factory';
import normalizeRecordProperties, {
  Properties
} from './utils/normalize-record-properties';
import {
  FindRecordQueryBuilder,
  FindRecordsQueryBuilder,
  FindRelatedRecordQueryBuilder,
  FindRelatedRecordsQueryBuilder
} from './query-builders';

export interface StoreSettings {
  source: MemorySource;
}

export default class Store {
  private _source: MemorySource;
  private _cache: Cache;

  static create(injections: StoreSettings): Store {
    const owner = getOwner(injections);
    const store = new this(injections);
    setOwner(store, owner);
    return store;
  }

  constructor(settings: StoreSettings) {
    this._source = settings.source;

    this._cache = new Cache({
      sourceCache: this.source.cache,
      modelFactory: new ModelFactory(this)
    });
  }

  destroy() {
    this._cache.destroy();
    delete this._source;
    delete this._cache;
  }

  get source(): MemorySource {
    return this._source;
  }

  get cache(): Cache {
    return this._cache;
  }

  get transformBuilder(): TransformBuilder {
    return this._source.transformBuilder;
  }

  get schema(): Schema {
    return this.source.schema;
  }

  get transformLog(): Log {
    return this.source.transformLog;
  }

  get requestQueue(): TaskQueue {
    return this.source.requestQueue;
  }

  get syncQueue(): TaskQueue {
    return this.source.syncQueue;
  }

  fork(): Store {
    const forkedSource = this.source.fork();
    const injections = getOwner(this).ownerInjection();

    return Store.create({ ...injections, source: forkedSource });
  }

  merge(forkedStore: Store, options?: MemorySourceMergeOptions): Promise<void> {
    return this.source.merge(forkedStore.source, options);
  }

  rollback(transformId: string, relativePosition?: number): Promise<void> {
    return this.source.rollback(transformId, relativePosition);
  }

  rebase(): void {
    this.source.rebase();
  }

  async query(
    queryOrExpressions: QueryOrExpressions,
    options?: object,
    id?: string
  ): Promise<any> {
    const query = buildQuery(
      queryOrExpressions,
      options,
      id,
      this.source.queryBuilder
    );
    const result = await this.source.query(query);
    return this.cache.lookup(result, query.expressions.length);
  }

  update(
    transformOrTransforms: TransformOrOperations,
    options?: object,
    id?: string
  ): Promise<any> {
    return this.source.update(transformOrTransforms, options, id);
  }

  async addRecord<M extends Model = Model>(
    properties: Properties = {},
    options?: object
  ): Promise<M> {
    let record = normalizeRecordProperties(this.source.schema, properties);
    await this.update(t => t.addRecord(record), options);
    return this.cache.lookup(record) as M;
  }

  async updateRecord<M extends Model = Model>(
    properties: Properties = {},
    options?: object
  ): Promise<M> {
    let record = normalizeRecordProperties(this.source.schema, properties);
    await this.update(t => t.updateRecord(record), options);
    return this.cache.lookup(record) as M;
  }

  async removeRecord(record: RecordIdentity, options?: object): Promise<void> {
    const identity = cloneRecordIdentity(record);
    await this.update(t => t.removeRecord(identity), options);
  }

  findRecord<M extends Model = Model>(
    identifier: RecordIdentity,
    options?: object
  ): FindRecordQueryBuilder<M> {
    const queryBuilder = new FindRecordQueryBuilder<M>(this, identifier);

    if (options) {
      return queryBuilder.options(options);
    }
    return queryBuilder;
  }

  findRecords<M extends Model = Model>(
    type: string | RecordIdentity[],
    options?: object
  ): FindRecordsQueryBuilder<M> {
    const queryBuilder = new FindRecordsQueryBuilder<M>(this, type);

    if (options) {
      return queryBuilder.options(options);
    }
    return queryBuilder;
  }

  findRelatedRecord(
    identifier: RecordIdentity,
    relationship: string,
    options?: object
  ): FindRelatedRecordQueryBuilder {
    const queryBuilder = new FindRelatedRecordQueryBuilder(
      this,
      identifier,
      relationship
    );

    if (options) {
      return queryBuilder.options(options);
    }
    return queryBuilder;
  }

  findRelatedRecords(
    identifier: RecordIdentity,
    relationship: string,
    options?: object
  ): FindRelatedRecordsQueryBuilder {
    const queryBuilder = new FindRelatedRecordsQueryBuilder(
      this,
      identifier,
      relationship
    );

    if (options) {
      return queryBuilder.options(options);
    }
    return queryBuilder;
  }

  peekRecord(identifier: RecordIdentity): Model | undefined {
    return this.cache.record(identifier);
  }

  peekRecords(type: string | RecordIdentity[]): Model[] {
    return this.cache.records(type);
  }

  on(event: string, listener: Listener): void {
    this.source.on(event, listener);
  }

  off(event: string, listener: Listener): void {
    this.source.off(event, listener);
  }

  one(event: string, listener: Listener): void {
    this.source.one(event, listener);
  }

  sync(transformOrTransforms: Transform | Transform[]): Promise<void> {
    return this.source.sync(transformOrTransforms);
  }

  transformsSince(transformId: string): Transform[] {
    return this.source.transformsSince(transformId);
  }

  allTransforms(): Transform[] {
    return this.source.allTransforms();
  }

  getTransform(transformId: string): Transform {
    return this.source.getTransform(transformId);
  }

  getInverseOperations(transformId: string): RecordOperation[] {
    return this.source.getInverseOperations(transformId);
  }
}
