import { NextFunction, Request, Response } from 'express';
import redisClient from '../../config/redis';
import { config } from '../../config/env';

type IdentityStrategy = 'ip' | 'user' | 'admin' | 'hybrid';

type RateLimiterOptions = {
  namespace: string;
  windowMs: number;
  max: number;
  message?: string;
  strategy: IdentityStrategy;
};

const ENFORCED_ENVS = new Set(['production', 'staging']);

const shouldEnforceRateLimit = () => ENFORCED_ENVS.has(config.nodeEnv);

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
}: RateLimiterOptions) => {
  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!shouldEnforceRateLimit()) {
      return next();
    }

    const identifier = sanitizeIdentifier(getClientIdentifier(req, strategy));
    const key = `rate-limit:${namespace}:${identifier}`;

    try {
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, windowSeconds);
      }

      const ttl = await redisClient.ttl(key);
      const resetSeconds = ttl > 0 ? ttl : windowSeconds;
      const remaining = max - count;

      setRateLimitHeaders(res, max, remaining, resetSeconds);

      if (count > max) {
        res.setHeader('Retry-After', String(resetSeconds));
        return res.status(429).json({ message });
      }

      return next();
    } catch (error) {
      console.error(`Rate limiter failed for namespace ${namespace}:`, error);
      return next();
    }
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

export const authRefreshRateLimiter = createRateLimiter({
  namespace: 'auth-refresh',
  windowMs: 10 * 60 * 1000,
  max: 20,
  strategy: 'ip',
  message: 'Too many token refresh requests. Please try again later.',
});

export const sessionInteractionRateLimiter = createRateLimiter({
  namespace: 'session-interaction',
  windowMs: 10 * 60 * 1000,
  max: 25,
  strategy: 'hybrid',
  message: 'Too many session requests. Please slow down and try again shortly.',
});

export const materialUploadRateLimiter = createRateLimiter({
  namespace: 'material-upload',
  windowMs: 60 * 60 * 1000,
  max: 10,
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

export const adminLoginRateLimiter = createRateLimiter({
  namespace: 'admin-login',
  windowMs: 10 * 60 * 1000,
  max: 5,
  strategy: 'ip',
  message: 'Too many admin login attempts. Please try again later.',
});
