import MemorySource, { MemorySourceSettings } from '@orbit/memory';

export default {
  create(injections: MemorySourceSettings = {}) {
    injections.name = injections.name || 'store';
    return new MemorySource(injections);
  }
};
