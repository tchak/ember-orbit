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
import { getRecordSource, getModelSource, hasSource } from './identity-map';
import {
  findRecord,
  FindRecordQueryOrTransformBuilder,
  FindRecordsQueryOrTransformBuilder,
  FindRelatedRecordQueryOrTransformBuilder,
  FindRelatedRecordsQueryOrTransformBuilder
} from './query-or-transform-builders';

export interface Identifier {
  id: string;
}

export interface ModelInjections {
  identity: RecordIdentity;
  source: QueryableAndTransfomableSource;
}

export default class Model implements RecordIdentity {
  $identity: RecordIdentity;

  get $source(): QueryableAndTransfomableSource {
    return getRecordSource(this);
  }

  get $cache(): SyncRecordCache {
    return this.$source.cache;
  }

  get $ref() {
    return findRecord<this>(this, this.$source);
  }

  get $disconnected(): boolean {
    return !hasSource(this);
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

  relatedRecord<T extends Model, K extends keyof this>(
    name: K,
    options?: object
  ): FindRelatedRecordQueryOrTransformBuilder<T> {
    return new FindRelatedRecordQueryOrTransformBuilder<T>(
      this.$source,
      this,
      name as string,
      options
    );
  }

  relatedRecords<T extends Model, K extends keyof this>(
    name: K,
    options?: object
  ): FindRelatedRecordsQueryOrTransformBuilder<T> {
    return new FindRelatedRecordsQueryOrTransformBuilder<T>(
      this.$source,
      this,
      name as string,
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

  reload(): Promise<this> {
    return this.$ref.reload();
  }

  unload(): void {
    this.$ref.unload();
  }

  static modelName: string;

  static record<T extends Model>(
    identifier: Identifier,
    options?: object
  ): FindRecordQueryOrTransformBuilder<T> {
    return new FindRecordQueryOrTransformBuilder<T>(
      getModelSource(this),
      { ...identifier, type: this.modelName },
      options
    );
  }

  static records<T extends Model>(
    options?: object
  ): FindRecordsQueryOrTransformBuilder<T> {
    return new FindRecordsQueryOrTransformBuilder<T>(
      getModelSource(this),
      this.modelName,
      options
    );
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
