import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage<object>();

export const tenantContext = {
  run<T>(client: object, fn: () => T): T {
    return storage.run(client, fn);
  },
  get(): object | undefined {
    return storage.getStore();
  },
};
