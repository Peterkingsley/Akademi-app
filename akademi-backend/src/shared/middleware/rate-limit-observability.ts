import redisClient from '../../config/redis';

type RateLimitTransport = 'http' | 'socket';

export type RateLimitEventRecord = {
  transport: RateLimitTransport;
  namespaceOrEvent: string;
  routeOrEvent: string;
  method?: string;
  ip?: string | null;
  userId?: string | null;
  retryAfterSeconds: number;
  timestamp: string;
};

const MAX_RECORDS = 500;
const RECENT_LIMIT = 50;
const REDIS_KEY = 'monitoring:rate-limits:v1';
const REDIS_TTL_SECONDS = 7 * 24 * 60 * 60;
const inMemoryRecords: RateLimitEventRecord[] = [];

const updateInMemory = (record: RateLimitEventRecord) => {
  inMemoryRecords.unshift(record);
  if (inMemoryRecords.length > MAX_RECORDS) {
    inMemoryRecords.length = MAX_RECORDS;
  }
};

const sortEntries = (map: Map<string, number>, keyLabel: string) =>
  Array.from(map.entries())
    .map(([key, count]) => ({ [keyLabel]: key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

const buildSnapshot = (records: RateLimitEventRecord[]) => {
  const recent = records.slice(0, RECENT_LIMIT);
  const byRoute = new Map<string, number>();
  const byUser = new Map<string, number>();
  const byIp = new Map<string, number>();

  for (const record of records) {
    byRoute.set(record.routeOrEvent, (byRoute.get(record.routeOrEvent) || 0) + 1);
    if (record.userId) {
      byUser.set(record.userId, (byUser.get(record.userId) || 0) + 1);
    }
    if (record.ip) {
      byIp.set(record.ip, (byIp.get(record.ip) || 0) + 1);
    }
  }

  return {
    totalRecorded: records.length,
    recent,
    topRoutes: sortEntries(byRoute, 'routeOrEvent'),
    topUsers: sortEntries(byUser, 'userId'),
    topIps: sortEntries(byIp, 'ip'),
    persistence: redisClient.isOpen ? 'redis' : 'memory-fallback',
  };
};

const persistRecord = async (record: RateLimitEventRecord) => {
  const raw = await redisClient.get(REDIS_KEY);
  const parsed = raw ? safeParseRecords(raw) : [];
  parsed.unshift(record);
  if (parsed.length > MAX_RECORDS) {
    parsed.length = MAX_RECORDS;
  }
  await redisClient.set(REDIS_KEY, JSON.stringify(parsed), { EX: REDIS_TTL_SECONDS });
};

const safeParseRecords = (raw: string): RateLimitEventRecord[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as RateLimitEventRecord[] : [];
  } catch {
    return [];
  }
};

const queuePersist = (record: RateLimitEventRecord) => {
  updateInMemory(record);
  void persistRecord(record).catch((error) => {
    console.warn('Failed to persist rate-limit event to Redis; keeping memory fallback', error);
  });
};

export const recordHttpRateLimitEvent = (payload: {
  namespace: string;
  path: string;
  method: string;
  ip?: string | null;
  userId?: string | null;
  retryAfterSeconds: number;
}) => {
  queuePersist({
    transport: 'http',
    namespaceOrEvent: payload.namespace,
    routeOrEvent: payload.path,
    method: payload.method,
    ip: payload.ip ?? null,
    userId: payload.userId ?? null,
    retryAfterSeconds: payload.retryAfterSeconds,
    timestamp: new Date().toISOString(),
  });
};

export const recordSocketRateLimitEvent = (payload: {
  event: string;
  ip?: string | null;
  userId?: string | null;
  retryAfterSeconds: number;
}) => {
  queuePersist({
    transport: 'socket',
    namespaceOrEvent: payload.event,
    routeOrEvent: payload.event,
    ip: payload.ip ?? null,
    userId: payload.userId ?? null,
    retryAfterSeconds: payload.retryAfterSeconds,
    timestamp: new Date().toISOString(),
  });
};

export const getRateLimitMonitoringSnapshot = async () => {
  const raw = await redisClient.get(REDIS_KEY);
  if (raw) {
    const redisRecords = safeParseRecords(raw);
    if (redisRecords.length > 0) {
      return buildSnapshot(redisRecords);
    }
  }

  return buildSnapshot(inMemoryRecords);
};
