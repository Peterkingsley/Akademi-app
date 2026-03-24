import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { config } from '../../config/env';
import { Socket } from 'socket.io';
import { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData } from './websocket.types';

let client: TextToSpeechClient | null = null;

const getClient = () => {
  if (!client) {
    client = new TextToSpeechClient(
      config.googleTtsApiKey ? { apiKey: config.googleTtsApiKey } : {}
    );
  }
  return client;
};

export async function streamAudio(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  text: string
) {
  try {
    const [response] = await getClient().synthesizeSpeech({
      input: { text },
      voice: { languageCode: 'en-NG', ssmlGender: 'NEUTRAL' },
      audioConfig: { audioEncoding: 'MP3' },
    });

    const audioContent = response.audioContent as Buffer;
    if (!audioContent) {
      throw new Error('Failed to generate audio content');
    }

    // Stream audio content in chunks to client
    const chunkSize = 1024 * 16;
    const chunks: Buffer[] = [];
    for (let i = 0; i < audioContent.length; i += chunkSize) {
      chunks.push(audioContent.slice(i, i + chunkSize));
    }

    for (let i = 0; i < chunks.length; i++) {
      socket.emit('audio:stream', {
        chunk: chunks[i].toString('base64'),
        isLast: i === chunks.length - 1,
      });
    }
  } catch (error) {
    console.error('TTS Error:', error);
    socket.emit('error', { message: 'Failed to generate audio' });
  }
}
