import 'reflect-metadata';
import {
  Record as OrbitRecord,
  RecordIdentity,
  ModelDefinition
} from '@orbit/data';

import { notifyPropertyChange } from '@ember/object';

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
  store: Store;
}

export default class Model {
  static _notifiers: Record<string, (instance: Model) => void> = {};

  identity!: RecordIdentity;

  private _store?: Store;
  private _relatedRecords: Record<string, HasManyContract> = {};

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

  getData(): OrbitRecord | undefined {
    return this.store.cache.peekRecordData(this.type, this.id);
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

  getRelatedRecord(relationship: string): Model | null | undefined {
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

  async update(
    properties: Record<string, unknown> = {},
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
    const notifier = Reflect.getMetadata('orbit:notifier', this, key);
    if (notifier) {
      notifier(this);
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

  static create(injections: ModelInjections) {
    const { identity, store, ..._injections } = injections;
    const record = new this(identity, store);
    return Object.assign(record, _injections);
  }

  static get schema(): ModelDefinition {
    return {
      attributes: this.getDefinitionFor('attribute'),
      relationships: this.getDefinitionFor('relationship')
    };
  }

  static getDefinitionFor(kind: string) {
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
