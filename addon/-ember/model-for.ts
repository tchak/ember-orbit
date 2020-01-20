import { getOwner } from '@ember/application';

import { RecordIdentity, cloneRecordIdentity } from '@orbit/data';

import { QueryableAndTransfomableSource } from '../-private/cache';

export function modelFor<T extends RecordIdentity>(
  source: QueryableAndTransfomableSource,
  identifier: RecordIdentity
) {
  const owner = getOwner(source);
  const factory = modelFactoryFor(owner, identifier.type);

  return factory.create({
    identity: cloneRecordIdentity(identifier)
  }) as T;
}

function modelFactoryFor(owner: any, type: string) {
  let modelFactoryMap = modelFactoryOwnerMap.get(owner);

  if (!modelFactoryMap) {
    modelFactoryMap = new Map();
    modelFactoryOwnerMap.set(owner, modelFactoryMap);
  }

  let modelFactory = modelFactoryMap.get(type);

  if (!modelFactory) {
    const { types } = owner.lookup('ember-orbit:config');
    modelFactory = owner.factoryFor(`${types.model}:${type}`);
    modelFactoryMap.set(type, modelFactory);
  }

  return modelFactory;
}

const modelFactoryOwnerMap = new WeakMap<any, Map<string, any>>();
