import { notifyPropertyChange } from '@ember/object';

import { RecordIdentity, recordsInclude } from '@orbit/data';

import { SyncLiveQuery } from './live-query/sync-live-query';
import { LiveQuerySubscription } from './live-query/live-query';
import fromCallback from './utils/from-callback';
import { cacheQuery } from './cache';

export default class LiveArray<T extends RecordIdentity>
  implements Iterable<T>, AsyncIterable<LiveArray<T>> {
  liveQuery: SyncLiveQuery;

  constructor(liveQuery: SyncLiveQuery) {
    this.liveQuery = liveQuery;
  }

  [Symbol.iterator]() {
    try {
      const records = cacheQuery<T>(
        this.liveQuery.cache,
        this.liveQuery.query
      ) as T[];
      return records[Symbol.iterator]();
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
    return recordsInclude([...this], identifier);
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

function notifyContentChange<T extends RecordIdentity>(
  liveArray: LiveArray<T>
) {
  notifyPropertyChange(liveArray, 'length');
  notifyPropertyChange(liveArray, '[]');
}

const subscriptions = new WeakMap<
  LiveArray<RecordIdentity>,
  LiveQuerySubscription
>();
