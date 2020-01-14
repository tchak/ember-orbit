import { getOwner } from '@ember/application';
import Coordinator, { CoordinatorOptions } from '@orbit/coordinator';

import modulesOfType from '../-private/utils/modules-of-type';

export interface CoordinatorInjections extends CoordinatorOptions {
  sourceNames?: string[];
  strategyNames?: string[];
}

export default {
  create(injections: CoordinatorInjections = {}) {
    const app = getOwner(injections);
    const config = app.lookup('ember-orbit:config');

    let sourceNames;
    if (injections.sourceNames) {
      sourceNames = injections.sourceNames;
      delete injections.sourceNames;
    } else {
      sourceNames = modulesOfType(
        app.base.modulePrefix,
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
        app.base.modulePrefix,
        config.collections.strategies
      );
    }

    injections.sources = sourceNames.map(name =>
      app.lookup(`${config.types.source}:${name}`)
    );
    injections.strategies = strategyNames.map(name =>
      app.lookup(`${config.types.strategy}:${name}`)
    );

    return new Coordinator(injections);
  }
};
