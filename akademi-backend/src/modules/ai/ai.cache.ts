import { ReplyMode } from '@prisma/client';
import { createHash } from 'crypto';
import redisClient from '../../config/redis';

export function hashString(str: string): string {
  return createHash('sha256').update(str).digest('hex').substring(0, 16);
}

export function getAICacheKey(
  courseCode: string,
  questionText: string,
  replyMode: ReplyMode,
  disciplineDocVersion: number
): string {
  const hashedQuestion = hashString(questionText);
  return `ai:${courseCode}:${hashedQuestion}:${replyMode}:v${disciplineDocVersion}`;
}

export async function getCachedAIResponse(key: string): Promise<string | null> {
  return await redisClient.get(key);
}

export async function setCachedAIResponse(key: string, response: string): Promise<void> {
  await redisClient.setEx(key, 604800, response); // 7 days TTL
}

export async function checkDailyLimit(userId: string, hasActivePaidFeature: boolean): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const limitKey = `ai:limit:${userId}:${today}`;
  const limit = hasActivePaidFeature ? 50 : 10;

  const current = await redisClient.incr(limitKey);
  if (current === 1) {
    await redisClient.expire(limitKey, 86400); // 24 hours TTL
  }

  if (current > limit) {
    throw new Error('Daily AI limit reached');
  }
}

export async function invalidateCacheByDisciplineDoc(courseCode: string): Promise<void> {
  // Finding all keys matching courseCode is difficult with standard Redis keys
  // but if we need a simple implementation:
  const pattern = `ai:${courseCode}:*`;
  const keys = await redisClient.keys(pattern);
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
}
