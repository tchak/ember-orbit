import 'reflect-metadata';
import { Dict } from '@orbit/utils';
import {
  Record,
  RecordIdentity,
  KeyDefinition,
  AttributeDefinition,
  RelationshipDefinition
} from '@orbit/data';

import EmberObject from '@ember/object';
import { gte } from 'ember-compatibility-helpers';

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

export class ClassicModel extends EmberObject {
  identity!: RecordIdentity;

  private _store?: Store;
  private _relatedRecords: Dict<HasManyContract> = {};

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
    relatedRecord: ClassicModel | null,
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
        addToContent: (record: ClassicModel): Promise<void> => {
          return this.addToRelatedRecords(relationship, record);
        },
        removeFromContent: (record: ClassicModel): Promise<void> => {
          return this.removeFromRelatedRecords(relationship, record);
        }
      });
    }
    this._relatedRecords[relationship].invalidate();

    return this._relatedRecords[relationship];
  }

  async addToRelatedRecords(
    relationship: string,
    record: ClassicModel,
    options?: object
  ): Promise<void> {
    await this.store.update(
      t => t.addToRelatedRecords(this.identity, relationship, record.identity),
      options
    );
  }

  async removeFromRelatedRecords(
    relationship: string,
    record: ClassicModel,
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

  willDestroy(): void {
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
}
