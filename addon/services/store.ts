import { getOwner, setOwner } from '@ember/application';

import { Log, TaskQueue, Listener } from '@orbit/core';
import {
  buildQuery,
  QueryOrExpressions,
  RecordIdentity,
  Transform,
  TransformOrOperations,
  RecordOperation,
  Schema,
  TransformBuilder,
  buildTransform
} from '@orbit/data';
import MemorySource, { MemorySourceMergeOptions } from '@orbit/memory';

import Cache from '../-private/cache';
import Model from '../-private/model';
import ModelFactory from '../-private/model-factory';
import { RootRecordTerm, RootRecordsTerm } from '../-private/terms';

export { Cache };

export interface StoreInjections {
  source: MemorySource;
}

export default class Store {
  private _source: MemorySource;
  private _cache: Cache;

  static create(injections: StoreInjections): Store {
    const owner = getOwner(injections);
    const store = new this(injections);
    setOwner(store, owner);
    return store;
  }

  constructor(settings: StoreInjections) {
    this._source = settings.source;

    this._cache = new Cache({
      cache: this.source.cache,
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

  async update(
    transformOrTransforms: TransformOrOperations,
    options?: object,
    id?: string
  ): Promise<any> {
    const transform = buildTransform(
      transformOrTransforms,
      options,
      id,
      this.transformBuilder
    );
    const result = await this.source.update(transform);
    return this.cache.lookup(result, transform.operations.length);
  }

  record<M extends Model = Model>(
    identifier: RecordIdentity,
    options?: object
  ): RootRecordTerm<M> {
    return new RootRecordTerm<M>(this, identifier, options);
  }

  records<M extends Model = Model>(
    typeOrIdentifiers: string | RecordIdentity[],
    options?: object
  ): RootRecordsTerm<M> {
    return new RootRecordsTerm<M>(this, typeOrIdentifiers, options);
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
