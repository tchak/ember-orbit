import { tracked } from '@glimmer/tracking';
import { RelationshipDefinition } from '@orbit/data';

import Model from '../model';
import { isFieldDescriptor } from '../utils/decorators';

export default function hasMany(
  type: string,
  options: Partial<RelationshipDefinition> = {}
) {
  const trackedHasMany = (
    target: any,
    key: string,
    desc: PropertyDescriptor
  ) => {
    if (!options.model) {
      throw new TypeError('@hasMany() require `type` argument.');
    }

    const trackedDesc = tracked(target, key, desc);
    const { get: originalGet, set: originalSet } = trackedDesc;
    const defaultAssigned = new WeakSet();

    function setDefaultValue(record: Model) {
      const value = record.relatedRecords<Model, any>(key).value() || [];
      defaultAssigned.add(record);
      return originalSet!.call(record, value);
    }

    function get(this: Model) {
      if (!defaultAssigned.has(this)) {
        setDefaultValue(this);
      }
      return originalGet!.call(this);
    }

    function set(this: Model, value: any) {
      return value;
    }

    trackedDesc.get = get;
    trackedDesc.set = set;

    Reflect.defineMetadata('orbit:relationship', options, target, key);
    Reflect.defineMetadata(
      'orbit:notifier',
      (record: Model) => setDefaultValue(record),
      target,
      key
    );

    return trackedDesc;
  };

  if (isFieldDescriptor(arguments)) {
    options = {};
    return trackedHasMany.apply(null, arguments);
  }

  options.model = type;
  options.type = 'hasMany';

  return trackedHasMany;
}
