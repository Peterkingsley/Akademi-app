// createRateLimiter's own test-mode bypass (shouldEnforceRateLimit) short-
// circuits enforcement whenever config.nodeEnv === 'test', which is exactly
// the env every other test file runs under. Mock config/env here so this
// file's module registry sees a non-test nodeEnv and actually exercises the
// limiter logic instead of always calling next().
jest.mock('../src/config/env', () => ({
  config: {
    nodeEnv: 'production',
  },
}));

const incrMock = jest.fn();
const expireMock = jest.fn();
const ttlMock = jest.fn();

jest.mock('../src/config/redis', () => ({
  __esModule: true,
  default: {
    incr: (...args: any[]) => incrMock(...args),
    expire: (...args: any[]) => expireMock(...args),
    ttl: (...args: any[]) => ttlMock(...args),
    get: jest.fn(),
    set: jest.fn(),
  },
}));

import { createRateLimiter } from '../src/shared/middleware/rate-limit';

function createMockReq(overrides: Record<string, any> = {}) {
  return {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    path: '/',
    originalUrl: '/',
    method: 'GET',
    user: undefined,
    admin: undefined,
    ...overrides,
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: undefined as number | undefined,
    jsonBody: undefined as any,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.jsonBody = body;
      return this;
    },
  };
  return res;
}

describe('createRateLimiter', () => {
  beforeEach(() => {
    incrMock.mockReset();
    expireMock.mockReset();
    ttlMock.mockReset();
  });

  it('allows requests through without counting when skip() matches', async () => {
    const limiter = createRateLimiter({
      namespace: 'test-skip',
      windowMs: 1000,
      max: 1,
      strategy: 'ip',
      skip: (req) => req.path.includes('/voice/'),
    });

    const req = createMockReq({ path: '/123/voice/stream' });
    const res = createMockRes();
    const next = jest.fn();

    // Call well past `max` - if skip() is honored, incr should never even
    // be reached and every call should pass through.
    for (let i = 0; i < 5; i += 1) {
      await limiter(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(5);
    expect(incrMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
  });

  it('still enforces the limit on non-skipped paths', async () => {
    const limiter = createRateLimiter({
      namespace: 'test-enforce',
      windowMs: 1000,
      max: 1,
      strategy: 'ip',
      skip: (req) => req.path.includes('/voice/'),
    });

    incrMock.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    expireMock.mockResolvedValue(undefined);
    ttlMock.mockResolvedValue(1);

    const req = createMockReq({ path: '/companion' });
    const next = jest.fn();

    const res1 = createMockRes();
    await limiter(req, res1, next);
    expect(res1.statusCode).toBeUndefined();

    const res2 = createMockRes();
    await limiter(req, res2, next);
    expect(res2.statusCode).toBe(429);
  });

  it('includes limitScope and reason in the 429 body so callers never have to guess which limiter fired', async () => {
    const limiter = createRateLimiter({
      namespace: 'voice-session',
      windowMs: 1000,
      max: 1,
      strategy: 'ip',
    });

    incrMock.mockResolvedValueOnce(2);
    expireMock.mockResolvedValue(undefined);
    ttlMock.mockResolvedValue(30);

    const req = createMockReq();
    const res = createMockRes();
    const next = jest.fn();

    await limiter(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(res.jsonBody).toMatchObject({
      limitScope: 'voice-session',
      reason: 'rate_limited',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('falls back to the in-memory bucket (fail closed) when Redis incr signals unavailability', async () => {
    const limiter = createRateLimiter({
      namespace: 'test-fail-closed',
      windowMs: 60_000,
      max: 1,
      strategy: 'ip',
    });

    // redisClient's own wrapper returns 0 as a sentinel when Redis is down.
    incrMock.mockResolvedValue(0);

    const req = createMockReq();
    const next = jest.fn();

    const res1 = createMockRes();
    await limiter(req, res1, next);
    expect(res1.statusCode).toBeUndefined();

    const res2 = createMockRes();
    await limiter(req, res2, next);
    expect(res2.statusCode).toBe(429);
    expect(res2.jsonBody).toMatchObject({ limitScope: 'test-fail-closed', reason: 'rate_limited' });
  });

  it('simulates sustained session traffic blowing through the OLD general-limiter threshold (150) and confirms voice requests keep succeeding throughout', async () => {
    // Mirrors sessionsGeneralRateLimiter's shape before the fix (max: 150),
    // to prove the regression itself - not just the new higher budget - is
    // what's fixed: voice traffic must never be affected by this bucket at
    // any max, because it is skipped entirely.
    const limiter = createRateLimiter({
      namespace: 'general-authenticated-sessions',
      windowMs: 15 * 60 * 1000,
      max: 150,
      strategy: 'hybrid',
      skip: (req) => req.path.includes('/voice/'),
    });

    let counter = 0;
    incrMock.mockImplementation(async () => {
      counter += 1;
      return counter;
    });
    expireMock.mockResolvedValue(undefined);
    ttlMock.mockResolvedValue(900);

    const next = jest.fn();

    // Drive 200 non-voice requests through the bucket - well past the old
    // 150 max - interleaving a voice request after every batch of 20.
    let sawGeneral429 = false;
    for (let i = 0; i < 200; i += 1) {
      const res = createMockRes();
      await limiter(createMockReq({ path: '/companion' }), res, next);
      if (res.statusCode === 429) sawGeneral429 = true;

      if (i % 20 === 19) {
        const voiceRes = createMockRes();
        await limiter(createMockReq({ path: '/abc123/voice/stream-audio/stream-1' }), voiceRes, next);
        expect(voiceRes.statusCode).toBeUndefined();
      }
    }

    // Sanity check: the general bucket genuinely was exhausted by non-voice
    // traffic alone (this is the exact failure mode from the bug report) -
    // yet every single interleaved voice request above still passed.
    expect(sawGeneral429).toBe(true);
  });
});
