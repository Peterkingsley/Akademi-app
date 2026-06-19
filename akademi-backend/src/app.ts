import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { typesenseService } from './shared/search/typesense.service';
import { config } from './config/env';
import { captureBackendException, initSentry, isSentryEnabled, setSentryRequestUser, Sentry } from './config/sentry';
import { connectRedis, getRedisHealth } from './config/redis';
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
import { initWebSocket } from './modules/websocket/websocket.server';
import { startCompetitionScheduler } from './modules/competitions/competition.scheduler';

initSentry();

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
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

app.get('/health', (_req, res) => {
  const redis = getRedisHealth();
  res.status(200).json({
    status: redis.enabled && redis.state === 'degraded' ? 'DEGRADED' : 'OK',
    timestamp: new Date().toISOString(),
    service: config.serviceType,
    redis,
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
      startCompetitionScheduler();
      server.listen(config.port, () => {
        console.log(`API Server is running with WebSocket support on port ${config.port} in ${config.nodeEnv} mode`);
      });
    } else if (config.serviceType === 'websocket') {
      initWebSocket(server);
      server.listen(config.port, () => {
        console.log(`WebSocket Server is running on port ${config.port} in ${config.nodeEnv} mode`);
      });
    } else if (config.serviceType === 'jobs') {
      console.log('Jobs Processor mode active');
      startCompetitionScheduler();
      server.listen(config.port, () => {
        console.log(`Jobs Health Check Server is running on port ${config.port}`);
      });
    } else {
      console.warn(`Unknown service type: ${config.serviceType}. Starting all components.`);
      // await typesenseService.initCollections();
      initWebSocket(server);
      startCompetitionScheduler();
      server.listen(config.port, () => {
        console.log(`Full Server is running on port ${config.port} in ${config.nodeEnv} mode`);
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

startServer();

export { app, server };
