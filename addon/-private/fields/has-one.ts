import { tracked } from '@glimmer/tracking';
import { RelationshipDefinition } from '@orbit/data';

import Model from '../model';
import { isFieldDescriptor } from '../utils/decorators';

export default function hasOne(
  type: string,
  options: Partial<RelationshipDefinition> = {}
) {
  const trackedHasOne = (
    target: any,
    key: string,
    desc: PropertyDescriptor
  ) => {
    if (!options.model) {
      throw new TypeError('@hasOne() require `type` argument.');
    }

    let trackedDesc = tracked(target, key, desc);
    let { get: originalGet, set: originalSet } = trackedDesc;

    let defaultAssigned = new WeakSet();

    function setDefaultValue(record: Model) {
      let value = record.hasOne(key).value;
      setValue(record, value);
    }

    function setValue(record: any, value: any) {
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
      const oldValue = this.hasOne(key).value;

      if (value !== oldValue) {
        this.hasOne(key).replace(value);

        return setValue(this, value);
      }

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
    return trackedHasOne.apply(null, arguments);
  }

  options.model = type;
  options.type = 'hasOne';

  return trackedHasOne;
}
