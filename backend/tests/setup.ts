import { EventEmitter } from 'events';

jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
      removeRepeatableByKey: jest.fn().mockResolvedValue(true),
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
    })),
    Worker: jest.fn().mockImplementation((_name, processor) => {
      return {
        on: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
        processor,
      };
    }),
  };
});

const redisEmitter = new EventEmitter();

type Entry = { value: string; expiresAt?: number };

function createMemoryRedis() {
  const store = new Map<string, Entry>();

  const isExpired = (entry: Entry | undefined): boolean => {
    if (!entry) return true;
    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      return true;
    }
    return false;
  };

  const getEntry = (key: string): Entry | undefined => {
    const entry = store.get(key);
    if (!entry || isExpired(entry)) {
      store.delete(key);
      return undefined;
    }
    return entry;
  };

  return {
    on: (event: string, listener: (...args: any[]) => void) => {
      redisEmitter.on(event, listener);
    },
    subscribe: (_channel: string, callback?: (err: Error | null, count?: number) => void) => {
      if (callback) callback(null, 1);
    },
    publish: (channel: string, message: string) => {
      redisEmitter.emit('message', channel, message);
      return Promise.resolve(1);
    },
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn().mockResolvedValue(undefined),
    call: jest.fn().mockResolvedValue(null),
    incr: async (key: string) => {
      const entry = getEntry(key);
      const next = (entry ? parseInt(entry.value, 10) || 0 : 0) + 1;
      store.set(key, { value: String(next), expiresAt: entry?.expiresAt });
      return next;
    },
    get: async (key: string) => {
      const entry = getEntry(key);
      return entry ? entry.value : null;
    },
    set: async (key: string, value: string, ...args: Array<string | number>) => {
      let expiresAt: number | undefined;
      for (let i = 0; i < args.length; i++) {
        if (String(args[i]).toUpperCase() === 'EX' && args[i + 1] !== undefined) {
          expiresAt = Date.now() + Number(args[i + 1]) * 1000;
        }
      }
      store.set(key, { value: String(value), expiresAt });
      return 'OK';
    },
    del: async (...keys: string[]) => {
      let removed = 0;
      for (const key of keys) {
        if (store.delete(key)) removed += 1;
      }
      return removed;
    },
    expire: async (key: string, seconds: number) => {
      const entry = getEntry(key);
      if (!entry) return 0;
      store.set(key, { ...entry, expiresAt: Date.now() + seconds * 1000 });
      return 1;
    },
    ttl: async (key: string) => {
      const entry = store.get(key);
      if (!entry) return -2;
      if (entry.expiresAt === undefined) return -1;
      const remainingMs = entry.expiresAt - Date.now();
      if (remainingMs <= 0) {
        store.delete(key);
        return -2;
      }
      return Math.ceil(remainingMs / 1000);
    },
    // Expose store for test resets if needed
    __store: store,
  };
}

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => createMemoryRedis());
});
