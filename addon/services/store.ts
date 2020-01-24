import { getOwner } from '@ember/application';

import { StoreSettings } from '../-private/store';

export default {
  create(injections: StoreSettings = {}) {
    const owner = getOwner(injections);
    const {
      types: { source }
    } = owner.lookup('ember-orbit:config');

    return owner.lookup(`${source}:store`);
  }
};
