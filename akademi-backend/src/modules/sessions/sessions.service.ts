import prisma from '../../config/db';
import { StartSessionRequest, SendMessageRequest, SendPhotoMessageRequest, StartCompanionRequest, CompanionTurnRequest } from './sessions.types';
import { SessionType, MessageRole, Feature, Prisma, ReplyMode } from '@prisma/client';
import { checkFeatureAccess } from '../../shared/utils/feature-access';
import { orchestrateAIResponse } from '../../shared/utils/ai-orchestrator';
import { systemQueue, JOB_NAMES } from '../../config/queue';
import { config } from '../../config/env';
import * as vision from '@google-cloud/vision';
import { extractDisciplineDocumentText } from '../admin/document-extraction';
import { aiProvider } from '../ai/ai.provider';
import { studyCompanionService } from './study-companion.service';

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
        course_code: data.course_code?.trim() || null,
        topic: data.topic || null,
        duration: data.duration || null,
        material_id: data.material_id?.trim() || null,
        metadata: (data.metadata || {}) as Prisma.InputJsonValue,
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
        material: {
          select: {
            id: true,
            title: true,
            course_code: true,
            verification_status: true,
          },
        },
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

    const replyMode =
      data.reply_mode ||
      session.reply_mode ||
      'DIRECT';

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

    const companionState = await studyCompanionService.ensureState(sessionId);
    const metadata = session.metadata && typeof session.metadata === 'object' && !Array.isArray(session.metadata)
      ? session.metadata as Record<string, unknown>
      : {};
    const shouldUseCompanion =
      !!companionState || metadata.mode === 'ai-study-companion';

    console.log('COMPANION CHECK', {
      sessionId,
      hasCompanionState: !!companionState,
      mode: metadata.mode ?? null,
      shouldUseCompanion,
    });

    const aiResponse =
      shouldUseCompanion
        ? await studyCompanionService.handleStudentReply(sessionId, data.content)
        : await orchestrateAIResponse(userId, sessionId, data.content, replyMode);

    // Save AI message
    return prisma.message.create({
      data: {
        session_id: sessionId,
        user_id: userId,
        role: MessageRole.AI,
        content: aiResponse.content,
        metadata: (aiResponse.metadata || {}) as Prisma.InputJsonValue,
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

  async extractDocumentText(file: Express.Multer.File) {
    if (!file) {
      throw new Error('No document uploaded');
    }

    const extractedText = normalizeExtractedText(await extractDisciplineDocumentText(file));

    if (!extractedText) {
      throw new Error('No readable text could be extracted from this document.');
    }

    return {
      extractedText,
      fileName: file.originalname,
    };
  }

  async transcribeAudio(file: Express.Multer.File) {
    if (!file) {
      throw new Error('No audio uploaded');
    }

    if (!file.mimetype.startsWith('audio/')) {
      throw new Error('Uploaded file must be audio');
    }

    const transcript = normalizeExtractedText(await aiProvider.transcribeAudio(file.buffer, file.mimetype));

    if (!transcript) {
      throw new Error('Could not transcribe that recording. Please try again.');
    }

    return {
      transcript,
      fileName: file.originalname,
    };
  }

  async getSessionSummary(sessionId: string) {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          material: {
            select: {
              title: true,
              course_code: true,
            },
          },
        },
      });

      return {
          summary: "This session covered key topics in the specified course code and captured the student's study interaction.",
          key_points: ["Discussion on core concepts", "Q&A session on course material", "Problem-solving walkthrough"],
          next_steps: ["Review session notes", "Practice related mock exam questions", "Explore further reading materials"]
      };
  }

  async getCompanionState(sessionId: string) {
    return studyCompanionService.getPublicState(sessionId);
  }

  async startCompanion(sessionId: string, data: StartCompanionRequest) {
    const session = await this.getSession(sessionId);
    const kickoffText =
      data.mode === 'roadmap'
        ? 'Create my study roadmap first.'
        : data.mode === 'specific'
          ? `Start me from this section: ${data.section_title || 'selected section'}.`
          : data.mode === 'continue'
            ? 'Continue from where I stopped.'
            : 'Start from the beginning.';

    await prisma.message.create({
      data: {
        session_id: sessionId,
        user_id: session.user_id,
        role: MessageRole.STUDENT,
        content: kickoffText,
        reply_mode: ReplyMode.STUDY,
        metadata: {
          study_companion_start: true,
          mode: data.mode,
          section_title: data.section_title || null,
        } as Prisma.InputJsonValue,
      },
    });

    const response = await studyCompanionService.start(sessionId, data.mode, data.section_title);

    return prisma.message.create({
      data: {
        session_id: sessionId,
        user_id: session.user_id,
        role: MessageRole.AI,
        content: response.content,
        reply_mode: ReplyMode.STUDY,
        metadata: (response.metadata || {}) as Prisma.InputJsonValue,
      },
    });
  }

  async sendCompanionMessage(userId: string, sessionId: string, data: SendMessageRequest) {
    return this.sendMessage(userId, sessionId, {
      content: data.content,
      reply_mode: ReplyMode.STUDY,
    });
  }

  async handleCompanionTurn(userId: string, sessionId: string, data: CompanionTurnRequest) {
    switch (data.action) {
      case 'tutor:start':
        if (!data.mode) {
          throw new Error('A start mode is required to begin the tutor session.');
        }
        return this.startCompanion(sessionId, {
          mode: data.mode,
          section_title: data.section_title,
        });
      case 'tutor:continue': {
        const session = await this.getSession(sessionId);
        const response = await studyCompanionService.handleTutorContinue(sessionId);
        return prisma.message.create({
          data: {
            session_id: sessionId,
            user_id: session.user_id,
            role: MessageRole.AI,
            content: response.content,
            reply_mode: ReplyMode.STUDY,
            metadata: (response.metadata || {}) as Prisma.InputJsonValue,
          },
        });
      }
      case 'tutor:student_response':
        if (!data.content?.trim()) {
          throw new Error('A student response is required.');
        }
        return this.sendCompanionMessage(userId, sessionId, {
          content: data.content,
          reply_mode: ReplyMode.STUDY,
        });
      case 'tutor:interrupt':
        if (!data.content?.trim()) {
          throw new Error('An interruption transcript is required.');
        }
        return this.sendCompanionInterrupt(userId, sessionId, data.content.trim());
      default:
        throw new Error('Unsupported tutor action.');
    }
  }

  async sendCompanionInterrupt(userId: string, sessionId: string, content: string) {
    const session = await this.getSession(sessionId);

    await prisma.message.create({
      data: {
        session_id: sessionId,
        user_id: userId,
        role: MessageRole.STUDENT,
        content,
        reply_mode: ReplyMode.STUDY,
        metadata: {
          tutor_interrupt: true,
        } as Prisma.InputJsonValue,
      },
    });

    const aiResponse = await studyCompanionService.handleStudentReply(sessionId, content, {
      interrupted: true,
    });

    return prisma.message.create({
      data: {
        session_id: sessionId,
        user_id: session.user_id,
        role: MessageRole.AI,
        content: aiResponse.content,
        metadata: (aiResponse.metadata || {}) as Prisma.InputJsonValue,
        reply_mode: ReplyMode.STUDY,
      },
    });
  }
}
