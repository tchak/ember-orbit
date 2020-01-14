import { notifyPropertyChange } from '@ember/object';
import { once } from '@ember/runloop';
import { RecordIdentity } from '@orbit/data';

import { SyncLiveQuery } from './live-query/sync-live-query';
import Model from './model';
import Cache from './cache';
import fromCallback from './utils/from-callback';

export interface LiveArraySettings {
  cache: Cache;
  liveQuery: SyncLiveQuery;
}

export default class LiveArray<M extends Model = Model>
  implements Iterable<M>, AsyncIterable<LiveArray<M>> {
  cache: Cache;
  liveQuery: SyncLiveQuery;

  private _content?: M[];
  private _iteratorCallbacks = new Set<(input: this) => void>();

  constructor(settings: LiveArraySettings) {
    this.cache = settings.cache;
    this.liveQuery = settings.liveQuery;
    this._content = [];
  }

  [Symbol.iterator]() {
    if (this._content) {
      return this._content[Symbol.iterator]();
    } else {
      throw new Error('LiveArray is not connected to a store.');
    }
  }

  get length() {
    if (this._content) {
      return this._content.length;
    } else {
      throw new Error('LiveArray is not connected to a store.');
    }
  }

  has(identifier: RecordIdentity) {
    if (this._content) {
      const record = this.cache.lookup(identifier) as M | undefined;
      return record ? this._content.includes(record) : false;
    } else {
      throw new Error('LiveArray is not connected to a store.');
    }
  }

  [Symbol.asyncIterator]() {
    return fromCallback<this>(async callback => {
      this._iteratorCallbacks.add(callback);
      return () => {
        this._iteratorCallbacks.delete(callback);
      };
    });
  }

  subscribe() {
    const subscription = this.liveQuery.subscribe(
      result => {
        if (result) {
          this._content = this.cache.lookup(
            result,
            this.liveQuery.query.expressions.length
          ) as M[];
        } else {
          this._content = [];
        }
        this.notifyContentChangeOnce();
      },
      () => {
        this._content = [];
        this.notifyContentChangeOnce();
      }
    );

    subscription.execute();

    return () => subscription.unsubscribe();
  }

  destroy() {
    this.cache.unsubscribeLiveArray(this);
    this._iteratorCallbacks.clear();
    this._content = undefined;
    delete this.cache;
    delete this.liveQuery;
  }

  private notifyContentChangeOnce() {
    once(this, this.notifyContentChange);
  }

  private notifyContentChange() {
    notifyPropertyChange(this, 'length');
    notifyPropertyChange(this, '[]');

    for (let callback of this._iteratorCallbacks) {
      callback(this);
    }
  }
}
