import Service from '@ember/service';
import { RecordIdentity } from '@orbit/data';

import StoreSource, {
  StoreSettings,
  StoreMergeOptions
} from '../-private/store';
import Model from '../-private/model';

import {
  FindRecordQueryOrTransformBuilder,
  FindRecordsQueryOrTransformBuilder
} from 'ember-orbit/-private/query-or-transform-builders';

export default class Store extends Service {
  source!: StoreSource;

  get schema() {
    return this.source.schema;
  }

  record<T extends Model>(
    identifier: RecordIdentity,
    options?: object
  ): FindRecordQueryOrTransformBuilder<T> {
    return new FindRecordQueryOrTransformBuilder<T>(
      this.source,
      identifier,
      options
    );
  }

  records<T extends Model>(
    typeOrIdentifiers: string | RecordIdentity[],
    options?: object
  ): FindRecordsQueryOrTransformBuilder<T> {
    return new FindRecordsQueryOrTransformBuilder<T>(
      this.source,
      typeOrIdentifiers,
      options
    );
  }

  fork(settings: StoreSettings = {}): StoreSource {
    return this.source.fork(settings);
  }

  merge(source: StoreSource, options?: StoreMergeOptions): Promise<void> {
    return this.source.merge(source, options);
  }

  willDestroy() {
    this.source.destroy();
  }
}
