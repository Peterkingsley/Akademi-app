import * as Sentry from '@sentry/node';
import { typesenseService } from './shared/search/typesense.service';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { config } from './config/env';
import { connectRedis } from './config/redis';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import materialsRoutes from './modules/materials/materials.routes';
import sessionsRoutes from './modules/sessions/sessions.routes';
import universitiesRoutes from './modules/universities/universities.routes';
import questionsRoutes from './modules/questions/questions.routes';
import featureAccessRoutes from './modules/feature-access/feature-access.routes';
import examPrepRoutes from './modules/exam-prep/exam-prep.routes';
import searchRoutes from './modules/search/search.routes';
import { initWebSocket } from './modules/websocket/websocket.server';

// Sentry Initialization — only runs if a real DSN is provided
if (config.sentryDsn && config.sentryDsn !== 'your_sentry_dsn' && config.sentryDsn.startsWith('http')) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: 1.0,
  });
}

const app = express();
const server = http.createServer(app);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/materials', materialsRoutes);
app.use('/sessions', sessionsRoutes);
app.use('/universities', universitiesRoutes);
app.use('/questions', questionsRoutes);
app.use('/feature-access', featureAccessRoutes);
app.use('/exam-prep', examPrepRoutes);
app.use('/search', searchRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: config.serviceType
  });
});

// Sentry Error Handler — only runs if a real DSN is provided
if (config.sentryDsn && config.sentryDsn !== 'your_sentry_dsn' && config.sentryDsn.startsWith('http')) {
  Sentry.setupExpressErrorHandler(app);
}

// Start Server
const startServer = async () => {
  if (config.nodeEnv === 'test') return;

  try {
    await connectRedis();

    if (config.serviceType === 'api') {
      await typesenseService.initCollections();
      server.listen(config.port, () => {
        console.log(`API Server is running on port ${config.port} in ${config.nodeEnv} mode`);
      });
    } else if (config.serviceType === 'websocket') {
      initWebSocket(server);
      server.listen(config.port, () => {
        console.log(`WebSocket Server is running on port ${config.port} in ${config.nodeEnv} mode`);
      });
    } else if (config.serviceType === 'jobs') {
      console.log('Jobs Processor mode active');
      server.listen(config.port, () => {
        console.log(`Jobs Health Check Server is running on port ${config.port}`);
      });
    } else {
      console.warn(`Unknown service type: ${config.serviceType}. Starting all components.`);
      await typesenseService.initCollections();
      initWebSocket(server);
      server.listen(config.port, () => {
        console.log(`Full Server is running on port ${config.port} in ${config.nodeEnv} mode`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    if (config.sentryDsn && config.sentryDsn !== 'your_sentry_dsn' && config.sentryDsn.startsWith('http')) {
      Sentry.captureException(error);
    }
    process.exit(1);
  }
};

startServer();

export { app, server };