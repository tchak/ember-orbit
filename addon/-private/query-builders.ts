import { deepMerge } from '@orbit/utils';
import {
  RecordIdentity,
  FindRecordTerm,
  FindRecordsTerm,
  FindRelatedRecordTerm,
  FindRelatedRecordsTerm
} from '@orbit/data';

import Store from '../services/store';
import Model from './model';

export class FindRecordQueryBuilder<M extends Model = Model>
  extends FindRecordTerm
  implements PromiseLike<M> {
  store: Store;
  _options = {};

  constructor(store: Store, record: RecordIdentity) {
    super(record);
    this.store = store;
  }

  options(options: object): this {
    deepMerge(this._options, options);
    return this;
  }

  then<T = M>(
    onfullfiled?: null | ((value: any) => T | PromiseLike<T>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<T> {
    return this._promise.then<T>(onfullfiled, onrejected);
  }

  catch(cb: any) {
    return this._promise.catch(cb);
  }

  finally(cb: any) {
    return this._promise.finally(cb);
  }

  peek(): M | undefined {
    return this.store.cache.query(this.toQueryExpression(), this._options) as M;
  }

  private get _promise(): Promise<M> {
    return this.store.query(this.toQueryExpression(), this._options);
  }
}

export class FindRecordsQueryBuilder<M extends Model = Model>
  extends FindRecordsTerm
  implements PromiseLike<M[]> {
  store: Store;
  _options = {};
  _live = false;

  constructor(store: Store, typeOrIdentities?: string | RecordIdentity[]) {
    super(typeOrIdentities);
    this.store = store;
  }

  options(options: object): this {
    deepMerge(this._options, options);
    return this;
  }

  live(): this {
    this._live = true;
    return this;
  }

  then<T = M[]>(
    onfullfiled?: null | ((value: any) => T | PromiseLike<T>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<T> {
    return this._promise.then<T>(onfullfiled, onrejected);
  }

  catch(cb: any) {
    return this._promise.catch(cb);
  }

  finally(cb: any) {
    return this._promise.finally(cb);
  }

  peek(): M[] | any {
    if (this._live) {
      return this.store.cache.liveQuery(
        this.toQueryExpression(),
        this._options
      );
    }
    return this.store.cache.query(this.toQueryExpression(), this._options);
  }

  private get _promise(): Promise<M[]> {
    return this.store
      .query(this.toQueryExpression(), this._options)
      .then(result => {
        if (this._live) {
          return this.peek();
        }
        return result;
      });
  }
}

export class FindRelatedRecordQueryBuilder<M extends Model = Model>
  extends FindRelatedRecordTerm
  implements PromiseLike<M> {
  store: Store;
  _options = {};

  constructor(store: Store, record: RecordIdentity, relationship: string) {
    super(record, relationship);
    this.store = store;
  }

  options(options: object) {
    deepMerge(this._options, options);
    return this;
  }

  then<T = M>(
    onfullfiled?: null | ((value: any) => T | PromiseLike<T>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<T> {
    return this._promise.then<T>(onfullfiled, onrejected);
  }

  catch(cb: any) {
    return this._promise.catch(cb);
  }

  finally(cb: any) {
    return this._promise.finally(cb);
  }

  peek(): Model | null {
    return this.store.cache.query(
      this.toQueryExpression(),
      this._options
    ) as Model | null;
  }

  private get _promise() {
    return this.store.query(this.toQueryExpression(), this._options);
  }
}

export class FindRelatedRecordsQueryBuilder<M extends Model = Model>
  extends FindRelatedRecordsTerm
  implements PromiseLike<M[]> {
  store: Store;
  _options = {};
  _live = false;

  constructor(store: Store, record: RecordIdentity, relationship: string) {
    super(record, relationship);
    this.store = store;
  }

  options(options: object) {
    deepMerge(this._options, options);
    return this;
  }

  live() {
    this._live = true;
    return this;
  }

  then<T = M[]>(
    onfullfiled?: null | ((value: any) => T | PromiseLike<T>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<T> {
    return this._promise.then<T>(onfullfiled, onrejected);
  }

  catch(cb: any) {
    return this._promise.catch(cb);
  }

  finally(cb: any) {
    return this._promise.finally(cb);
  }

  peek(): Model[] | any {
    if (this._live) {
      return this.store.cache.liveQuery(
        this.toQueryExpression(),
        this._options
      );
    }
    return this.store.cache.query(
      this.toQueryExpression(),
      this._options
    ) as Model[];
  }

  private get _promise(): Promise<M[]> {
    return this.store
      .query(this.toQueryExpression(), this._options)
      .then(result => {
        if (this._live) {
          return this.peek();
        }
        return result;
      });
  }
}
