import 'reflect-metadata';
import {
  RecordIdentity,
  ModelDefinition,
  cloneRecordIdentity,
  AttributeDefinition,
  RelationshipDefinition
} from '@orbit/data';
import { SyncRecordCache } from '@orbit/record-cache';

import { Properties } from './utils/normalize-record-properties';
import {
  QueryableAndTransfomableSource,
  peekRecordAttribute,
  peekRelatedRecords,
  peekRelatedRecord
} from './cache';
import {
  ModelIdentity,
  getSource,
  setSource,
  hasSource,
  IdentityMap
} from './identity-map';
import {
  FindRecordQueryOrTransformBuilder,
  FindRelatedRecordQueryOrTransformBuilder,
  FindRelatedRecordsQueryOrTransformBuilder
} from './query-or-transform-builders';

export interface ModelInjections {
  identity: RecordIdentity;
  source: QueryableAndTransfomableSource;
}

export default class Model implements ModelIdentity {
  [key: string]: unknown;

  $identity: RecordIdentity;

  get $source(): QueryableAndTransfomableSource {
    return getSource(this);
  }

  get $connected(): boolean {
    return hasSource(this);
  }

  get $cache(): SyncRecordCache {
    return this.$source.cache;
  }

  static create(injections: ModelInjections) {
    const { identity, source, ..._injections } = injections;
    const record = new this(identity);
    setSource(record, source);
    return Object.assign(record, _injections);
  }

  constructor(identity: RecordIdentity) {
    this.$identity = identity;
  }

  get id(): string {
    return this.$identity.id;
  }

  get type(): string {
    return this.$identity.type;
  }

  relatedRecord<T extends Model = Model>(
    name: string,
    options?: object
  ): FindRelatedRecordQueryOrTransformBuilder<T> {
    return new FindRelatedRecordQueryOrTransformBuilder<T>(
      this.$source,
      this,
      name,
      options
    );
  }

  relatedRecords<T extends Model = Model>(
    name: string,
    options?: object
  ): FindRelatedRecordsQueryOrTransformBuilder<T> {
    return new FindRelatedRecordsQueryOrTransformBuilder<T>(
      this.$source,
      this,
      name,
      options
    );
  }

  async update(properties: Properties = {}, options?: object): Promise<void> {
    await qot<this>(this).update(properties, options);
  }

  async remove(options?: object): Promise<void> {
    await qot<this>(this).remove(options);
  }

  unload(): void {
    IdentityMap.for(this.$cache).unload(this);
  }

  $getAttribute<T = unknown>(attribute: string): T {
    return peekRecordAttribute(this.$cache, this, attribute) as T;
  }

  $getRelatedRecord<T extends Model = Model>(
    relationship: string
  ): T | null | undefined {
    const record = peekRelatedRecord(this.$cache, this, relationship);
    if (record) {
      return IdentityMap.for<T>(this.$cache).lookup(record) as T | null;
    }
    return record;
  }

  $getRelatedRecords<T extends Model = Model>(
    relationship: string
  ): T[] | undefined {
    const records = peekRelatedRecords(this.$cache, this, relationship);
    if (records) {
      return IdentityMap.for<T>(this.$cache).lookup(records) as T[];
    }
    return records;
  }

  static get schema(): ModelDefinition {
    return {
      attributes: this.getDefinitionFor('attribute'),
      relationships: this.getDefinitionFor('relationship')
    };
  }

  static getDefinitionFor<
    T extends AttributeDefinition | RelationshipDefinition
  >(kind: string): Record<string, T> {
    const options = {};
    const properties = Object.getOwnPropertyNames(this.prototype);

    for (let property of properties) {
      if (Reflect.hasMetadata(`orbit:${kind}`, this.prototype, property)) {
        options[property] = Reflect.getMetadata(
          `orbit:${kind}`,
          this.prototype,
          property
        );
      }
    }

    return options;
  }
}

function qot<T extends Model>(
  record: T,
  options?: object
): FindRecordQueryOrTransformBuilder<T> {
  return new FindRecordQueryOrTransformBuilder<T>(
    record.$source,
    cloneRecordIdentity(record),
    options
  );
}
