import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import ioc, { Socket as ClientSocket } from 'socket.io-client';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { initWebSocket } from '../src/modules/websocket/websocket.server';
import { config } from '../src/config/env';

// Mock SessionsService and redis
jest.mock('../src/modules/sessions/sessions.service', () => {
  return {
    SessionsService: jest.fn().mockImplementation(() => ({
      startSession: jest.fn().mockResolvedValue({ id: 'test-session-id' }),
      sendMessage: jest.fn().mockResolvedValue({ id: 'msg-1', content: 'AI Response' }),
      listSessions: jest.fn().mockResolvedValue([]),
      endSession: jest.fn().mockResolvedValue({}),
      getSessionSummary: jest.fn().mockResolvedValue({ summary: 'test summary' }),
    })),
  };
});

jest.mock('../src/config/redis', () => {
  const mRedis = {
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    isOpen: true,
    duplicate: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
    }),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
  };
  return {
    __esModule: true,
    default: mRedis,
    connectRedis: jest.fn().mockResolvedValue(undefined),
  };
});

// Mock Google TTS
jest.mock('@google-cloud/text-to-speech', () => {
  return {
    TextToSpeechClient: jest.fn().mockImplementation(() => ({
      synthesizeSpeech: jest.fn().mockResolvedValue([{ audioContent: Buffer.from('mock audio') }]),
    })),
  };
});

describe('WebSocket Layer', () => {
  let io: Server, server: HttpServer, clientSocket: any;
  const token = jwt.sign({ userId: 'user-1', email: 'test@example.com' }, config.jwtSecret);

  beforeAll((done) => {
    server = createServer();
    io = initWebSocket(server);
    server.listen(() => {
      const port = (server.address() as AddressInfo).port;
      clientSocket = ioc(`http://localhost:${port}`, {
        auth: { token },
      });
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    io.close();
    server.close();
    clientSocket.disconnect();
  });

  it('should join a session', (done) => {
    clientSocket.emit('session:start', { courseCode: 'CSC101', topic: 'Intro', sessionType: 'TUTOR' });
    clientSocket.on('session:joined', (data: any) => {
      expect(data.sessionId).toBe('test-session-id');
      done();
    });
  });

  it('should receive messages and audio stream', (done) => {
    clientSocket.emit('message:send', { content: 'Hello', sessionId: 'test-session-id' });

    let receivedMessage = false;
    let receivedAudio = false;

    clientSocket.on('message:receive', (data: any) => {
      expect(data.content).toBe('AI Response');
      receivedMessage = true;
      if (receivedMessage && receivedAudio) done();
    });

    clientSocket.on('audio:stream', (data: any) => {
      expect(data.chunk).toBeDefined();
      receivedAudio = true;
      if (receivedMessage && receivedAudio) done();
    });
  });

  it('should handle pause and resume', (done) => {
    clientSocket.emit('session:pause', { sessionId: 'test-session-id', position: 100 });
    clientSocket.on('session:paused', (data: any) => {
      expect(data.position).toBe(100);

      clientSocket.emit('session:resume', { sessionId: 'test-session-id' });
      clientSocket.on('session:resumed', (res: any) => {
        done();
      });
    });
  });
});
