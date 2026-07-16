// One-shot connectivity check for the ElevenLabs streaming TTS credentials.
// Run with: npm run check:elevenlabs
//
// Connects to the same stream-input WebSocket the app uses, sends a short
// test phrase, and reports exactly what ElevenLabs said - invalid key, voice
// not found, quota/concurrency limit, or a working connection - instead of
// making you dig through app logs to find out.
import WebSocket from 'ws';
import { config } from '../config/env';

const TEST_TEXT = 'This is a connectivity check.';
const TIMEOUT_MS = 15 * 1000;

function maskKey(key: string) {
  if (!key) return '(not set)';
  return key.length <= 4 ? '****' : `****${key.slice(-4)}`;
}

async function checkElevenLabsVoice(): Promise<{ ok: boolean; detail: string }> {
  if (!config.elevenLabsApiKey) {
    return {
      ok: false,
      detail: 'ELEVENLABS_API_KEY is not set. Set it in the environment before running this check.',
    };
  }

  console.log('Checking ElevenLabs streaming credentials...');
  console.log(`  API key:  ${maskKey(config.elevenLabsApiKey)}`);
  console.log(`  Voice ID: ${config.elevenLabsVoiceId}`);
  console.log(`  Model ID: ${config.elevenLabsModelId}`);

  return new Promise((resolve) => {
    let settled = false;
    let firstChunkReceived = false;
    const startedAt = Date.now();

    const finish = (ok: boolean, detail: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
      resolve({ ok, detail });
    };

    const timeoutHandle = setTimeout(() => {
      finish(
        false,
        firstChunkReceived
          ? 'Received audio but the stream never signaled completion within the timeout.'
          : `No audio or error received within ${TIMEOUT_MS / 1000}s - check network access to api.elevenlabs.io.`,
      );
    }, TIMEOUT_MS);

    const endpoint =
      `wss://api.elevenlabs.io/v1/text-to-speech/${config.elevenLabsVoiceId}/stream-input` +
      `?model_id=${encodeURIComponent(config.elevenLabsModelId)}` +
      '&output_format=mp3_44100_128&optimize_streaming_latency=3';

    const socket = new WebSocket(endpoint);

    socket.on('unexpected-response', (_request, response) => {
      let body = '';
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        finish(false, `ElevenLabs rejected the connection with HTTP ${response.statusCode}: ${body.slice(0, 500)}`);
      });
    });

    socket.on('open', () => {
      console.log(`  WebSocket opened after ${Date.now() - startedAt}ms, sending test phrase...`);
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
      socket.send(JSON.stringify({ text: TEST_TEXT, try_trigger_generation: true, flush: true }));
      socket.send(JSON.stringify({ text: '' }));
    });

    socket.on('message', (payload) => {
      let parsed: { audio?: string; isFinal?: boolean; error?: string; message?: string };
      try {
        parsed = JSON.parse(payload.toString());
      } catch {
        finish(false, `Received a message that could not be parsed as JSON: ${payload.toString().slice(0, 300)}`);
        return;
      }

      if (parsed.error || parsed.message) {
        finish(false, `ElevenLabs returned an error: ${parsed.error || parsed.message}`);
        return;
      }

      if (parsed.audio && !firstChunkReceived) {
        firstChunkReceived = true;
        console.log(`  First audio chunk received after ${Date.now() - startedAt}ms.`);
      }

      if (parsed.isFinal) {
        finish(true, `Received audio and a completion signal in ${Date.now() - startedAt}ms.`);
      }
    });

    socket.on('error', (error) => {
      finish(false, `WebSocket error: ${error.message}`);
    });

    socket.on('close', (code, reasonBuffer) => {
      if (!settled) {
        finish(false, `Connection closed unexpectedly (code ${code}${reasonBuffer?.length ? `, reason: ${reasonBuffer.toString()}` : ''}) before completion.`);
      }
    });
  });
}

checkElevenLabsVoice()
  .then(({ ok, detail }) => {
    console.log(ok ? '\nPASS: ' : '\nFAIL: ', detail);
    process.exit(ok ? 0 : 1);
  })
  .catch((error) => {
    console.error('\nFAIL: Unexpected error while checking ElevenLabs credentials.', error);
    process.exit(1);
  });
