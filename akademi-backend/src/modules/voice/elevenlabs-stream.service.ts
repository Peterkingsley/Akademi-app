import { Response } from 'express';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/env';

type PendingStream = {
  id: string;
  sessionId: string;
  userId: string;
  text: string;
  createdAt: number;
  consumed: boolean;
};

const STREAM_TTL_MS = 5 * 60 * 1000;

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

export class ElevenLabsStreamService {
  private pendingStreams = new Map<string, PendingStream>();

  private cleanupExpiredStreams() {
    const now = Date.now();
    for (const [streamId, stream] of this.pendingStreams.entries()) {
      if (now - stream.createdAt > STREAM_TTL_MS) {
        this.pendingStreams.delete(streamId);
      }
    }
  }

  createPendingStream(sessionId: string, userId: string, text: string) {
    const sanitized = sanitizeSpeechText(text || '');
    if (!sanitized) {
      throw new Error('Text is required for speech synthesis.');
    }

    if (!config.elevenLabsApiKey) {
      throw new Error('ElevenLabs is not configured. Add ELEVENLABS_API_KEY to the backend environment.');
    }

    this.cleanupExpiredStreams();
    const id = uuidv4();
    this.pendingStreams.set(id, {
      id,
      sessionId,
      userId,
      text: sanitized,
      createdAt: Date.now(),
      consumed: false,
    });

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

  async streamPendingAudio(sessionId: string, userId: string, streamId: string, res: Response) {
    this.cleanupExpiredStreams();
    const pending = this.pendingStreams.get(streamId);

    if (!pending || pending.sessionId !== sessionId || pending.userId !== userId) {
      throw new Error('Voice stream not found or has expired.');
    }

    if (pending.consumed) {
      throw new Error('Voice stream has already been used.');
    }

    pending.consumed = true;
    this.pendingStreams.delete(streamId);

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

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;

        if (error) {
          console.error('tts_stream_error', {
            sessionId,
            streamId,
            message: error.message,
            elapsedMs: Date.now() - startedAt,
          });

          if (!res.headersSent) {
            res.status(503).json({ message: error.message });
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
            finish(new Error(parsed.error));
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
        finish(new Error(error.message || 'ElevenLabs WebSocket failed.'));
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
