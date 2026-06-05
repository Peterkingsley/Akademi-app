import prisma from '../../config/db';
import { StartSessionRequest, SendMessageRequest, SendPhotoMessageRequest } from './sessions.types';
import { SessionType, MessageRole, Feature } from '@prisma/client';
import { checkFeatureAccess } from '../../shared/utils/feature-access';
import { orchestrateAIResponse } from '../../shared/utils/ai-orchestrator';
import { systemQueue, JOB_NAMES } from '../../config/queue';
import { config } from '../../config/env';
import * as vision from '@google-cloud/vision';

let visionClient: vision.ImageAnnotatorClient | null = null;

const PLACEHOLDER_KEYWORDS = ['your_', 'replace_me', 'api_key', 'dummy'];

function hasUsableVisionKey() {
  const key = config.googleVisionApiKey;
  return !!key && !PLACEHOLDER_KEYWORDS.some(keyword => key.toLowerCase().includes(keyword));
}

function getVisionClient() {
  if (!visionClient) {
    visionClient = new vision.ImageAnnotatorClient(
      hasUsableVisionKey() ? { apiKey: config.googleVisionApiKey } : {},
    );
  }
  return visionClient;
}

function normalizeExtractedText(text: string) {
  return text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function extractTextFromImage(buffer: Buffer) {
  const content = buffer.toString('base64');

  if (hasUsableVisionKey()) {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${config.googleVisionApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content },
              features: [{ type: 'TEXT_DETECTION' }],
            },
          ],
        }),
      },
    );

    const payload = await response.json() as any;

    if (!response.ok) {
      throw new Error(payload?.error?.message || 'Google Vision OCR failed');
    }

    const result = payload?.responses?.[0];
    if (result?.error?.message) {
      throw new Error(result.error.message);
    }

    return normalizeExtractedText(result?.fullTextAnnotation?.text || result?.textAnnotations?.[0]?.description || '');
  }

  const [result] = await getVisionClient().textDetection({
    image: { content },
  });

  return normalizeExtractedText(result.fullTextAnnotation?.text || '');
}

export class SessionsService {
  private mapSessionTypeToFeature(type: SessionType): Feature {
    switch (type) {
      case SessionType.ASSIGNMENT:
        return Feature.ASSIGNMENT_SOLVING;
      case SessionType.TUTOR:
        return Feature.LIVE_TUTORING;
      case SessionType.EXAM_PREP:
        return Feature.EXAM_PREP;
      case SessionType.STUDY:
      default:
        // Assuming STUDY mode is free as per the monetization table in Ticket-00
        return Feature.ASSIGNMENT_SOLVING;
    }
  }

  async startSession(userId: string, data: StartSessionRequest) {
    // Free check for Study Mode (as per monetization table)
    if (data.session_type !== SessionType.STUDY) {
        const feature = this.mapSessionTypeToFeature(data.session_type);
        const hasAccess = await checkFeatureAccess(userId, feature);
        if (!hasAccess) {
          throw new Error(`You do not have access to the ${feature} feature. Please purchase a plan.`);
        }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { university: true, department: true },
    });

    if (!user) throw new Error('User not found');

    return prisma.session.create({
      data: {
        user_id: userId,
        session_type: data.session_type,
        reply_mode: data.reply_mode,
        course_code: data.course_code,
        topic: data.topic || null,
        duration: data.duration || null,
        university: user.university,
        department: user.department,
      },
    });
  }

  async listSessions(userId: string) {
    return prisma.session.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async getSession(id: string) {
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!session) throw new Error('Session not found');
    return session;
  }

  async endSession(id: string) {
    const session = await prisma.session.update({
      where: { id },
      data: { ended_at: new Date() },
    });

    // Trigger background jobs
    systemQueue.add(JOB_NAMES.UPDATE_LEARNING_PROFILE, { sessionId: id }).catch(console.error);
    systemQueue.add(JOB_NAMES.GENERATE_SESSION_SUMMARY, { sessionId: id }).catch(console.error);

    return session;
  }

  async listMessages(sessionId: string) {
    return prisma.message.findMany({
      where: { session_id: sessionId },
      orderBy: { created_at: 'asc' },
    });
  }

  async sendMessage(userId: string, sessionId: string, data: SendMessageRequest) {
    const session = await this.getSession(sessionId);

    if (session.ended_at) {
        throw new Error('Cannot send message to an ended session');
    }

    const replyMode = data.reply_mode || session.reply_mode;

    // Save student message
    await prisma.message.create({
      data: {
        session_id: sessionId,
        user_id: userId,
        role: MessageRole.STUDENT,
        content: data.content,
        reply_mode: replyMode,
      },
    });

    // AI Orchestration Logic
    const aiResponseContent = await orchestrateAIResponse(userId, sessionId, data.content, replyMode);

    // Save AI message
    return prisma.message.create({
      data: {
        session_id: sessionId,
        user_id: userId,
        role: MessageRole.AI,
        content: aiResponseContent,
        reply_mode: replyMode,
      },
    });
  }

  async sendPhotoMessage(
    userId: string,
    sessionId: string,
    file: Express.Multer.File,
    data: SendPhotoMessageRequest,
  ) {
    if (!file) {
      throw new Error('No image uploaded');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new Error('Uploaded file must be an image');
    }

    const extractedText = await extractTextFromImage(file.buffer);

    if (!extractedText) {
      throw new Error('Could not read text from this image. Please retake it with clearer lighting.');
    }

    const message = await this.sendMessage(userId, sessionId, {
      content: extractedText,
      reply_mode: data.reply_mode,
    });

    return {
      extractedText,
      message,
    };
  }

  async getSessionSummary(sessionId: string) {
      // In a real scenario, this would probably pull from the generated session summary job's results
      // For now, we return a mock summary that follows the requirements
      return {
          summary: "This session covered key topics in the specified course code. The AI tutor helped the student understand fundamental concepts and addressed specific questions.",
          key_points: ["Discussion on core concepts", "Q&A session on course material", "Problem-solving walkthrough"],
          next_steps: ["Review session notes", "Practice related mock exam questions", "Explore further reading materials"]
      };
  }
}
