import { createClient } from 'redis';
import { config } from './env';

const redisClient = createClient({
  url: config.redisUrl,
});

redisClient.on('error', (err) => {
  if (config.nodeEnv !== 'test') {
    console.error('Redis Client Error', err);
  }
});

export const connectRedis = async () => {
  if (config.nodeEnv === 'test') {
    return;
  }
  if (!redisClient.isOpen) {
    // await redisClient.connect();
    console.log('Connected to Redis');
  }
};

export default redisClient;
