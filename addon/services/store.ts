import { getOwner, setOwner } from '@ember/application';

import { Log, TaskQueue, Listener } from '@orbit/core';
import {
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

import LegacyCache from '../-private/legacy-cache';

import {
  setModelFactory,
  destroyIdentityMap,
  sourceQuery,
  LookupResult
} from '../-private/cache';
import Model from '../-private/model';
import ModelFactory from '../-private/model-factory';
import {
  FindRecordQueryOrTransformBuilder,
  FindRecordsQueryOrTransformBuilder
} from '../-private/query-or-transform-builders';

export { LegacyCache as Cache };

export interface StoreInjections {
  source: MemorySource;
}

export default class Store {
  private _source: MemorySource;
  private _cache: LegacyCache;

  static create(injections: StoreInjections): Store {
    const owner = getOwner(injections);
    const store = new this(injections);
    const modelFactory = new ModelFactory(store.source);

    setOwner(store, owner);
    setOwner(modelFactory, owner);
    setModelFactory(store.source.cache, modelFactory);

    return store;
  }

  constructor(settings: StoreInjections) {
    this._source = settings.source;
    this._cache = new LegacyCache({ cache: this.source.cache });
  }

  destroy() {
    destroyIdentityMap(this.source.cache);
    delete this._source;
    delete this._cache;
  }

  get source(): MemorySource {
    return this._source;
  }

  get cache(): LegacyCache {
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

  async query<T extends Model = Model>(
    queryOrExpressions: QueryOrExpressions,
    options?: object,
    id?: string
  ): Promise<LookupResult<T>> {
    return sourceQuery<T>(this.source, queryOrExpressions, options, id);
  }

  async update(
    transformOrTransforms: TransformOrOperations,
    options?: object,
    id?: string
  ): Promise<void> {
    const transform = buildTransform(
      transformOrTransforms,
      options,
      id,
      this.transformBuilder
    );
    await this.source.update(transform);
  }

  record<T extends Model = Model>(
    identifier: RecordIdentity,
    options?: object
  ): FindRecordQueryOrTransformBuilder<T> {
    return new FindRecordQueryOrTransformBuilder<T>(
      this.source,
      identifier,
      options
    );
  }

  records<T extends Model = Model>(
    typeOrIdentifiers: string | RecordIdentity[],
    options?: object
  ): FindRecordsQueryOrTransformBuilder<T> {
    return new FindRecordsQueryOrTransformBuilder<T>(
      this.source,
      typeOrIdentifiers,
      options
    );
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
