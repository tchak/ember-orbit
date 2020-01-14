import { getContext } from '@ember/test-helpers';

export async function waitForSource(sourceOrSourceName) {
  let source;
  if (typeof sourceOrSourceName === 'string') {
    let { owner } = getContext();
    let orbitConfig = owner.resolveRegistration('ember-orbit:config') || {};
    source = owner.lookup(`${orbitConfig.types.source}:${sourceOrSourceName}`);
    if (!source) {
      throw new Error(
        `${orbitConfig.types.source}:${sourceOrSourceName} not found. Maybe you misspelled it?`
      );
    }
  } else {
    source = sourceOrSourceName;
  }

  await source.requestQueue.process();
  await source.syncQueue.process();
}
