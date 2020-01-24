import { getOwner, setOwner } from '@ember/application';
import { RecordIdentity, cloneRecordIdentity } from '@orbit/data';
import { Model, Store, StoreConfig } from 'ember-orbit';

export const EmberStoreConfig: StoreConfig = {
  storeFor(model: typeof Model): Store {
    const owner = getOwner(model);
    const {
      types: { source }
    } = owner.lookup('ember-orbit:config');

    return owner.lookup(`${source}:store`);
  },

  modelFor<T extends Model>(store: Store, identifier: RecordIdentity): T {
    const owner = getOwner(store);
    const factory = modelFactoryFor(owner, identifier.type);

    return factory.create({
      identity: cloneRecordIdentity(identifier),
      store
    }) as T;
  },

  afterFork(store: Store, forkedStore: Store): void {
    const owner = getOwner(store);
    setOwner(forkedStore, owner);
  }
};

function modelFactoryFor<T extends Model>(
  owner: any,
  type: string
): ModelFactory<T> {
  let modelFactoryMap = modelFactoryOwnerMap.get(owner);

  if (!modelFactoryMap) {
    modelFactoryMap = new Map();
    modelFactoryOwnerMap.set(owner, modelFactoryMap);
  }

  let modelFactory: ModelFactory<T> = modelFactoryMap.get(type) as ModelFactory<
    T
  >;

  if (!modelFactory) {
    const { types } = owner.lookup('ember-orbit:config');
    modelFactory = owner.factoryFor(`${types.model}:${type}`) as ModelFactory<
      T
    >;
    modelFactoryMap.set(type, modelFactory);
  }

  return modelFactory;
}

interface ModelFactory<T> {
  create(injections: any): T;
}

const modelFactoryOwnerMap = new WeakMap<
  any,
  Map<string, ModelFactory<Model>>
>();
