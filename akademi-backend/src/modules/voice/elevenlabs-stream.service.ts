import { Response } from 'express';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/env';
import redisClient, { isRedisDegraded } from '../../config/redis';

type PendingStreamRecord = {
  sessionId: string;
  userId: string;
  text: string;
  createdAt: number;
  consumedAt?: number;
};

export type VoiceStreamErrorReason =
  | 'elevenlabs_not_configured'
  | 'elevenlabs_auth_failed'
  | 'elevenlabs_voice_not_found'
  | 'elevenlabs_quota_exceeded'
  | 'elevenlabs_concurrency_limit'
  | 'elevenlabs_timeout'
  | 'elevenlabs_ws_error'
  | 'stream_not_found'
  | 'stream_consumed'
  | 'client_disconnected';

const STREAM_TTL_SECONDS = 5 * 60;
const RE_READ_WINDOW_MS = 60 * 1000;
const NO_AUDIO_TIMEOUT_MS = 10 * 1000;

export class VoiceStreamError extends Error {
  statusCode: number;
  reason: VoiceStreamErrorReason;

  constructor(message: string, statusCode: number, reason: VoiceStreamErrorReason) {
    super(message);
    this.name = 'VoiceStreamError';
    this.statusCode = statusCode;
    this.reason = reason;
  }
}

function streamKey(streamId: string) {
  return `voice-stream:${streamId}`;
}

function sanitizeSpeechText(content: string) {
  return content
    .replace(/\\\[(.*?)\\\]/gs, '$1')
    .replace(/\\\((.*?)\\\)/gs, '$1')
    .replace(/\$\$(.*?)\$\$/gs, '$1')
    .replace(/\$(.*?)\$/gs, '$1')
    .replace(/[`*_#>-]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ElevenLabs reports most failures (auth, quota, concurrency, missing voice)
// as plain-text WS error payloads rather than a structured error code, so
// telling them apart from genuine upstream unavailability requires a small
// classification step.
function classifyElevenLabsError(message: string): { statusCode: number; reason: VoiceStreamErrorReason } {
  const normalized = message.toLowerCase();
  if (normalized.includes('concurrent')) {
    return { statusCode: 429, reason: 'elevenlabs_concurrency_limit' };
  }
  if (normalized.includes('quota') || normalized.includes('rate limit') || normalized.includes('too many requests') || normalized.includes('429')) {
    return { statusCode: 429, reason: 'elevenlabs_quota_exceeded' };
  }
  if (normalized.includes('api key') || normalized.includes('api_key') || normalized.includes('unauthorized') || normalized.includes('401')) {
    return { statusCode: 401, reason: 'elevenlabs_auth_failed' };
  }
  if (normalized.includes('voice') && (normalized.includes('not found') || normalized.includes('does not exist') || normalized.includes('404'))) {
    return { statusCode: 404, reason: 'elevenlabs_voice_not_found' };
  }
  return { statusCode: 503, reason: 'elevenlabs_ws_error' };
}

// WebSocket close codes ElevenLabs is known to send, so logs read as English
// instead of requiring a lookup every time someone investigates a failure.
function describeCloseCode(code: number): string {
  switch (code) {
    case 1000:
      return 'normal closure';
    case 1006:
      return 'abnormal closure (connection dropped without a close frame)';
    case 1008:
      return 'policy violation (commonly an auth/API key rejection)';
    case 1011:
      return 'server error';
    default:
      return 'unrecognized close code';
  }
}

export class ElevenLabsStreamService {
  constructor() {
    const apiKeySet = Boolean(config.elevenLabsApiKey);
    console.log('elevenlabs_config_checked', {
      apiKeySet,
      apiKeySuffix: apiKeySet ? config.elevenLabsApiKey.slice(-4) : null,
      voiceId: config.elevenLabsVoiceId,
      modelId: config.elevenLabsModelId,
    });
    if (!apiKeySet) {
      console.error('elevenlabs_config_missing', {
        message: 'ELEVENLABS_API_KEY is not set; every voice streaming request will fail until it is configured.',
      });
    }
  }

  private assertConfigured() {
    if (!config.elevenLabsApiKey) {
      throw new VoiceStreamError(
        'ElevenLabs is not configured. Add ELEVENLABS_API_KEY to the backend environment.',
        500,
        'elevenlabs_not_configured',
      );
    }
  }

  async createPendingStream(sessionId: string, userId: string, text: string) {
    const sanitized = sanitizeSpeechText(text || '');
    if (!sanitized) {
      throw new Error('Text is required for speech synthesis.');
    }

    this.assertConfigured();

    const id = uuidv4();
    const record: PendingStreamRecord = {
      sessionId,
      userId,
      text: sanitized,
      createdAt: Date.now(),
    };

    // Pending streams must be readable from whichever replica the follow-up
    // GET lands on, so they live in Redis (shared across pods) rather than an
    // in-process Map. TTL is a safety net; the re-read window below is what
    // actually governs how long a stream stays usable after being consumed.
    await redisClient.setEx(streamKey(id), STREAM_TTL_SECONDS, JSON.stringify(record));

    console.log('tts_stream_request_received', {
      sessionId,
      streamId: id,
      textLength: sanitized.length,
      timestamp: new Date().toISOString(),
    });

    return {
      streamId: id,
      mimeType: 'audio/mpeg',
      provider: 'elevenlabs_stream',
      path: `/sessions/${sessionId}/voice/stream-audio/${id}`,
    };
  }

  private async loadPendingStream(streamId: string): Promise<PendingStreamRecord | null> {
    const raw = await redisClient.get(streamKey(streamId));
    if (!raw) return null;

    try {
      return JSON.parse(raw) as PendingStreamRecord;
    } catch {
      return null;
    }
  }

  private logStreamError(sessionId: string, streamId: string, error: VoiceStreamError) {
    console.error('tts_stream_error', {
      sessionId,
      streamId,
      message: error.message,
      statusCode: error.statusCode,
      reason: error.reason,
    });
  }

  async streamPendingAudio(sessionId: string, userId: string, streamId: string, res: Response) {
    this.assertConfigured();

    const pending = await this.loadPendingStream(streamId);

    if (!pending || pending.sessionId !== sessionId || pending.userId !== userId) {
      // If the record is missing because Redis itself is unreachable, this is
      // not "the stream doesn't exist" - it's "we can't tell right now".
      const error = !pending && isRedisDegraded()
        ? new VoiceStreamError('Voice stream storage is temporarily unavailable.', 503, 'elevenlabs_ws_error')
        : new VoiceStreamError('Voice stream not found or has expired.', 404, 'stream_not_found');
      this.logStreamError(sessionId, streamId, error);
      throw error;
    }

    const now = Date.now();
    if (pending.consumedAt !== undefined) {
      if (now - pending.consumedAt > RE_READ_WINDOW_MS) {
        const error = new VoiceStreamError('Voice stream has already been used.', 409, 'stream_consumed');
        this.logStreamError(sessionId, streamId, error);
        throw error;
      }
      // Within the re-read window: this is expo-av/AVPlayer re-requesting the
      // same URI (probe, range re-request, retry), not a new playback - allow
      // it without extending the window further.
    } else {
      // First read: mark consumed so any request outside the window below is
      // rejected instead of treated as a fresh, unconsumed stream. This write
      // is intentionally not atomic - a near-simultaneous second read landing
      // on another replica may also observe consumedAt unset and write it
      // again, and that's fine, since both requests are meant to succeed.
      const updated: PendingStreamRecord = { ...pending, consumedAt: now };
      await redisClient.setEx(streamKey(streamId), STREAM_TTL_SECONDS, JSON.stringify(updated));
    }

    res.status(200);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-store, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    await this.pipeElevenLabsStream(pending.text, sessionId, streamId, res);
  }

  private pipeElevenLabsStream(text: string, sessionId: string, streamId: string, res: Response) {
    return new Promise<void>((resolve, reject) => {
      const startedAt = Date.now();
      const logContext = {
        sessionId,
        streamId,
        voiceId: config.elevenLabsVoiceId,
        modelId: config.elevenLabsModelId,
      };
      let settled = false;
      let firstChunkLogged = false;
      let noAudioTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

      const finish = (error?: Error & { statusCode?: number; reason?: VoiceStreamErrorReason }) => {
        if (settled) return;
        settled = true;
        if (noAudioTimeoutHandle) {
          clearTimeout(noAudioTimeoutHandle);
          noAudioTimeoutHandle = null;
        }

        if (error) {
          const statusCode = error.statusCode ?? 503;
          const reason = error.reason ?? 'elevenlabs_ws_error';
          console.error('tts_stream_error', {
            ...logContext,
            message: error.message,
            statusCode,
            reason,
            elapsedMs: Date.now() - startedAt,
          });

          if (!res.headersSent) {
            res.status(statusCode).json({ message: error.message, reason });
          } else {
            res.destroy(error);
          }
          reject(error);
          return;
        }

        console.log('audio_stream_completed', {
          ...logContext,
          elapsedMs: Date.now() - startedAt,
        });
        res.end();
        resolve();
      };

      const endpoint =
        `wss://api.elevenlabs.io/v1/text-to-speech/${config.elevenLabsVoiceId}/stream-input` +
        `?model_id=${encodeURIComponent(config.elevenLabsModelId)}` +
        '&output_format=mp3_44100_128&optimize_streaming_latency=3';

      const socket = new WebSocket(endpoint);

      const closeSocket = () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      };

      res.on('close', () => {
        closeSocket();
        if (!settled) {
          finish(new VoiceStreamError('Client closed the audio stream.', 503, 'client_disconnected'));
        }
      });

      // The server can reject the WS upgrade outright (wrong API key, bad
      // voice id) with a plain HTTP response instead of ever completing the
      // handshake. Without this handler `ws` aborts the connection with a
      // generic "Unexpected server response" error and we lose the actual
      // status code and the response body, which is where ElevenLabs puts
      // "invalid_api_key" / "voice_not_found" / quota details.
      socket.on('unexpected-response', (_request, response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          const upstreamStatus = response.statusCode || 502;
          const { statusCode, reason } =
            upstreamStatus === 401 || upstreamStatus === 403
              ? { statusCode: 401, reason: 'elevenlabs_auth_failed' as const }
              : upstreamStatus === 404
                ? { statusCode: 404, reason: 'elevenlabs_voice_not_found' as const }
                : upstreamStatus === 429
                  ? { statusCode: 429, reason: 'elevenlabs_quota_exceeded' as const }
                  : { statusCode: 503, reason: 'elevenlabs_ws_error' as const };

          console.error('elevenlabs_ws_unexpected_response', {
            ...logContext,
            upstreamStatus,
            body: body.slice(0, 1000),
            elapsedMs: Date.now() - startedAt,
          });
          finish(new VoiceStreamError(`ElevenLabs rejected the connection (${upstreamStatus}).`, statusCode, reason));
        });
      });

      socket.on('open', () => {
        console.log('elevenlabs_ws_opened', {
          ...logContext,
          elapsedMs: Date.now() - startedAt,
        });

        socket.send(
          JSON.stringify({
            text: ' ',
            xi_api_key: config.elevenLabsApiKey,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.15,
              use_speaker_boost: true,
            },
            generation_config: {
              chunk_length_schedule: [120, 160, 220, 290],
            },
          }),
        );

        socket.send(
          JSON.stringify({
            text,
            try_trigger_generation: true,
            flush: true,
          }),
        );

        socket.send(JSON.stringify({ text: '' }));

        noAudioTimeoutHandle = setTimeout(() => {
          if (firstChunkLogged || settled) return;
          console.error('elevenlabs_no_audio_timeout', {
            ...logContext,
            elapsedMs: Date.now() - startedAt,
            textLength: text.length,
          });
          finish(new VoiceStreamError('ElevenLabs did not return any audio in time.', 503, 'elevenlabs_timeout'));
          closeSocket();
        }, NO_AUDIO_TIMEOUT_MS);
      });

      socket.on('message', (payload) => {
        let parsed: { audio?: string; isFinal?: boolean; error?: string; message?: string };
        try {
          parsed = JSON.parse(payload.toString());
        } catch (error: any) {
          finish(new VoiceStreamError(error?.message || 'Could not parse ElevenLabs stream payload.', 503, 'elevenlabs_ws_error'));
          closeSocket();
          return;
        }

        if (parsed.error || parsed.message) {
          const errorText = parsed.error || parsed.message || 'ElevenLabs reported an error.';
          console.error('elevenlabs_message_error', {
            ...logContext,
            payload: parsed,
            elapsedMs: Date.now() - startedAt,
          });
          const { statusCode, reason } = classifyElevenLabsError(errorText);
          finish(new VoiceStreamError(errorText, statusCode, reason));
          closeSocket();
          return;
        }

        if (parsed.audio) {
          if (!firstChunkLogged) {
            firstChunkLogged = true;
            console.log('first_audio_chunk_received', {
              ...logContext,
              elapsedMs: Date.now() - startedAt,
            });
          }

          res.write(Buffer.from(parsed.audio, 'base64'));
        }

        if (parsed.isFinal) {
          closeSocket();
          finish();
        }
      });

      socket.on('error', (error) => {
        const message = error.message || 'ElevenLabs WebSocket failed.';
        console.error('elevenlabs_ws_error_event', {
          ...logContext,
          message,
          elapsedMs: Date.now() - startedAt,
        });
        const { statusCode, reason } = classifyElevenLabsError(message);
        finish(new VoiceStreamError(message, statusCode, reason));
      });

      socket.on('close', (code, reasonBuffer) => {
        if (settled) return;
        // Reaching here means the socket closed before we ever saw `isFinal`
        // (that path settles synchronously and short-circuits this handler
        // via the `settled` guard) - so this is always a premature close,
        // never a legitimate completion, and must not be treated as success.
        const reasonText = reasonBuffer?.toString() || '';
        console.error('elevenlabs_ws_closed_prematurely', {
          ...logContext,
          code,
          reason: reasonText,
          codeMeaning: describeCloseCode(code),
          elapsedMs: Date.now() - startedAt,
        });
        const isAuthClose = code === 1008;
        finish(
          new VoiceStreamError(
            `ElevenLabs closed the connection before completing the response (code ${code}: ${describeCloseCode(code)}).`,
            isAuthClose ? 401 : 503,
            isAuthClose ? 'elevenlabs_auth_failed' : 'elevenlabs_ws_error',
          ),
        );
      });
    });
  }
}

export const elevenLabsStreamService = new ElevenLabsStreamService();

export type ElevenLabsHealthReport = {
  keyValid: boolean;
  voiceId: string;
  voiceExists: boolean;
  quota: { characterCount: number; characterLimit: number } | null;
  error: string | null;
};

// Cheap credential/quota/voice check for GET /admin/voice/health - plain REST
// GETs against ElevenLabs, no WebSocket, no synthesis cost. Complements
// `npm run check:elevenlabs` (which does a real synthesis over the
// stream-input WS) with something safe to poll from production.
export async function checkElevenLabsHealth(): Promise<ElevenLabsHealthReport> {
  if (!config.elevenLabsApiKey) {
    return {
      keyValid: false,
      voiceId: config.elevenLabsVoiceId,
      voiceExists: false,
      quota: null,
      error: 'ELEVENLABS_API_KEY is not set.',
    };
  }

  const headers = { 'xi-api-key': config.elevenLabsApiKey };

  const [userResult, voiceResult] = await Promise.allSettled([
    fetch('https://api.elevenlabs.io/v1/user', { headers }),
    fetch(`https://api.elevenlabs.io/v1/voices/${config.elevenLabsVoiceId}`, { headers }),
  ]);

  let keyValid = false;
  let quota: ElevenLabsHealthReport['quota'] = null;
  const errors: string[] = [];

  if (userResult.status === 'fulfilled') {
    if (userResult.value.ok) {
      keyValid = true;
      try {
        const body = (await userResult.value.json()) as { subscription?: { character_count?: number; character_limit?: number } };
        const subscription = body?.subscription;
        if (subscription) {
          quota = {
            characterCount: Number(subscription.character_count ?? 0),
            characterLimit: Number(subscription.character_limit ?? 0),
          };
        }
      } catch {
        errors.push('Could not parse ElevenLabs /v1/user response body.');
      }
    } else {
      const detail = await userResult.value.text().catch(() => '');
      errors.push(`Key check failed (${userResult.value.status}): ${detail.slice(0, 300)}`);
    }
  } else {
    errors.push(`Key check request failed: ${userResult.reason?.message || userResult.reason}`);
  }

  let voiceExists = false;
  if (voiceResult.status === 'fulfilled') {
    voiceExists = voiceResult.value.ok;
    if (!voiceResult.value.ok) {
      const detail = await voiceResult.value.text().catch(() => '');
      errors.push(`Voice check failed (${voiceResult.value.status}): ${detail.slice(0, 300)}`);
    }
  } else {
    errors.push(`Voice check request failed: ${voiceResult.reason?.message || voiceResult.reason}`);
  }

  return {
    keyValid,
    voiceId: config.elevenLabsVoiceId,
    voiceExists,
    quota,
    error: errors.length ? errors.join(' ') : null,
  };
}
