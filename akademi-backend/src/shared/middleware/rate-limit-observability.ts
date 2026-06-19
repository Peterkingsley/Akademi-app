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
const records: RateLimitEventRecord[] = [];

const pushRecord = (record: RateLimitEventRecord) => {
  records.unshift(record);
  if (records.length > MAX_RECORDS) {
    records.length = MAX_RECORDS;
  }
};

export const recordHttpRateLimitEvent = (payload: {
  namespace: string;
  path: string;
  method: string;
  ip?: string | null;
  userId?: string | null;
  retryAfterSeconds: number;
}) => {
  pushRecord({
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
  pushRecord({
    transport: 'socket',
    namespaceOrEvent: payload.event,
    routeOrEvent: payload.event,
    ip: payload.ip ?? null,
    userId: payload.userId ?? null,
    retryAfterSeconds: payload.retryAfterSeconds,
    timestamp: new Date().toISOString(),
  });
};

export const getRateLimitMonitoringSnapshot = () => {
  const recent = records.slice(0, 50);
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

  const sortEntries = (map: Map<string, number>, keyLabel: string) =>
    Array.from(map.entries())
      .map(([key, count]) => ({ [keyLabel]: key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

  return {
    totalRecorded: records.length,
    recent,
    topRoutes: sortEntries(byRoute, 'routeOrEvent'),
    topUsers: sortEntries(byUser, 'userId'),
    topIps: sortEntries(byIp, 'ip'),
  };
};
