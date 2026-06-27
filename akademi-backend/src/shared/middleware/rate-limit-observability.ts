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

type RateLimitAlertSeverity = 'high' | 'medium';

type RateLimitAlert = {
  id: string;
  type: 'auth-abuse' | 'ai-session-spam' | 'competition-spam' | 'socket-offender';
  severity: RateLimitAlertSeverity;
  title: string;
  message: string;
  count: number;
  windowMinutes: number;
  target?: string;
  lastSeenAt?: string;
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

const filterWindow = (records: RateLimitEventRecord[], windowMinutes: number) => {
  const cutoff = Date.now() - windowMinutes * 60 * 1000;
  return records.filter((record) => {
    const ts = new Date(record.timestamp).getTime();
    return !Number.isNaN(ts) && ts >= cutoff;
  });
};

const buildAlerts = (records: RateLimitEventRecord[]): RateLimitAlert[] => {
  const alerts: RateLimitAlert[] = [];
  const window15 = filterWindow(records, 15);
  const window10 = filterWindow(records, 10);
  const window5 = filterWindow(records, 5);

  const authNamespaces = new Set(['auth-login', 'auth-register', 'auth-forgot-password', 'admin-login']);
  const aiNamespaces = new Set([
    'session-creation',
    'companion-turn',
    'voice-session',
    'session-message',
    'session-ingest',
  ]);

  const authRecords = window15.filter((record) => authNamespaces.has(record.namespaceOrEvent));
  if (authRecords.length >= 20) {
    alerts.push({
      id: 'auth-abuse',
      type: 'auth-abuse',
      severity: authRecords.length >= 40 ? 'high' : 'medium',
      title: 'Auth abuse spike',
      message: `${authRecords.length} blocked auth attempts in the last 15 minutes.`,
      count: authRecords.length,
      windowMinutes: 15,
      lastSeenAt: authRecords[0]?.timestamp,
    });
  }

  const aiRecords = window10.filter((record) => aiNamespaces.has(record.namespaceOrEvent));
  if (aiRecords.length >= 15) {
    alerts.push({
      id: 'ai-session-spam',
      type: 'ai-session-spam',
      severity: aiRecords.length >= 30 ? 'high' : 'medium',
      title: 'AI or session spam pressure',
      message: `${aiRecords.length} blocked AI or session interaction hits in the last 10 minutes.`,
      count: aiRecords.length,
      windowMinutes: 10,
      lastSeenAt: aiRecords[0]?.timestamp,
    });
  }

  const competitionRecords = window10.filter((record) => {
    const key = `${record.namespaceOrEvent} ${record.routeOrEvent}`.toLowerCase();
    return key.includes('competition');
  });
  if (competitionRecords.length >= 12) {
    alerts.push({
      id: 'competition-spam',
      type: 'competition-spam',
      severity: competitionRecords.length >= 24 ? 'high' : 'medium',
      title: 'Competition spam pressure',
      message: `${competitionRecords.length} blocked competition events in the last 10 minutes.`,
      count: competitionRecords.length,
      windowMinutes: 10,
      lastSeenAt: competitionRecords[0]?.timestamp,
    });
  }

  const socketOffenderCounts = new Map<string, { count: number; lastSeenAt?: string }>();
  for (const record of window5) {
    if (record.transport !== 'socket') continue;
    const key = record.userId || record.ip || 'unknown';
    const current = socketOffenderCounts.get(key);
    socketOffenderCounts.set(key, {
      count: (current?.count || 0) + 1,
      lastSeenAt: current?.lastSeenAt || record.timestamp,
    });
  }

  const topSocketOffender = Array.from(socketOffenderCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)[0];

  if (topSocketOffender && topSocketOffender[1].count >= 8) {
    alerts.push({
      id: 'socket-offender',
      type: 'socket-offender',
      severity: topSocketOffender[1].count >= 16 ? 'high' : 'medium',
      title: 'Repeated socket throttling from one source',
      message: `${topSocketOffender[1].count} blocked socket events from ${topSocketOffender[0]} in the last 5 minutes.`,
      count: topSocketOffender[1].count,
      windowMinutes: 5,
      target: topSocketOffender[0],
      lastSeenAt: topSocketOffender[1].lastSeenAt,
    });
  }

  return alerts.sort((a, b) => {
    if (a.severity === b.severity) return b.count - a.count;
    return a.severity === 'high' ? -1 : 1;
  });
};

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
    alerts: buildAlerts(records),
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
