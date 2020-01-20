import { getOwner } from '@ember/application';
import Coordinator, { CoordinatorOptions } from '@orbit/coordinator';

export interface CoordinatorInjections extends CoordinatorOptions {
  sourceNames?: string[];
  strategyNames?: string[];
}

export default {
  create(injections: CoordinatorInjections = {}) {
    const owner = getOwner(injections);
    const config = owner.lookup('ember-orbit:config');

    const sourceNames = injections.sourceNames || [];
    delete injections.sourceNames;

    const strategyNames = injections.strategyNames || [];
    delete injections.strategyNames;

    injections.sources = sourceNames.map(name =>
      owner.lookup(`${config.types.source}:${name}`)
    );
    injections.strategies = strategyNames.map(name =>
      owner.lookup(`${config.types.strategy}:${name}`)
    );

    return new Coordinator(injections);
  }
};
