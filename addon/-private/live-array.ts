import { notifyPropertyChange } from '@ember/object';

import { RecordIdentity } from '@orbit/data';

import { SyncLiveQuery } from './live-query/sync-live-query';
import { LiveQuerySubscription } from './live-query/live-query';
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

  constructor(settings: LiveArraySettings) {
    this.cache = settings.cache;
    this.liveQuery = settings.liveQuery;
  }

  [Symbol.iterator]() {
    try {
      const records = this.cache.query(this.liveQuery.query);
      return (records as M[])[Symbol.iterator]();
    } catch {
      return [][Symbol.iterator]();
    }
  }

  [Symbol.asyncIterator]() {
    return fromCallback<this>(async callback => {
      const subscription = this.liveQuery.subscribe(
        () => callback(this),
        () => callback(this)
      );
      subscription.execute();
      return () => subscription.unsubscribe();
    });
  }

  get length(): number {
    let count = 0;

    for (let _ of this) {
      count++;
    }

    return count;
  }

  has(identifier: RecordIdentity): boolean {
    const recordToFind = this.cache.lookup(identifier) as M | undefined;

    if (recordToFind) {
      for (let record of this) {
        if (record === recordToFind) {
          return true;
        }
      }
    }

    return false;
  }

  subscribe(): () => void {
    let subscription = subscriptions.get(this);

    if (!subscription) {
      subscription = this.liveQuery.subscribe(
        () => notifyContentChange(this),
        () => notifyContentChange(this)
      );
      subscriptions.set(this, subscription);
    }

    return () => this.unsubscribe();
  }

  unsubscribe() {
    const subscription = subscriptions.get(this);
    if (subscription) {
      subscription.unsubscribe();
    }
    subscriptions.delete(this);
  }
}

function notifyContentChange(liveArray: LiveArray) {
  notifyPropertyChange(liveArray, 'length');
  notifyPropertyChange(liveArray, '[]');
}

const subscriptions = new WeakMap<LiveArray, LiveQuerySubscription>();
