import { tracked } from '@glimmer/tracking';
import { AttributeDefinition } from '@orbit/data';

import Model from '../model';
import { isFieldDescriptor } from '../utils/decorators';

export default function attr(type: string, options: AttributeDefinition = {}) {
  const trackedAttr = (target: any, key: string, desc: PropertyDescriptor) => {
    let trackedDesc = tracked(target, key, desc);
    let { get: originalGet, set: originalSet } = trackedDesc;

    let defaultAssigned = new WeakSet();

    function setDefaultValue(record: Model) {
      let value = record.getAttribute(key);
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
      const oldValue = this.getAttribute(key);

      if (value !== oldValue) {
        this.replaceAttribute(key, value);
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
