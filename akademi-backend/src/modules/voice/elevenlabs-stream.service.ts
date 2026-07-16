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

const STREAM_TTL_SECONDS = 5 * 60;
const RE_READ_WINDOW_MS = 60 * 1000;

export class VoiceStreamError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'VoiceStreamError';
    this.statusCode = statusCode;
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

// ElevenLabs reports concurrency/rate limits as plain-text WS error payloads
// rather than a structured error code, so telling them apart from genuine
// upstream unavailability requires a small classification step.
function classifyElevenLabsErrorStatus(message: string): number {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('concurrent') ||
    normalized.includes('too many requests') ||
    normalized.includes('rate limit') ||
    normalized.includes('quota') ||
    normalized.includes('429')
  ) {
    return 429;
  }
  return 503;
}

export class ElevenLabsStreamService {
  async createPendingStream(sessionId: string, userId: string, text: string) {
    const sanitized = sanitizeSpeechText(text || '');
    if (!sanitized) {
      throw new Error('Text is required for speech synthesis.');
    }

    if (!config.elevenLabsApiKey) {
      throw new Error('ElevenLabs is not configured. Add ELEVENLABS_API_KEY to the backend environment.');
    }

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
    });
  }

  async streamPendingAudio(sessionId: string, userId: string, streamId: string, res: Response) {
    const pending = await this.loadPendingStream(streamId);

    if (!pending || pending.sessionId !== sessionId || pending.userId !== userId) {
      // If the record is missing because Redis itself is unreachable, this is
      // not "the stream doesn't exist" - it's "we can't tell right now".
      const error = !pending && isRedisDegraded()
        ? new VoiceStreamError('Voice stream storage is temporarily unavailable.', 503)
        : new VoiceStreamError('Voice stream not found or has expired.', 404);
      this.logStreamError(sessionId, streamId, error);
      throw error;
    }

    const now = Date.now();
    if (pending.consumedAt !== undefined) {
      if (now - pending.consumedAt > RE_READ_WINDOW_MS) {
        const error = new VoiceStreamError('Voice stream has already been used.', 409);
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
      let settled = false;
      let firstChunkLogged = false;

      const finish = (error?: Error & { statusCode?: number }) => {
        if (settled) return;
        settled = true;

        if (error) {
          const statusCode = error.statusCode ?? 503;
          console.error('tts_stream_error', {
            sessionId,
            streamId,
            message: error.message,
            statusCode,
            elapsedMs: Date.now() - startedAt,
          });

          if (!res.headersSent) {
            res.status(statusCode).json({ message: error.message });
          } else {
            res.destroy(error);
          }
          reject(error);
          return;
        }

        console.log('audio_stream_completed', {
          sessionId,
          streamId,
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
          finish(new Error('Client closed the audio stream.'));
        }
      });

      socket.on('open', () => {
        console.log('elevenlabs_ws_opened', {
          sessionId,
          streamId,
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
      });

      socket.on('message', (payload) => {
        try {
          const parsed = JSON.parse(payload.toString()) as {
            audio?: string;
            isFinal?: boolean;
            error?: string;
          };

          if (parsed.error) {
            finish(new VoiceStreamError(parsed.error, classifyElevenLabsErrorStatus(parsed.error)));
            closeSocket();
            return;
          }

          if (parsed.audio) {
            if (!firstChunkLogged) {
              firstChunkLogged = true;
              console.log('first_audio_chunk_received', {
                sessionId,
                streamId,
                elapsedMs: Date.now() - startedAt,
              });
            }

            res.write(Buffer.from(parsed.audio, 'base64'));
          }

          if (parsed.isFinal) {
            closeSocket();
            finish();
          }
        } catch (error: any) {
          finish(new Error(error?.message || 'Could not parse ElevenLabs stream payload.'));
          closeSocket();
        }
      });

      socket.on('error', (error) => {
        const message = error.message || 'ElevenLabs WebSocket failed.';
        finish(new VoiceStreamError(message, classifyElevenLabsErrorStatus(message)));
      });

      socket.on('close', () => {
        if (!settled) {
          finish();
        }
      });
    });
  }
}

export const elevenLabsStreamService = new ElevenLabsStreamService();
