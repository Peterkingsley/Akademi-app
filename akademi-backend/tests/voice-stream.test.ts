// Must be set before ../src/config/env is imported (directly or transitively),
// since config values are computed once at module load time.
process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key';

import redisClient, { isRedisDegraded } from '../src/config/redis';

jest.mock('../src/config/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    setEx: jest.fn().mockResolvedValue(undefined),
  },
  isRedisDegraded: jest.fn().mockReturnValue(false),
}));

jest.mock('ws', () => {
  class FakeResponse {
    private listeners: Record<string, Array<(...args: any[]) => void>> = {};
    constructor(public statusCode: number) {}
    on(event: string, cb: (...args: any[]) => void) {
      (this.listeners[event] ||= []).push(cb);
      return this;
    }
    emit(event: string, ...args: any[]) {
      (this.listeners[event] || []).forEach((cb) => cb(...args));
    }
  }

  class FakeWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSED = 3;
    static instances: FakeWebSocket[] = [];

    readyState = FakeWebSocket.CONNECTING;
    send = jest.fn();
    // Real 'ws' closes asynchronously (a close handshake, not an immediate
    // event) - mirror that so ordering against the caller's own synchronous
    // "settled" guard matches production behavior.
    close = jest.fn(() => {
      this.readyState = FakeWebSocket.CLOSED;
      setImmediate(() => this.emit('close', 1000, Buffer.from('')));
    });

    private listeners: Record<string, Array<(...args: any[]) => void>> = {};

    constructor() {
      FakeWebSocket.instances.push(this);
    }

    on(event: string, cb: (...args: any[]) => void) {
      (this.listeners[event] ||= []).push(cb);
      return this;
    }

    emit(event: string, ...args: any[]) {
      (this.listeners[event] || []).forEach((cb) => cb(...args));
    }

    // Test helper: simulate the server rejecting the WS upgrade with a plain
    // HTTP response (invalid key, voice not found, etc).
    emitUnexpectedResponse(statusCode: number, body: string) {
      const response = new FakeResponse(statusCode);
      this.emit('unexpected-response', {}, response);
      response.emit('data', Buffer.from(body));
      response.emit('end');
    }
  }

  return {
    __esModule: true,
    default: FakeWebSocket,
  };
});

import { ElevenLabsStreamService } from '../src/modules/voice/elevenlabs-stream.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const FakeWebSocket = require('ws').default;

function createMockResponse() {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {};
  const res: any = {
    headersSent: false,
    statusCode: undefined as number | undefined,
    jsonBody: undefined as any,
    written: [] as Buffer[],
    ended: false,
    destroyed: false,
    destroyError: undefined as Error | undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader: jest.fn(),
    json(body: any) {
      this.jsonBody = body;
      this.headersSent = true;
      return this;
    },
    write(chunk: Buffer) {
      this.written.push(chunk);
      this.headersSent = true;
      return true;
    },
    end() {
      this.ended = true;
    },
    destroy(error?: Error) {
      this.destroyed = true;
      this.destroyError = error;
    },
    on(event: string, cb: (...args: any[]) => void) {
      (listeners[event] ||= []).push(cb);
      return this;
    },
    emit(event: string, ...args: any[]) {
      (listeners[event] || []).forEach((cb) => cb(...args));
    },
  };
  return res;
}

// streamPendingAudio awaits at least one Redis round trip before it reaches
// pipeElevenLabsStream's `new WebSocket(...)` call, so the socket instance
// isn't available on the same tick the call is made - poll a macrotask at a
// time until it shows up.
async function waitForSocket(): Promise<any> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (FakeWebSocket.instances.length > 0) return FakeWebSocket.instances[0];
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('WebSocket was not constructed in time');
}

describe('ElevenLabsStreamService', () => {
  let service: ElevenLabsStreamService;
  const sessionId = 'session-1';
  const userId = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
    (isRedisDegraded as jest.Mock).mockReturnValue(false);
    FakeWebSocket.instances = [];
    service = new ElevenLabsStreamService();
  });

  describe('createPendingStream', () => {
    it('persists the pending stream in Redis with the documented key shape and TTL', async () => {
      const result = await service.createPendingStream(sessionId, userId, 'Hello there');

      expect(redisClient.setEx).toHaveBeenCalledTimes(1);
      const [key, ttlSeconds, value] = (redisClient.setEx as jest.Mock).mock.calls[0];
      expect(key).toBe(`voice-stream:${result.streamId}`);
      expect(ttlSeconds).toBe(5 * 60);

      const parsed = JSON.parse(value);
      expect(parsed).toMatchObject({ sessionId, userId, text: 'Hello there' });
      expect(typeof parsed.createdAt).toBe('number');
      expect(parsed.consumedAt).toBeUndefined();

      expect(result.path).toBe(`/sessions/${sessionId}/voice/stream-audio/${result.streamId}`);
    });

    it('throws for empty text without touching Redis', async () => {
      await expect(service.createPendingStream(sessionId, userId, '   ')).rejects.toThrow(
        'Text is required for speech synthesis.',
      );
      expect(redisClient.setEx).not.toHaveBeenCalled();
    });

    it('rejects with elevenlabs_not_configured when the API key is missing', async () => {
      const originalKey = process.env.ELEVENLABS_API_KEY;
      process.env.ELEVENLABS_API_KEY = '';

      let IsolatedService: typeof ElevenLabsStreamService;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        IsolatedService = require('../src/modules/voice/elevenlabs-stream.service').ElevenLabsStreamService;
      });

      const isolatedService = new IsolatedService!();
      process.env.ELEVENLABS_API_KEY = originalKey;

      await expect(isolatedService.createPendingStream(sessionId, userId, 'hi')).rejects.toMatchObject({
        statusCode: 500,
        reason: 'elevenlabs_not_configured',
      });
    });
  });

  describe('streamPendingAudio lookup', () => {
    it('throws a 404 VoiceStreamError when the record is missing', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      const res = createMockResponse();

      await expect(service.streamPendingAudio(sessionId, userId, 'missing-id', res)).rejects.toMatchObject({
        statusCode: 404,
        reason: 'stream_not_found',
      });
    });

    it('throws a 503 VoiceStreamError when the record is missing and Redis is degraded', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      (isRedisDegraded as jest.Mock).mockReturnValue(true);
      const res = createMockResponse();

      await expect(service.streamPendingAudio(sessionId, userId, 'missing-id', res)).rejects.toMatchObject({
        statusCode: 503,
      });
    });

    it('throws a 404 VoiceStreamError when the session/user does not own the record', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(
        JSON.stringify({ sessionId: 'other-session', userId, text: 'hi', createdAt: Date.now() }),
      );
      const res = createMockResponse();

      await expect(service.streamPendingAudio(sessionId, userId, 'stream-1', res)).rejects.toMatchObject({
        statusCode: 404,
        reason: 'stream_not_found',
      });
    });

    it('throws a 409 VoiceStreamError when re-read outside the 60s consumed window', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(
        JSON.stringify({
          sessionId,
          userId,
          text: 'hi',
          createdAt: Date.now() - 120000,
          consumedAt: Date.now() - 61000,
        }),
      );
      const res = createMockResponse();

      await expect(service.streamPendingAudio(sessionId, userId, 'stream-1', res)).rejects.toMatchObject({
        statusCode: 409,
        reason: 'stream_consumed',
      });
    });

    it('marks the record consumed on first read', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(
        JSON.stringify({ sessionId, userId, text: 'hi', createdAt: Date.now() }),
      );
      const res = createMockResponse();

      const promise = service.streamPendingAudio(sessionId, userId, 'stream-1', res);
      const socket: any = await waitForSocket();
      socket.readyState = FakeWebSocket.OPEN;
      socket.emit('open');
      socket.emit('message', JSON.stringify({ audio: Buffer.from('audio').toString('base64'), isFinal: true }));
      await promise;

      expect(redisClient.setEx).toHaveBeenCalledTimes(1);
      const [, , value] = (redisClient.setEx as jest.Mock).mock.calls[0];
      const parsed = JSON.parse(value);
      expect(typeof parsed.consumedAt).toBe('number');
    });

    it('allows a re-read within the 60s consumed window without re-writing the record', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(
        JSON.stringify({
          sessionId,
          userId,
          text: 'hi',
          createdAt: Date.now() - 30000,
          consumedAt: Date.now() - 30000,
        }),
      );
      const res = createMockResponse();

      const promise = service.streamPendingAudio(sessionId, userId, 'stream-1', res);
      const socket: any = await waitForSocket();
      socket.readyState = FakeWebSocket.OPEN;
      socket.emit('open');
      socket.emit('message', JSON.stringify({ audio: Buffer.from('audio').toString('base64'), isFinal: true }));
      await promise;

      expect(redisClient.setEx).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });
  });

  describe('pipeElevenLabsStream status mapping', () => {
    const pendingRecord = () =>
      JSON.stringify({ sessionId, userId, text: 'hi', createdAt: Date.now() });

    it('streams audio chunks and completes with a 200 on success', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(pendingRecord());
      const res = createMockResponse();

      const promise = service.streamPendingAudio(sessionId, userId, 'stream-1', res);
      const socket: any = await waitForSocket();
      socket.readyState = FakeWebSocket.OPEN;
      socket.emit('open');
      socket.emit('message', JSON.stringify({ audio: Buffer.from('chunk').toString('base64'), isFinal: false }));
      socket.emit('message', JSON.stringify({ isFinal: true }));
      await promise;

      expect(res.statusCode).toBe(200);
      expect(res.written).toHaveLength(1);
      expect(res.ended).toBe(true);
    });

    it('maps a concurrency error from the WS error path to 429', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(pendingRecord());
      const res = createMockResponse();

      const promise = service.streamPendingAudio(sessionId, userId, 'stream-1', res);
      const socket: any = await waitForSocket();
      socket.readyState = FakeWebSocket.OPEN;
      socket.emit('open');
      socket.emit('error', new Error('Too many concurrent requests for this account'));

      await expect(promise).rejects.toMatchObject({ statusCode: 429, reason: 'elevenlabs_concurrency_limit' });
      expect(res.statusCode).toBe(429);
      expect(res.jsonBody.reason).toBe('elevenlabs_concurrency_limit');
    });

    it('maps a concurrency error from parsed.error to 429', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(pendingRecord());
      const res = createMockResponse();

      const promise = service.streamPendingAudio(sessionId, userId, 'stream-1', res);
      const socket: any = await waitForSocket();
      socket.readyState = FakeWebSocket.OPEN;
      socket.emit('open');
      socket.emit('message', JSON.stringify({ error: 'quota exceeded for this API key' }));

      await expect(promise).rejects.toMatchObject({ statusCode: 429, reason: 'elevenlabs_quota_exceeded' });
      expect(res.statusCode).toBe(429);
    });

    it('maps a generic WS error to 503', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(pendingRecord());
      const res = createMockResponse();

      const promise = service.streamPendingAudio(sessionId, userId, 'stream-1', res);
      const socket: any = await waitForSocket();
      socket.readyState = FakeWebSocket.OPEN;
      socket.emit('open');
      socket.emit('error', new Error('connection reset'));

      await expect(promise).rejects.toMatchObject({ statusCode: 503, reason: 'elevenlabs_ws_error' });
      expect(res.statusCode).toBe(503);
    });

    it('rejects with an error when the client disconnects mid-stream', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(pendingRecord());
      const res = createMockResponse();

      const promise = service.streamPendingAudio(sessionId, userId, 'stream-1', res);
      const socket: any = await waitForSocket();
      socket.readyState = FakeWebSocket.OPEN;
      socket.emit('open');
      res.emit('close');

      await expect(promise).rejects.toThrow('Client closed the audio stream.');
      expect(res.statusCode).toBe(503);
    });

    it('maps an unexpected-response 401 during the WS upgrade to elevenlabs_auth_failed', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(pendingRecord());
      const res = createMockResponse();

      const promise = service.streamPendingAudio(sessionId, userId, 'stream-1', res);
      const socket: any = await waitForSocket();
      socket.emitUnexpectedResponse(401, JSON.stringify({ detail: 'invalid_api_key' }));

      await expect(promise).rejects.toMatchObject({ statusCode: 401, reason: 'elevenlabs_auth_failed' });
      expect(res.statusCode).toBe(401);
    });

    it('maps an unexpected-response 404 during the WS upgrade to elevenlabs_voice_not_found', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(pendingRecord());
      const res = createMockResponse();

      const promise = service.streamPendingAudio(sessionId, userId, 'stream-1', res);
      const socket: any = await waitForSocket();
      socket.emitUnexpectedResponse(404, JSON.stringify({ detail: 'voice_not_found' }));

      await expect(promise).rejects.toMatchObject({ statusCode: 404, reason: 'elevenlabs_voice_not_found' });
    });

    it('treats a premature close with code 1008 (policy violation) as an auth failure, not success', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(pendingRecord());
      const res = createMockResponse();

      const promise = service.streamPendingAudio(sessionId, userId, 'stream-1', res);
      const socket: any = await waitForSocket();
      socket.readyState = FakeWebSocket.OPEN;
      socket.emit('open');
      // Closes without ever sending isFinal - must NOT resolve as a completed stream.
      socket.emit('close', 1008, Buffer.from('policy violation'));

      await expect(promise).rejects.toMatchObject({ statusCode: 401, reason: 'elevenlabs_auth_failed' });
      expect(res.ended).toBe(false);
    });

    it('treats a premature close with a generic code as a 503, not success', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(pendingRecord());
      const res = createMockResponse();

      const promise = service.streamPendingAudio(sessionId, userId, 'stream-1', res);
      const socket: any = await waitForSocket();
      socket.readyState = FakeWebSocket.OPEN;
      socket.emit('open');
      socket.emit('close', 1006, Buffer.from(''));

      await expect(promise).rejects.toMatchObject({ statusCode: 503, reason: 'elevenlabs_ws_error' });
      expect(res.ended).toBe(false);
    });

    it('times out with elevenlabs_timeout if no audio arrives within the watchdog window', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      try {
        (redisClient.get as jest.Mock).mockResolvedValue(pendingRecord());
        const res = createMockResponse();

        const promise = service.streamPendingAudio(sessionId, userId, 'stream-1', res);
        const socket: any = await waitForSocket();
        socket.readyState = FakeWebSocket.OPEN;
        socket.emit('open');

        const assertion = expect(promise).rejects.toMatchObject({
          statusCode: 503,
          reason: 'elevenlabs_timeout',
        });
        jest.advanceTimersByTime(10_000);
        await assertion;
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
