import { tracked } from '@glimmer/tracking';
import { AttributeDefinition } from '@orbit/data';

import Model from '../model';
import { isFieldDescriptor } from '../utils/decorators';

export default function attr(type: string, options: AttributeDefinition = {}) {
  const trackedAttr = (target: any, key: string, desc: PropertyDescriptor) => {
    const trackedDesc = tracked(target, key, desc);
    const { get: originalGet, set: originalSet } = trackedDesc;
    const defaultAssigned = new WeakSet();

    function setDefaultValue(record: Model) {
      const value = record.attribute(key).value;
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
      const oldValue = this.attribute(key).value;

      if (value !== oldValue) {
        this.attribute(key).replace(value);
        return setValue(this, value);
      }

      return value;
    }

    trackedDesc.get = get;
    trackedDesc.set = set;

    Reflect.defineMetadata('orbit:attribute', options, target, key);
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
    return trackedAttr.apply(null, arguments);
  }

  options.type = type;

  return trackedAttr;
}
