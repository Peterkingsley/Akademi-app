import { RedisClientType, createClient } from 'redis';
import { config } from './env';

type RedisState = 'disabled' | 'connecting' | 'connected' | 'degraded';

type RedisLike = {
  isOpen?: boolean;
  connect: () => Promise<void>;
  duplicate: () => RedisLike;
  get: (key: string) => Promise<string | null>;
  setEx: (key: string, ttlSeconds: number, value: string) => Promise<void>;
  set: (key: string, value: string, options?: { EX?: number }) => Promise<void>;
  incr: (key: string) => Promise<number>;
  expire: (key: string, ttlSeconds: number) => Promise<void>;
  ttl: (key: string) => Promise<number>;
  keys: (pattern: string) => Promise<string[]>;
  del: (keys: string[] | string) => Promise<number>;
  ping: () => Promise<string>;
};

type RedisHealth = {
  enabled: boolean;
  state: RedisState;
  lastError: string | null;
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
    async set(key, value, options) {
      const ttlSeconds = options?.EX;
      store.set(key, {
        value,
        expiresAt: typeof ttlSeconds === 'number' ? getNow() + ttlSeconds * 1000 : undefined,
      });
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
    async ttl(key) {
      const entry = getEntry(key);
      if (!entry) return -2;
      if (typeof entry.expiresAt !== 'number') return -1;
      return Math.max(0, Math.ceil((entry.expiresAt - getNow()) / 1000));
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

const inMemoryRedis = createInMemoryRedis();
const RETRY_WINDOW_MS = 30_000;
const RETRY_DELAY_MS = 2_000;
let redisState: RedisState = config.enableRedis ? 'connecting' : 'disabled';
let lastRedisError: string | null = null;

const rawRedisClient: RedisClientType | null = config.enableRedis
  ? createClient({
      url: config.redisUrl,
      socket: {
        reconnectStrategy: false,
      },
    })
  : null;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const markRedisState = (state: RedisState, error?: unknown) => {
  redisState = state;
  if (error) {
    lastRedisError = error instanceof Error ? error.message : String(error);
  } else if (state === 'connected') {
    lastRedisError = null;
  }
};

if (rawRedisClient) {
  rawRedisClient.on('error', (err: unknown) => {
    markRedisState(rawRedisClient.isOpen ? 'connected' : 'degraded', err);
    if (config.nodeEnv !== 'test') {
      console.error('Redis Client Error', err);
    }
  });

  rawRedisClient.on('ready', () => {
    markRedisState('connected');
    if (config.nodeEnv !== 'test') {
      console.log('Redis client ready');
    }
  });

  rawRedisClient.on('reconnecting', () => {
    markRedisState('connecting');
    if (config.nodeEnv !== 'test') {
      console.warn('Redis client reconnecting...');
    }
  });

  rawRedisClient.on('end', () => {
    markRedisState('degraded', 'Redis connection closed');
    if (config.nodeEnv !== 'test') {
      console.warn('Redis connection closed, continuing in degraded mode until reconnect succeeds');
    }
  });
}

const getOperationalRedisClient = () => {
  if (!config.enableRedis || !rawRedisClient || !rawRedisClient.isOpen) {
    return null;
  }
  return rawRedisClient;
};

const withRedisFallback = async <T>(operation: string, fallback: T, fn: (client: RedisClientType) => Promise<T>) => {
  const client = getOperationalRedisClient();
  if (!client) {
    return fallback;
  }

  try {
    return await fn(client);
  } catch (error) {
    markRedisState('degraded', error);
    if (config.nodeEnv !== 'test') {
      console.warn(`Redis operation failed (${operation}); continuing in degraded mode`, error);
    }
    return fallback;
  }
};

const redisClient: RedisLike = {
  get isOpen() {
    return getOperationalRedisClient()?.isOpen ?? inMemoryRedis.isOpen;
  },
  async connect() {
    if (!config.enableRedis) return;
    await connectRedis();
  },
  duplicate() {
    return (rawRedisClient?.duplicate() as unknown as RedisLike) || inMemoryRedis.duplicate();
  },
  async get(key) {
    return withRedisFallback('get', null, client => client.get(key));
  },
  async setEx(key, ttlSeconds, value) {
    await withRedisFallback('setEx', undefined, client => client.setEx(key, ttlSeconds, value));
  },
  async set(key, value, options) {
    await withRedisFallback('set', undefined, client => client.set(key, value, options));
  },
  async incr(key) {
    return withRedisFallback('incr', 0, client => client.incr(key));
  },
  async expire(key, ttlSeconds) {
    await withRedisFallback('expire', undefined, client => client.expire(key, ttlSeconds));
  },
  async ttl(key) {
    return withRedisFallback('ttl', -2, client => client.ttl(key));
  },
  async keys(pattern) {
    return withRedisFallback('keys', [], client => client.keys(pattern));
  },
  async del(keys) {
    return withRedisFallback('del', 0, client => client.del(keys as any));
  },
  async ping() {
    return withRedisFallback('ping', 'DEGRADED', client => client.ping());
  },
};

export const connectRedis = async () => {
  if (config.nodeEnv === 'test' || !config.enableRedis || !rawRedisClient) {
    return;
  }

  if (rawRedisClient.isOpen) {
    markRedisState('connected');
    return;
  }

  markRedisState('connecting');
  const deadline = Date.now() + RETRY_WINDOW_MS;
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts += 1;
    try {
      await rawRedisClient.connect();
      markRedisState('connected');
      console.log(`Connected to Redis after ${attempts} attempt(s)`);
      return;
    } catch (error) {
      markRedisState('connecting', error);
      if (config.nodeEnv !== 'test') {
        console.warn(`Redis connection attempt ${attempts} failed; retrying...`, error instanceof Error ? error.message : error);
      }
      await sleep(RETRY_DELAY_MS);
    }
  }

  markRedisState('degraded', lastRedisError || 'Redis connection timed out');
  try {
    if (rawRedisClient.isOpen) {
      await rawRedisClient.disconnect();
    }
  } catch {
    // ignore disconnect errors; the goal is to stop reconnect churn
  }
  if (config.nodeEnv !== 'test') {
    console.warn('Redis unavailable after 30 seconds; starting in degraded mode');
  }
};

export const getRedisHealth = (): RedisHealth => ({
  enabled: config.enableRedis,
  state: redisState,
  lastError: lastRedisError,
});

export const isRedisDegraded = () => redisState === 'degraded';

export default redisClient;
