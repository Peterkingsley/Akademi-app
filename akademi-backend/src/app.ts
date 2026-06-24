import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { config } from './config/env';
import { captureBackendException, initSentry, isSentryEnabled, setSentryRequestUser, Sentry } from './config/sentry';
import { connectRedis, disconnectRedis } from './config/redis';
import prisma from './config/db';
import { shutdownQueue } from './config/queue';
import { generalPublicApiLimiter } from './shared/middleware/rate-limit';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import materialsRoutes from './modules/materials/materials.routes';
import sessionsRoutes from './modules/sessions/sessions.routes';
import universitiesRoutes from './modules/universities/universities.routes';
import questionsRoutes from './modules/questions/questions.routes';
import featureAccessRoutes from './modules/feature-access/feature-access.routes';
import examPrepRoutes from './modules/exam-prep/exam-prep.routes';
import competitionsRoutes from './modules/competitions/competitions.routes';
import searchRoutes from './modules/search/search.routes';
import adminRoutes from './modules/admin/admin.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import waitlistRoutes from './modules/waitlist/waitlist.routes';
import { initWebSocket, shutdownWebSocket } from './modules/websocket/websocket.server';
import { startCompetitionScheduler, stopCompetitionScheduler } from './modules/competitions/competition.scheduler';
import { recoverPendingMaterials, startMaterialRetryScheduler, stopMaterialRetryScheduler } from './modules/materials/material-processing';
import { getSystemHealthSnapshot } from './shared/system/system-health';
import { getRuntimeState, markShuttingDown, markStartupComplete } from './shared/system/runtime-state';

initSentry();

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use((req, _res, next) => {
  if (req.path.includes('/teaching')) {
    // eslint-disable-next-line no-console
    console.log(
      `HTTP TEACHING REQUEST - method: ${req.method}, path: ${req.originalUrl}, hasAuth: ${Boolean(req.headers.authorization)}`,
    );
  }
  next();
});
app.use((req, _res, next) => {
  if (req.admin?.adminId) {
    setSentryRequestUser({
      id: req.admin.adminId,
      role: req.admin.role,
      type: 'admin',
    });
  } else if (req.user?.userId) {
    setSentryRequestUser({
      id: req.user.userId,
      role: null,
      type: 'user',
    });
  }

  Sentry.setTag('route.path', req.path);
  Sentry.setTag('route.method', req.method);
  next();
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/materials', materialsRoutes);
app.use('/sessions', sessionsRoutes);
app.use('/universities', generalPublicApiLimiter, universitiesRoutes);
app.use('/questions', questionsRoutes);
app.use('/feature-access', featureAccessRoutes);
app.use('/exam-prep', examPrepRoutes);
app.use('/competitions', competitionsRoutes);
app.use('/search', searchRoutes);
app.use('/admin', adminRoutes);
app.use('/notifications', notificationRoutes);
app.use('/waitlist', generalPublicApiLimiter, waitlistRoutes);

app.get('/health', async (_req, res) => {
  try {
    const snapshot = await getSystemHealthSnapshot();
    res.status(snapshot.status === 'NOT_READY' ? 503 : 200).json(snapshot);
  } catch (error: any) {
    res.status(500).json({ status: 'ERROR', message: error?.message || 'Health check failed' });
  }
});

app.get('/ready', async (_req, res) => {
  try {
    const snapshot = await getSystemHealthSnapshot();
    res.status(snapshot.ready ? 200 : 503).json({
      status: snapshot.ready ? 'READY' : 'NOT_READY',
      ready: snapshot.ready,
      dependencies: snapshot.dependencies,
      runtime: snapshot.runtime,
      timestamp: snapshot.timestamp,
    });
  } catch (error: any) {
    res.status(503).json({ status: 'NOT_READY', ready: false, message: error?.message || 'Readiness check failed' });
  }
});

app.get('/live', (_req, res) => {
  const runtime = getRuntimeState();
  res.status(runtime.shuttingDown ? 503 : 200).json({
    status: runtime.shuttingDown ? 'DRAINING' : 'ALIVE',
    timestamp: new Date().toISOString(),
    service: config.serviceType,
    shuttingDown: runtime.shuttingDown,
  });
});

if (isSentryEnabled()) {
  Sentry.setupExpressErrorHandler(app);
}

const startServer = async () => {
  if (config.nodeEnv === 'test') return;

  try {
    await connectRedis();

    if (config.serviceType === 'api') {
      // await typesenseService.initCollections();
      initWebSocket(server);
      startMaterialRetryScheduler();
      server.listen(config.port, () => {
        markStartupComplete();
        console.log(`API Server is running with WebSocket support on port ${config.port} in ${config.nodeEnv} mode`);
        void recoverPendingMaterials();
      });
    } else if (config.serviceType === 'websocket') {
      initWebSocket(server);
      server.listen(config.port, () => {
        markStartupComplete();
        console.log(`WebSocket Server is running on port ${config.port} in ${config.nodeEnv} mode`);
      });
    } else if (config.serviceType === 'jobs') {
      console.log('Jobs Processor mode active');
      startCompetitionScheduler();
      startMaterialRetryScheduler();
      server.listen(config.port, () => {
        markStartupComplete();
        console.log(`Jobs Health Check Server is running on port ${config.port}`);
        void recoverPendingMaterials();
      });
    } else {
      console.warn(`Unknown service type: ${config.serviceType}. Starting all components.`);
      // await typesenseService.initCollections();
      initWebSocket(server);
      startCompetitionScheduler();
      startMaterialRetryScheduler();
      server.listen(config.port, () => {
        markStartupComplete();
        console.log(`Full Server is running on port ${config.port} in ${config.nodeEnv} mode`);
        void recoverPendingMaterials();
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    captureBackendException(error, { phase: 'startup', serviceType: config.serviceType });
    process.exit(1);
  }
};

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  captureBackendException(reason, { phase: 'unhandledRejection' });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  captureBackendException(error, { phase: 'uncaughtException' });
});

const gracefulShutdown = async (signal: string) => {
  markShuttingDown(signal);
  console.log(`Received ${signal}. Draining server...`);

  const forceExitTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 15000);

  try {
    stopCompetitionScheduler();
    stopMaterialRetryScheduler();
    await shutdownWebSocket();
    await shutdownQueue();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await disconnectRedis();
    await prisma.$disconnect();
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimer);
    console.error('Graceful shutdown failed:', error);
    captureBackendException(error, { phase: 'shutdown', signal });
    process.exit(1);
  }
};

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

startServer();

export { app, server };
