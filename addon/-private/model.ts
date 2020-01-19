import 'reflect-metadata';
import {
  RecordIdentity,
  ModelDefinition,
  AttributeDefinition,
  RelationshipDefinition
} from '@orbit/data';
import { SyncRecordCache } from '@orbit/record-cache';

import { Properties } from './utils/normalize-record-properties';
import { QueryableAndTransfomableSource } from './cache';
import { ModelIdentity, getSource, hasSource } from './identity-map';
import {
  FindRelatedRecordQueryOrTransformBuilder,
  FindRelatedRecordsQueryOrTransformBuilder,
  findRecord
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

  get $ref() {
    return findRecord<this>(this, this.$source);
  }

  static create(injections: ModelInjections) {
    const { identity, ..._injections } = injections;
    const record = new this(identity);
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

  draft(force = false): this {
    if (force || !this.$source.base) {
      const forkedSource = this.$source.fork();
      return findRecord<this>(this, forkedSource).value() as this;
    }
    return this;
  }

  async save(discardDraftSource = true): Promise<this> {
    if (this.$source.base) {
      const source = this.$source.base;
      const draftSource = this.$source;

      await draftSource.requestQueue.process();
      //FIXME
      if (draftSource.requestQueue.length > 0) {
        await draftSource.requestQueue.process();
      }

      await source.merge(draftSource);

      if (discardDraftSource) {
        draftSource.destroy();
      }
      return findRecord<this>(this, source).value() as this;
    }

    return this;
  }

  update(properties: Properties = {}, options?: object): Promise<this> {
    return this.$ref.update(properties, options);
  }

  remove(options?: object): Promise<void> {
    return this.$ref.remove(options);
  }

  unload(): void {
    this.$ref.unload();
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
