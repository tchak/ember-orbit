import { tracked } from '@glimmer/tracking';
import { Dict } from '@orbit/utils';

import { computed } from '@ember/object';
import { gte } from 'ember-compatibility-helpers';

import Model from '../model';
import { isFieldDescriptor } from '../utils/decorators';

export default function hasMany(type: string, options: Dict<unknown> = {}) {
  if (gte('3.15.0')) {
    const trackedHasMany = (
      target: any,
      key: string,
      desc: PropertyDescriptor
    ) => {
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
    };

    if (isFieldDescriptor(arguments)) {
      options = {};
      return trackedHasMany.apply(null, arguments);
    }

    options.model = type;
    options.type = 'hasMany';

    return trackedHasMany;
  } else {
    options.model = type;
    options.type = 'hasMany';

    return computed({
      get(key) {
        return this.getRelatedRecords(key);
      }
    }).meta({
      options,
      isRelationship: true
    });
  }
}
