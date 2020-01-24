import { getContext } from '@ember/test-helpers';
import { Source } from '@orbit/data';
import Coordinator from '@orbit/coordinator';
import { Model, LiveArray } from 'ember-orbit';

export async function waitForSource(
  sourceOrSourceName: string | Source
): Promise<void> {
  let source: Source;

  if (typeof sourceOrSourceName === 'string') {
    const { owner } = getContext() as any;
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

export async function waitForAll(): Promise<void> {
  const { owner } = getContext() as any;
  const coordinator = owner.lookup('service:coordinator') as Coordinator;

  for (let source of coordinator.sources) {
    await waitForSource(source);
  }
}

export async function waitForLiveArray<T extends Model>(
  liveArray: LiveArray<T>
): Promise<void> {
  await liveArray[Symbol.asyncIterator]().next();
}
