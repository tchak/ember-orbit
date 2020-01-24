import 'reflect-metadata';
import {
  RecordIdentity,
  ModelDefinition,
  AttributeDefinition,
  RelationshipDefinition
} from '@orbit/data';

import Store from './store';
import { Properties } from './utils/normalize-record-properties';
import {
  FindRecordsQueryOrTransformBuilder,
  FindRelatedRecordQueryOrTransformBuilder,
  FindRelatedRecordsQueryOrTransformBuilder
} from './query-or-transform-builders';

export interface ModelInjections {
  identity: RecordIdentity;
  store: Store;
}

export default class Model implements RecordIdentity {
  private _store: Store;
  $identity: RecordIdentity;

  get $store(): Store {
    const store = this._store;

    if (!store) {
      throw new Error('record has been removed from the Store');
    }

    return store;
  }

  get $ref() {
    return this.$store.record<this>(this.$identity);
  }

  get $disconnected(): boolean {
    return !this._store;
  }

  static create(injections: ModelInjections) {
    const { store, identity, ..._injections } = injections;
    const record = new this(store, identity);
    return Object.assign(record, _injections);
  }

  constructor(store: Store, identity: RecordIdentity) {
    this.$identity = identity;
    this._store = store;
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
      this.$store,
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
      this.$store,
      this,
      name as string,
      options
    );
  }

  draft(force = false): this {
    if (force || !this.$store.base) {
      return this.$store
        .fork()
        .record<this>(this.$identity)
        .value() as this;
    }
    return this;
  }

  async save(discardDraftSource = true): Promise<this> {
    if (this.$store.base) {
      const source = this.$store.base;
      const draftSource = this.$store;

      await draftSource.requestQueue.process();
      //FIXME
      if (draftSource.requestQueue.length > 0) {
        await draftSource.requestQueue.process();
      }

      await source.merge(draftSource);

      if (discardDraftSource) {
        draftSource.destroy();
      }
      return source.record<this>(this.$identity).value() as this;
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

  static records<T extends Model>(
    options?: object
  ): FindRecordsQueryOrTransformBuilder<T> {
    return new FindRecordsQueryOrTransformBuilder<T>(
      Store.storeFor(this),
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
