import { RecordException } from '@orbit/data';
import { QueryResult, SyncRecordCache } from '@orbit/record-cache';
import { LiveQuery, LiveQuerySettings } from './live-query';

export interface SyncLiveQuerySettings extends LiveQuerySettings {
  cache: SyncRecordCache;
}

export class SyncLiveQuery extends LiveQuery {
  cache: SyncRecordCache;

  constructor(settings: SyncLiveQuerySettings) {
    super(settings);
    this.cache = settings.cache;
  }

  get schema() {
    return this.cache.schema;
  }

  executeQuery(
    onNext: (result: QueryResult) => void,
    onError?: (error: RecordException) => void
  ): void {
    try {
      onNext(this.cache.query(this.query));
    } catch (error) {
      (onError || defaultOnError)(error);
    }
  }
}

function defaultOnError(error: RecordException) {
  throw error;
}
