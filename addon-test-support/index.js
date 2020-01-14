import { getContext } from '@ember/test-helpers';

export async function waitForSource(sourceOrSourceName) {
  let source;
  if (typeof sourceOrSourceName === 'string') {
    const { owner } = getContext();
    const { types } = owner.resolveRegistration('ember-orbit:config') || {};
    source = owner.lookup(`${types.source}:${sourceOrSourceName}`);

    if (!source) {
      throw new Error(
        `${types.source}:${sourceOrSourceName} not found. Maybe you misspelled it?`
      );
    }
  } else {
    source = sourceOrSourceName;
  }

  await source.requestQueue.process();
  await source.syncQueue.process();
}

export async function waitForLiveArray(liveArray) {
  await liveArray[Symbol.asyncIterator]().next();
}
