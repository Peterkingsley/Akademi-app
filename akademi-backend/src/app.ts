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

const app = express();
const server = http.createServer(app);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per minute
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
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start Server
const startServer = async () => {
  try {
    await connectRedis();
    initWebSocket(server);
    if (config.nodeEnv !== 'test') {
      server.listen(config.port, () => {
        console.log(`Server is running on port ${config.port} in ${config.nodeEnv} mode`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { app, server };
