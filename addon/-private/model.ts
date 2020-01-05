import 'reflect-metadata';
import { RecordIdentity, ModelDefinition } from '@orbit/data';

import { HasOneRelation, HasManyRelation } from './relations';
import Store from './store';

export interface ModelSettings {
  identity: RecordIdentity;
}

export interface ModelInjections {
  identity: RecordIdentity;
  store: Store;
}

export default class Model {
  identity!: RecordIdentity;

  private _store?: Store;
  private _hasManyRelations: Record<string, HasManyRelation> = {};
  private _hasOneRelations: Record<string, HasOneRelation> = {};

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

  hasMany(name: string): HasManyRelation {
    let relationship = this._hasManyRelations[name];
    if (!relationship) {
      this._hasManyRelations[name] = relationship = new HasManyRelation(
        this,
        name
      );
    }
    return relationship;
  }

  hasOne(name: string): HasOneRelation {
    let relationship = this._hasOneRelations[name];
    if (!relationship) {
      this._hasOneRelations[name] = relationship = new HasOneRelation(
        this,
        name
      );
    }
    return relationship;
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
    }
  }

  get store(): Store {
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
