import { tracked } from '@glimmer/tracking';
import { AttributeDefinition } from '@orbit/data';

import Model from '../model';
import { isFieldDescriptor } from '../utils/decorators';

export default function attr(type: string, options: AttributeDefinition = {}) {
  const trackedAttr = (target: any, key: string, desc: PropertyDescriptor) => {
    const trackedDesc = tracked(target, key, desc);
    const { get: originalGet, set: originalSet } = trackedDesc;
    const defaultAssigned = new WeakSet();

    function setDefaultValue(record: Model): void {
      const value = record.$ref.attribute(key);
      setValue(record, value);
    }

    function setValue(record: any, value: unknown) {
      defaultAssigned.add(record);
      return originalSet!.call(record, value);
    }

    function get(this: Model): unknown {
      if (!defaultAssigned.has(this)) {
        setDefaultValue(this);
      }
      return originalGet!.call(this);
    }

    function set(this: Model, value: unknown) {
      const oldValue = this.$ref.attribute(key);

      if (value !== oldValue) {
        this.update({ [key]: value });
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
