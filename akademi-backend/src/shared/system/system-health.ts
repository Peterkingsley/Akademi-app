import { HeadBucketCommand } from '@aws-sdk/client-s3';
import prisma from '../../config/db';
import { config } from '../../config/env';
import { getQueueHealth } from '../../config/queue';
import { getRedisHealth } from '../../config/redis';
import { s3Client } from '../storage/r2.client';
import { getWebSocketHealth } from '../../modules/websocket/websocket.server';
import { getRuntimeState } from './runtime-state';
import { typesenseClient } from '../search/typesense.client';

export type DependencyStatus = 'online' | 'offline' | 'degraded' | 'disabled' | 'unknown';

export type DependencyDetail = {
  status: DependencyStatus;
  detail?: string | null;
};

export type SystemHealthSnapshot = {
  status: 'OK' | 'DEGRADED' | 'NOT_READY';
  live: boolean;
  ready: boolean;
  dependencies: {
    api: DependencyDetail;
    database: DependencyDetail;
    redis: DependencyDetail;
    queue: DependencyDetail;
    typesense: DependencyDetail;
    claude: DependencyDetail;
    websocket: DependencyDetail;
    r2: DependencyDetail;
  };
  runtime: {
    serviceType: string;
    startedAt: string;
    startupCompletedAt: string | null;
    shuttingDown: boolean;
    shutdownReason: string | null;
  };
  recovery: {
    databaseBackups: string[];
    storageBackups: string[];
    restorePlan: string[];
  };
  timestamp: string;
};

const getRecoveryPosture = () => ({
  databaseBackups: [
    'Enable managed Postgres backups and point-in-time recovery at the hosting provider level.',
    'Verify backup retention and restore permissions at least once per release cycle.',
  ],
  storageBackups: [
    'Cloudflare R2 objects are durable, but versioning or external backup replication should be enabled outside the app.',
    'Critical material source files should be reproducible from uploader clients or mirrored to a secondary bucket for disaster recovery.',
  ],
  restorePlan: [
    'Restore the database from the latest good snapshot into an isolated environment first.',
    'Validate user/auth tables, materials, questions, and payment integrity before switching traffic.',
    'Repoint the app to the restored database, then re-run material/question repair jobs where needed.',
    'If storage loss occurred, restore the bucket or rehydrate critical uploads from mirrored backups and mark unrecoverable materials clearly.',
  ],
});

export const getSystemHealthSnapshot = async (): Promise<SystemHealthSnapshot> => {
  const runtime = getRuntimeState();
  const redis = getRedisHealth();
  const queue = getQueueHealth();

  const dependencies: SystemHealthSnapshot['dependencies'] = {
    api: { status: runtime.shuttingDown ? 'degraded' : 'online', detail: runtime.shuttingDown ? 'Server is draining connections' : 'Accepting requests' },
    database: { status: 'online', detail: 'Primary database reachable' },
    redis: {
      status: !redis.enabled ? 'disabled' : redis.state === 'connected' ? 'online' : redis.state === 'degraded' ? 'degraded' : redis.state === 'connecting' ? 'degraded' : 'unknown',
      detail: !redis.enabled ? 'Redis disabled by configuration' : redis.lastError,
    },
    queue: {
      status: queue.status,
      detail: queue.lastError || (queue.mode === 'inline' ? 'Inline processing mode' : null),
    },
    typesense: { status: 'unknown', detail: 'Typesense check not attempted yet' },
    claude: { status: config.claudeApiKey ? 'online' : 'disabled', detail: config.claudeApiKey ? 'API key configured' : 'Claude API key missing' },
    websocket: { status: 'disabled', detail: 'WebSocket service not running for this process' },
    r2: { status: 'unknown', detail: 'R2 bucket check not attempted yet' },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    dependencies.database = {
      status: 'offline',
      detail: error instanceof Error ? error.message : 'Database health check failed',
    };
  }

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: config.r2BucketName }));
    dependencies.r2 = { status: 'online', detail: `Bucket ${config.r2BucketName} reachable` };
  } catch (error) {
    dependencies.r2 = {
      status: 'offline',
      detail: error instanceof Error ? error.message : 'R2 health check failed',
    };
  }

  try {
    await (typesenseClient as any).health.retrieve();
    dependencies.typesense = { status: 'online', detail: 'Typesense health endpoint reachable' };
  } catch (error) {
    dependencies.typesense = {
      status: config.typesenseApiKey ? 'offline' : 'disabled',
      detail: config.typesenseApiKey
        ? error instanceof Error ? error.message : 'Typesense health check failed'
        : 'Typesense API key missing',
    };
  }

  const websocket = getWebSocketHealth();
  dependencies.websocket = {
    status: websocket.enabled ? (runtime.shuttingDown ? 'degraded' : 'online') : 'disabled',
    detail: websocket.enabled
      ? `${websocket.activeConnections} active connection${websocket.activeConnections === 1 ? '' : 's'}`
      : 'WebSocket server not initialized for this process',
  };

  const blockingDependencyOffline = dependencies.database.status === 'offline' || dependencies.r2.status === 'offline';
  const degradedDependencyPresent = Object.values(dependencies).some((dependency) =>
    dependency.status === 'degraded' || dependency.status === 'offline',
  );

  const ready = !runtime.shuttingDown && !blockingDependencyOffline;
  const live = true;
  const status: SystemHealthSnapshot['status'] = ready
    ? degradedDependencyPresent ? 'DEGRADED' : 'OK'
    : 'NOT_READY';

  return {
    status,
    live,
    ready,
    dependencies,
    runtime: {
      serviceType: config.serviceType,
      startedAt: runtime.startedAt,
      startupCompletedAt: runtime.startupCompletedAt,
      shuttingDown: runtime.shuttingDown,
      shutdownReason: runtime.shutdownReason,
    },
    recovery: getRecoveryPosture(),
    timestamp: new Date().toISOString(),
  };
};
