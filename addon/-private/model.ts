import 'reflect-metadata';
import { Dict } from '@orbit/utils';
import {
  Record,
  RecordIdentity,
  KeyDefinition,
  AttributeDefinition,
  RelationshipDefinition
} from '@orbit/data';

import HasMany from './relationships/has-many';
import Store from './store';

export interface ModelSettings {
  identity: RecordIdentity;
}

interface HasManyContract {
  invalidate(): void;
}

export interface ModelInjections {
  identity: RecordIdentity;
  _store: Store;
}

export default class Model {
  static _notifiers: Dict<(instance: Model) => void> = {};

  identity!: RecordIdentity;

  private _store?: Store;
  private _relatedRecords: Dict<HasManyContract> = {};

  constructor(identity: RecordIdentity, store: Store) {
    this.identity = identity;
    this._store = store;
  }

  get id(): string {
    return this.identity.id;
  }

  get type(): string {
    return this.identity.type;
  }

  get disconnected(): boolean {
    return !this._store;
  }

  getData(): Record | undefined {
    return this.store.cache.peekRecordData(this.type, this.id);
  }

  getKey(field: string): string | undefined {
    return this.store.cache.peekKey(this.identity, field);
  }

  async replaceKey(
    field: string,
    value: string,
    options?: object
  ): Promise<void> {
    await this.store.update(
      t => t.replaceKey(this.identity, field, value),
      options
    );
  }

  getAttribute(field: string): any {
    return this.store.cache.peekAttribute(this.identity, field);
  }

  async replaceAttribute(
    attribute: string,
    value: unknown,
    options?: object
  ): Promise<void> {
    await this.store.update(
      t => t.replaceAttribute(this.identity, attribute, value),
      options
    );
  }

  getRelatedRecord(relationship: string): Record | null | undefined {
    return this.store.cache.peekRelatedRecord(this.identity, relationship);
  }

  async replaceRelatedRecord(
    relationship: string,
    relatedRecord: Model | null,
    options?: object
  ): Promise<void> {
    await this.store.update(
      t =>
        t.replaceRelatedRecord(
          this.identity,
          relationship,
          relatedRecord ? relatedRecord.identity : null
        ),
      options
    );
  }

  getRelatedRecords(relationship: string) {
    this._relatedRecords = this._relatedRecords || {};

    if (!this._relatedRecords[relationship]) {
      this._relatedRecords[relationship] = HasMany.create({
        getContent: () =>
          this.store.cache.peekRelatedRecords(this.identity, relationship),
        addToContent: (record: Model): Promise<void> => {
          return this.addToRelatedRecords(relationship, record);
        },
        removeFromContent: (record: Model): Promise<void> => {
          return this.removeFromRelatedRecords(relationship, record);
        }
      });
    }
    this._relatedRecords[relationship].invalidate();

    return this._relatedRecords[relationship];
  }

  async addToRelatedRecords(
    relationship: string,
    record: Model,
    options?: object
  ): Promise<void> {
    await this.store.update(
      t => t.addToRelatedRecords(this.identity, relationship, record.identity),
      options
    );
  }

  async removeFromRelatedRecords(
    relationship: string,
    record: Model,
    options?: object
  ): Promise<void> {
    await this.store.update(
      t =>
        t.removeFromRelatedRecords(
          this.identity,
          relationship,
          record.identity
        ),
      options
    );
  }

  async replaceAttributes(
    properties: Dict<unknown> = {},
    options?: object
  ): Promise<void> {
    const keys = Object.keys(properties);
    await this.store
      .update(
        t =>
          keys.map(key =>
            t.replaceAttribute(this.identity, key, properties[key])
          ),
        options
      )
      .then(() => this);
  }

  async update(
    properties: Dict<unknown> = {},
    options?: object
  ): Promise<void> {
    await this.store.updateRecord({ ...properties, ...this.identity }, options);
  }

  async remove(options?: object): Promise<void> {
    await this.store.removeRecord(this.identity, options);
  }

  disconnect(): void {
    this._store = undefined;
  }

  destroy(): void {
    const cache = this.store.cache;
    if (cache) {
      cache.unload(this);
    }
  }

  private get store(): Store {
    if (!this._store) {
      throw new Error('record has been removed from Store');
    }

    return this._store;
  }

  static get keys(): Dict<KeyDefinition> {
    return this.getPropertiesMeta('key');
  }

  static get attributes(): Dict<AttributeDefinition> {
    return this.getPropertiesMeta('attribute');
  }

  static get relationships(): Dict<RelationshipDefinition> {
    return this.getPropertiesMeta('relationship');
  }

  static getPropertiesMeta(kind: string) {
    const properties = Object.getOwnPropertyNames(this.prototype);
    const metas = {};
    for (let property of properties) {
      if (Reflect.hasMetadata(`orbit:${kind}`, this.prototype, property)) {
        metas[property] = Reflect.getMetadata(
          `orbit:${kind}`,
          this.prototype,
          property
        );
      }
    }
    return metas;
  }

  notifyPropertyChange(key: string) {
    Reflect.getMetadata('orbit:notifier', this, key)(this);
  }

  static create(injections: ModelInjections) {
    const { identity, _store, ..._injections } = injections;
    const record = new this(identity, _store);
    return Object.assign(record, _injections);
  }
}
