import { tracked } from '@glimmer/tracking';
import { Dict } from '@orbit/utils';

import Model from '../model';

export default function hasMany(type: string, options: Dict<unknown> = {}) {
  function trackedHasMany(target: any, key: string, desc: PropertyDescriptor) {
    if (!options.model) {
      throw new TypeError('@hasMany() require `type` argument.');
    }

    let trackedDesc = tracked(target, key, desc);
    let { get: originalGet, set: originalSet } = trackedDesc;

    let defaultAssigned = new WeakSet();

    function setDefaultValue(record: Model) {
      let value = record.getRelatedRecords(key);
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
  }

  if (arguments.length === 3) {
    options = {};
    return trackedHasMany.apply(null, arguments);
  }

  options.model = type;
  options.type = 'hasMany';
  return trackedHasMany;
}
