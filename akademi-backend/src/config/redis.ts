import { createClient } from 'redis';
import { config } from './env';

type RedisLike = {
  isOpen?: boolean;
  connect: () => Promise<void>;
  duplicate: () => RedisLike;
  get: (key: string) => Promise<string | null>;
  setEx: (key: string, ttlSeconds: number, value: string) => Promise<void>;
  incr: (key: string) => Promise<number>;
  expire: (key: string, ttlSeconds: number) => Promise<void>;
  keys: (pattern: string) => Promise<string[]>;
  del: (keys: string[] | string) => Promise<number>;
  ping?: () => Promise<string>;
};

function createInMemoryRedis(): RedisLike {
  const store = new Map<string, { value: string; expiresAt?: number }>();

  const getNow = () => Date.now();
  const isExpired = (e?: number) => typeof e === 'number' && e <= getNow();

  const getEntry = (key: string) => {
    const entry = store.get(key);
    if (!entry) return null;
    if (isExpired(entry.expiresAt)) {
      store.delete(key);
      return null;
    }
    return entry;
  };

  const matchPattern = (key: string, pattern: string) => {
    // Minimal glob: only supports trailing "*" which is all we currently use.
    if (pattern.endsWith('*')) return key.startsWith(pattern.slice(0, -1));
    return key === pattern;
  };

  const client: RedisLike = {
    isOpen: true,
    async connect() {
      return;
    },
    duplicate() {
      return client;
    },
    async get(key) {
      return getEntry(key)?.value ?? null;
    },
    async setEx(key, ttlSeconds, value) {
      store.set(key, { value, expiresAt: getNow() + ttlSeconds * 1000 });
    },
    async incr(key) {
      const cur = Number(getEntry(key)?.value ?? 0) + 1;
      store.set(key, { value: String(cur), expiresAt: getEntry(key)?.expiresAt });
      return cur;
    },
    async expire(key, ttlSeconds) {
      const entry = getEntry(key);
      if (!entry) return;
      store.set(key, { value: entry.value, expiresAt: getNow() + ttlSeconds * 1000 });
    },
    async keys(pattern) {
      return Array.from(store.keys()).filter((k) => matchPattern(k, pattern));
    },
    async del(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      let removed = 0;
      for (const k of list) {
        if (store.delete(k)) removed += 1;
      }
      return removed;
    },
    async ping() {
      return 'PONG';
    },
  };

  return client;
}

const redisClient: RedisLike = config.enableRedis
  ? (createClient({ url: config.redisUrl }) as unknown as RedisLike)
  : createInMemoryRedis();

if (config.enableRedis) {
  (redisClient as any).on?.('error', (err: unknown) => {
    if (config.nodeEnv !== 'test') {
      // eslint-disable-next-line no-console
      console.error('Redis Client Error', err);
    }
  });
}

export const connectRedis = async () => {
  if (config.nodeEnv === 'test') return;
  if (!config.enableRedis) return;
  if (!redisClient.isOpen) {
    await redisClient.connect();
    // eslint-disable-next-line no-console
    console.log('Connected to Redis');
  }
};

export default redisClient;
