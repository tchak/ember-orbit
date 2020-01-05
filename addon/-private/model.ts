import 'reflect-metadata';
import { Dict } from '@orbit/utils';
import {
  Record,
  RecordIdentity,
  KeyDefinition,
  AttributeDefinition,
  RelationshipDefinition
} from '@orbit/data';

import EmberObject, { notifyPropertyChange } from '@ember/object';
import { gte } from 'ember-compatibility-helpers';

import HasMany from './relationships/has-many';
import Store from './store';
import { ClassicModel } from './classic-model';

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

  destroy() {
    const cache = this.store.cache;
    if (cache) {
      cache.unload(this);
    }
  }

  notifyPropertyChange(key: string) {
    if (gte('3.15.0')) {
      const notifier = Reflect.getMetadata('orbit:notifier', this, key);
      if (notifier) {
        notifier(this);
      } else {
        notifyPropertyChange(this, key);
      }
    } else {
      notifyPropertyChange(this, key);
    }
  }

  private get store(): Store {
    if (!this._store) {
      throw new Error('record has been removed from Store');
    }

    return this._store;
  }

  static get keys(): Dict<KeyDefinition> {
    return this.getPropertiesOptions('key');
  }

  static get attributes(): Dict<AttributeDefinition> {
    return this.getPropertiesOptions('attribute');
  }

  static get relationships(): Dict<RelationshipDefinition> {
    return this.getPropertiesOptions('relationship');
  }

  static getPropertiesOptions(kind: string) {
    const options = {};

    if (gte('3.15.0')) {
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
    } else {
      this.eachComputedProperty((name, meta) => {
        if (kind === 'key' && meta.isKey) {
          options[name] = meta.options;
        } else if (kind === 'attribute' && meta.isAttribute) {
          options[name] = meta.options;
        } else if (kind === 'relationship' && meta.isRelationship) {
          options[name] = meta.options;
        }
      }, this);
    }

    return options;
  }

  static create(injections: ModelInjections) {
    const { identity, _store, ..._injections } = injections;
    const record = new this(identity, _store);
    return Object.assign(record, _injections);
  }

  static extend(mixin?: any) {
    if (gte('3.15.0')) {
      throw new Error(
        'Model: on Ember >= 3.15 you should use native inheritance.'
      );
    } else {
      return ClassicModel.extend(mixin);
    }
  }

  static proto() {
    (EmberObject as any).proto.call(this);
  }

  static eachComputedProperty(callback, target) {
    EmberObject.eachComputedProperty.call(target, callback);
  }
}
