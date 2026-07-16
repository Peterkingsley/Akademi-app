import { NextFunction, Request, Response } from 'express';
import redisClient from '../../config/redis';
import { config } from '../../config/env';
import { recordHttpRateLimitEvent } from './rate-limit-observability';

type IdentityStrategy = 'ip' | 'user' | 'admin' | 'hybrid';

type RateLimiterOptions = {
  namespace: string;
  windowMs: number;
  max: number;
  message?: string;
  strategy: IdentityStrategy;
  skip?: (req: Request) => boolean;
};

// Fail-safe by default: rate limiting is ENFORCED in every environment unless
// explicitly opted out (RATE_LIMIT_DISABLED=true) or running the test suite.
// A missing/misconfigured NODE_ENV can no longer silently disable abuse
// protection (previously it only enforced for an opt-in allow-list of envs).
const shouldEnforceRateLimit = () =>
  config.nodeEnv !== 'test' && process.env.RATE_LIMIT_DISABLED !== 'true';

// Per-process in-memory fallback used when Redis is unavailable. This keeps the
// limiter failing CLOSED (still counting) instead of the previous behaviour of
// waving every request through when Redis could not be reached.
type MemoryBucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, MemoryBucket>();

const incrMemory = (key: string, windowMs: number) => {
  const now = Date.now();
  const existing = memoryBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket: MemoryBucket = { count: 1, resetAt: now + windowMs };
    memoryBuckets.set(key, bucket);
    return { count: 1, resetSeconds: Math.ceil(windowMs / 1000) };
  }
  existing.count += 1;
  return { count: existing.count, resetSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
};

const sanitizeIdentifier = (value: string) => value.replace(/[^a-zA-Z0-9:._-]/g, '_');

const getClientIdentifier = (req: Request, strategy: IdentityStrategy) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userId = req.user?.userId;
  const adminId = req.admin?.adminId;

  switch (strategy) {
    case 'user':
      return userId || ip;
    case 'admin':
      return adminId || ip;
    case 'hybrid':
      return adminId || userId || ip;
    case 'ip':
    default:
      return ip;
  }
};

const setRateLimitHeaders = (res: Response, max: number, remaining: number, resetSeconds: number) => {
  res.setHeader('RateLimit-Limit', String(max));
  res.setHeader('RateLimit-Remaining', String(Math.max(remaining, 0)));
  res.setHeader('RateLimit-Reset', String(Math.max(resetSeconds, 0)));
  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(remaining, 0)));
  res.setHeader('X-RateLimit-Reset', String(Math.max(resetSeconds, 0)));
};

export const createRateLimiter = ({
  namespace,
  windowMs,
  max,
  message = 'Too many requests. Please try again later.',
  strategy,
  skip,
}: RateLimiterOptions) => {
  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction) => {
    if (skip?.(req)) {
      return next();
    }

    if (!shouldEnforceRateLimit()) {
      return next();
    }

    const identifier = sanitizeIdentifier(getClientIdentifier(req, strategy));
    const key = `rate-limit:${namespace}:${identifier}`;

    let count: number;
    let resetSeconds: number;

    try {
      const redisCount = await redisClient.incr(key);
      if (redisCount === 0) {
        // redisClient returns the fallback value 0 when Redis is unavailable.
        // Degrade to the in-memory limiter rather than waving the request
        // through (fail closed).
        const mem = incrMemory(key, windowMs);
        count = mem.count;
        resetSeconds = mem.resetSeconds;
      } else {
        if (redisCount === 1) {
          await redisClient.expire(key, windowSeconds);
        }
        const ttl = await redisClient.ttl(key);
        count = redisCount;
        resetSeconds = ttl > 0 ? ttl : windowSeconds;
      }
    } catch (error) {
      console.error(`Rate limiter falling back to in-memory for namespace ${namespace}:`, error);
      const mem = incrMemory(key, windowMs);
      count = mem.count;
      resetSeconds = mem.resetSeconds;
    }

    const remaining = max - count;
    setRateLimitHeaders(res, max, remaining, resetSeconds);

    if (count > max) {
      res.setHeader('Retry-After', String(resetSeconds));
      recordHttpRateLimitEvent({
        namespace,
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: req.user?.userId ?? req.admin?.adminId ?? null,
        retryAfterSeconds: resetSeconds,
      });
      console.warn('HTTP rate limit exceeded', {
        namespace,
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: req.user?.userId ?? req.admin?.adminId ?? null,
        retryAfterSeconds: resetSeconds,
      });
      // limitScope/reason let the client (and logs) tell a rate limit apart
      // from every other kind of failure without guessing from status alone -
      // this is what made a prior voice-TTS rate-limit bug take several
      // rounds to root-cause, since every limiter returned the same {message}.
      return res.status(429).json({ message, limitScope: namespace, reason: 'rate_limited' });
    }

    return next();
  };
};

export const generalAuthenticatedApiLimiter = createRateLimiter({
  namespace: 'general-authenticated',
  windowMs: 15 * 60 * 1000,
  max: 150,
  strategy: 'hybrid',
});

export const generalPublicApiLimiter = createRateLimiter({
  namespace: 'general-public',
  windowMs: 15 * 60 * 1000,
  max: 150,
  strategy: 'ip',
});

export const generalOptionalApiLimiter = createRateLimiter({
  namespace: 'general-optional',
  windowMs: 15 * 60 * 1000,
  max: 150,
  strategy: 'hybrid',
});

export const authLoginRateLimiter = createRateLimiter({
  namespace: 'auth-login',
  windowMs: 10 * 60 * 1000,
  max: 5,
  strategy: 'ip',
  message: 'Too many login attempts. Please try again later.',
});

export const authRegisterRateLimiter = createRateLimiter({
  namespace: 'auth-register',
  windowMs: 30 * 60 * 1000,
  max: 5,
  strategy: 'ip',
  message: 'Too many registration attempts. Please try again later.',
});

export const authForgotPasswordRateLimiter = createRateLimiter({
  namespace: 'auth-forgot-password',
  windowMs: 15 * 60 * 1000,
  max: 3,
  strategy: 'ip',
  message: 'Too many password reset requests. Please try again later.',
});

export const authVerifyEmailRateLimiter = createRateLimiter({
  namespace: 'auth-verify-email',
  windowMs: 15 * 60 * 1000,
  max: 10,
  strategy: 'ip',
  message: 'Too many verification attempts. Please try again later.',
});

export const authResetPasswordRateLimiter = createRateLimiter({
  namespace: 'auth-reset-password',
  windowMs: 15 * 60 * 1000,
  max: 10,
  strategy: 'ip',
  message: 'Too many password reset attempts. Please try again later.',
});

export const authResendVerificationRateLimiter = createRateLimiter({
  namespace: 'auth-resend-verification',
  windowMs: 15 * 60 * 1000,
  max: 5,
  strategy: 'ip',
  message: 'Too many verification email requests. Please try again later.',
});

export const authRefreshRateLimiter = createRateLimiter({
  namespace: 'auth-refresh',
  windowMs: 10 * 60 * 1000,
  max: 20,
  strategy: 'ip',
  message: 'Too many token refresh requests. Please try again later.',
});

export const sessionCreationRateLimiter = createRateLimiter({
  namespace: 'session-creation',
  windowMs: 10 * 60 * 1000,
  max: 20,
  strategy: 'hybrid',
  message: 'Too many session creation requests. Please slow down and try again shortly.',
});

export const companionTurnRateLimiter = createRateLimiter({
  namespace: 'companion-turn',
  windowMs: 10 * 60 * 1000,
  max: 120,
  strategy: 'hybrid',
  message: 'Too many tutor requests. Please slow down and try again shortly.',
});

// Normal tutor use can generate several requests per spoken turn, especially when
// voice playback, streaming, and tutor turns happen together. Keep voice traffic
// separate so audio requests do not consume the same bucket as teaching turns.
//
// This limiter only gates POST /voice/stream and POST /voice/tts (stream
// CREATION). GET /voice/stream-audio/:streamId (stream CONSUMPTION) is
// intentionally exempt in sessions.routes.ts - a valid streamId only exists
// because a prior POST already passed this limiter, so metering the GET too
// would double-count the same speech attempt.
//
// Budget math (10-minute window): a heavy tutoring session speaks once every
// ~20s, i.e. 30 speech attempts per 10 minutes. speakAiTextStream retries a
// failed attempt up to 3 times (4 POSTs total) before giving up, so a run of
// sustained upstream trouble costs up to 30 * 4 = 120 requests/10min. At 2x
// that intensity (a speech every ~10s) with full retries: 240/10min. Round
// up with ~1.6x headroom for jitter/overlap with occasional POST /voice/tts
// calls from other screens -> 400.
export const voiceSessionRateLimiter = createRateLimiter({
  namespace: 'voice-session',
  windowMs: 10 * 60 * 1000,
  max: 400,
  strategy: 'hybrid',
  message: 'Too many voice requests. Please slow down and try again shortly.',
});

export const sessionMessageRateLimiter = createRateLimiter({
  namespace: 'session-message',
  windowMs: 10 * 60 * 1000,
  max: 80,
  strategy: 'hybrid',
  message: 'Too many message requests. Please slow down and try again shortly.',
});

export const sessionIngestRateLimiter = createRateLimiter({
  namespace: 'session-ingest',
  windowMs: 10 * 60 * 1000,
  max: 30,
  strategy: 'hybrid',
  message: 'Too many document or audio ingestion requests. Please slow down and try again shortly.',
});

export const materialUploadRateLimiter = createRateLimiter({
  namespace: 'material-upload',
  windowMs: 60 * 60 * 1000,
  max: 80,
  strategy: 'hybrid',
  message: 'Too many material upload requests. Please try again later.',
});

export const waitlistJoinRateLimiter = createRateLimiter({
  namespace: 'waitlist-join',
  windowMs: 10 * 60 * 1000,
  max: 10,
  strategy: 'ip',
  message: 'Too many waitlist requests. Please try again later.',
});

export const waitlistEventRateLimiter = createRateLimiter({
  namespace: 'waitlist-event',
  windowMs: 60 * 1000,
  max: 180,
  strategy: 'ip',
  message: 'Too many waitlist tracking events. Please try again shortly.',
});

export const adminLoginRateLimiter = createRateLimiter({
  namespace: 'admin-login',
  windowMs: 10 * 60 * 1000,
  max: 5,
  strategy: 'ip',
  message: 'Too many admin login attempts. Please try again later.',
});
