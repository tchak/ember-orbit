import { getOwner } from '@ember/application';
import Coordinator, { CoordinatorOptions } from '@orbit/coordinator';

import modulesOfType from '../-private/utils/modules-of-type';

export interface CoordinatorInjections extends CoordinatorOptions {
  sourceNames?: string[];
  strategyNames?: string[];
}

export default {
  create(injections: CoordinatorInjections = {}) {
    const owner = getOwner(injections);
    const config = owner.lookup('ember-orbit:config');

    let sourceNames;
    if (injections.sourceNames) {
      sourceNames = injections.sourceNames;
      delete injections.sourceNames;
    } else {
      sourceNames = modulesOfType(
        owner.base.modulePrefix,
        config.collections.sources
      );
      sourceNames.push('store');
    }

    let strategyNames;
    if (injections.strategyNames) {
      strategyNames = injections.strategyNames;
      delete injections.strategyNames;
    } else {
      strategyNames = modulesOfType(
        owner.base.modulePrefix,
        config.collections.strategies
      );
    }

    injections.sources = sourceNames.map(name =>
      owner.lookup(`${config.types.source}:${name}`)
    );
    injections.strategies = strategyNames.map(name =>
      owner.lookup(`${config.types.strategy}:${name}`)
    );

    return new Coordinator(injections);
  }
};
