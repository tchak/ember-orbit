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

    const trackedDesc = tracked(target, key, desc);
    const { get: originalGet, set: originalSet } = trackedDesc;
    const defaultAssigned = new WeakSet();

    function setDefaultValue(record: Model) {
      const value = record.relatedRecord<Model, any>(key).value() || null;
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
      const oldValue = this.relatedRecord<Model, any>(key).value() || null;

      if (value !== oldValue) {
        this.relatedRecord<Model, any>(key).replace(value);

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
