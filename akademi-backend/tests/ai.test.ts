import { AIService } from '../src/modules/ai/ai.service';
import { ReplyMode, VocabularyLevel } from '@prisma/client';
import prisma from '../src/config/db';
import redisClient from '../src/config/redis';

// Mock Anthropic
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => {
    return {
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ text: 'Mocked AI response' }],
        }),
      },
    };
  });
});

// Mock redis
jest.mock('../src/config/redis', () => ({
  get: jest.fn(),
  setEx: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  keys: jest.fn().mockResolvedValue([]),
  del: jest.fn(),
}));

describe('AIService', () => {
  let aiService: AIService;
  const userId = 'test-user-id';
  const sessionId = 'test-session-id';

  beforeEach(async () => {
    aiService = new AIService();
    jest.clearAllMocks();

    // Setup minimal DB state
    (prisma.session.findUnique as jest.Mock) = jest.fn().mockResolvedValue({
      id: sessionId,
      department: 'Computer Science',
      course_code: 'CSC101',
    });

    (prisma.learningProfile.findUnique as jest.Mock) = jest.fn().mockResolvedValue({
      user_id: userId,
      vocabulary_level: VocabularyLevel.INTERMEDIATE,
      subject_strengths: {},
      subject_weaknesses: {},
      question_patterns: {},
    });

    (prisma.communityPattern.findMany as jest.Mock) = jest.fn().mockResolvedValue([]);
    (prisma.disciplineDocument.findFirst as jest.Mock) = jest.fn().mockResolvedValue(null);
  });

  it('should return a response from Claude and cache it', async () => {
    (redisClient.get as jest.Mock).mockResolvedValue(null);
    (redisClient.incr as jest.Mock).mockResolvedValue(1);

    const response = await aiService.getOrchestratedResponse(
      userId,
      sessionId,
      'Hello AI',
      ReplyMode.DIRECT,
      false
    );

    expect(response).toBe('Mocked AI response');
    expect(redisClient.setEx).toHaveBeenCalled();
  });

  it('should return a cached response if available', async () => {
    (redisClient.get as jest.Mock).mockResolvedValue('Cached response');
    (redisClient.incr as jest.Mock).mockResolvedValue(1);

    const response = await aiService.getOrchestratedResponse(
      userId,
      sessionId,
      'Hello AI',
      ReplyMode.DIRECT,
      false
    );

    expect(response).toBe('Cached response');
    expect(redisClient.setEx).not.toHaveBeenCalled();
  });

  it('should throw error if daily limit is reached', async () => {
    (redisClient.incr as jest.Mock).mockResolvedValue(11); // Over the free limit of 10

    await expect(aiService.getOrchestratedResponse(
      userId,
      sessionId,
      'Hello AI',
      ReplyMode.DIRECT,
      false
    )).rejects.toThrow('Daily AI limit reached');
  });
});
