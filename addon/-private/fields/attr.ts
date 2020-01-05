import { tracked } from '@glimmer/tracking';
import { Dict } from '@orbit/utils';

import { computed } from '@ember/object';
import { gte } from 'ember-compatibility-helpers';

import Model from '../model';
import { isFieldDescriptor } from '../utils/decorators';

export default function attr(type: string, options: Dict<unknown> = {}) {
  if (gte('3.15.0')) {
    const trackedAttr = (
      target: any,
      key: string,
      desc: PropertyDescriptor
    ) => {
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
  } else {
    options.type = type;

    return computed({
      get(key) {
        return this.getAttribute(key);
      },
      set(key, value) {
        const oldValue = this.getAttribute(key);

        if (value !== oldValue) {
          this.replaceAttribute(key, value);
        }

        return value;
      }
    }).meta({
      options,
      isAttribute: true
    });
  }
}
