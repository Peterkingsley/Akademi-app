import prisma from '../../config/db';
import { Response } from 'express';
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
import { elevenLabsStreamService } from '../voice/elevenlabs-stream.service';

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

function parseElevenLabsError(status: number, detail: string) {
  if (status === 402 && detail.includes('paid_plan_required')) {
    return [
      'ElevenLabs voice is not available on this plan.',
      'Set ELEVENLABS_VOICE_ID to a default voice available in your ElevenLabs account, or upgrade the ElevenLabs plan for library voices.',
    ].join(' ');
  }

  return `ElevenLabs speech synthesis failed (${status}). ${detail}`.trim();
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
  private async assertTutorTraceAccess(sessionId: string, requester: { userId: string; email: string }) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        user_id: true,
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.user_id === requester.userId) {
      return session;
    }

    const admin = await prisma.admin.findFirst({
      where: { email: requester.email },
      select: { id: true, role: true, status: true },
    });

    if (admin && admin.status === 'active') {
      return session;
    }

    throw new Error('You do not have access to these tutor traces.');
  }

  async listTutorTraces(
    sessionId: string,
    requester: { userId: string; email: string },
    filters: { limit?: string | number; phase?: string; sectionIndex?: string | number; errorsOnly?: string | boolean },
  ) {
    await this.assertTutorTraceAccess(sessionId, requester);

    const parsedLimit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
    const parsedSectionIndex =
      filters.sectionIndex !== undefined && filters.sectionIndex !== null && `${filters.sectionIndex}` !== ''
        ? Number(filters.sectionIndex)
        : null;
    const errorsOnly =
      filters.errorsOnly === true ||
      filters.errorsOnly === 'true' ||
      filters.errorsOnly === '1';

    console.log('tutor_trace_debug_list_requested', {
      sessionId,
      requesterUserId: requester.userId,
      limit: parsedLimit,
      phase: filters.phase || null,
      sectionIndex: parsedSectionIndex,
      errorsOnly,
    });

    return prisma.tutorTurnTrace.findMany({
      where: {
        session_id: sessionId,
        ...(filters.phase ? { phase: String(filters.phase) } : {}),
        ...(Number.isFinite(parsedSectionIndex as number) ? { section_index: parsedSectionIndex as number } : {}),
        ...(errorsOnly ? { error_message: { not: null } } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: parsedLimit,
      select: {
        id: true,
        phase: true,
        turn_type: true,
        action: true,
        section_index: true,
        section_title: true,
        teacher_brain_used: true,
        student_memory_used: true,
        lesson_plan_used: true,
        relevant_material_used: true,
        calculation_context_used: true,
        diagram_context_used: true,
        quality_guardrail_used: true,
        quality_issues: true,
        latency_ms: true,
        ai_latency_ms: true,
        response_chars: true,
        prompt_tokens_estimate: true,
        error_message: true,
        metadata: true,
        created_at: true,
      },
    });
  }

  async getTutorTraceSummary(
    sessionId: string,
    requester: { userId: string; email: string },
  ) {
    await this.assertTutorTraceAccess(sessionId, requester);

    console.log('tutor_trace_debug_summary_requested', {
      sessionId,
      requesterUserId: requester.userId,
    });

    const traces = await prisma.tutorTurnTrace.findMany({
      where: { session_id: sessionId },
      orderBy: { created_at: 'desc' },
      take: 200,
      select: {
        id: true,
        phase: true,
        turn_type: true,
        action: true,
        section_index: true,
        section_title: true,
        teacher_brain_used: true,
        student_memory_used: true,
        lesson_plan_used: true,
        relevant_material_used: true,
        calculation_context_used: true,
        diagram_context_used: true,
        quality_guardrail_used: true,
        quality_issues: true,
        latency_ms: true,
        ai_latency_ms: true,
        response_chars: true,
        prompt_tokens_estimate: true,
        error_message: true,
        metadata: true,
        created_at: true,
      },
    });

    const totalTurns = traces.length;
    const withLatency = traces.filter((trace) => typeof trace.latency_ms === 'number');
    const withAiLatency = traces.filter((trace) => typeof trace.ai_latency_ms === 'number');
    const qualityIssueCounts = traces.reduce<Record<string, number>>((acc, trace) => {
      const issues = Array.isArray(trace.quality_issues) ? trace.quality_issues : [];
      issues.forEach((issue) => {
        const key = String(issue || '').trim();
        if (!key) return;
        acc[key] = (acc[key] || 0) + 1;
      });
      return acc;
    }, {});
    const contextUsageCounts = traces.reduce(
      (acc, trace) => {
        acc.teacherBrainUsed += trace.teacher_brain_used ? 1 : 0;
        acc.studentMemoryUsed += trace.student_memory_used ? 1 : 0;
        acc.lessonPlanUsed += trace.lesson_plan_used ? 1 : 0;
        acc.relevantMaterialUsed += trace.relevant_material_used ? 1 : 0;
        acc.calculationContextUsed += trace.calculation_context_used ? 1 : 0;
        acc.diagramContextUsed += trace.diagram_context_used ? 1 : 0;
        acc.qualityGuardrailUsed += trace.quality_guardrail_used ? 1 : 0;
        return acc;
      },
      {
        teacherBrainUsed: 0,
        studentMemoryUsed: 0,
        lessonPlanUsed: 0,
        relevantMaterialUsed: 0,
        calculationContextUsed: 0,
        diagramContextUsed: 0,
        qualityGuardrailUsed: 0,
      },
    );
    const phases = traces.reduce<Record<string, number>>((acc, trace) => {
      acc[trace.phase] = (acc[trace.phase] || 0) + 1;
      return acc;
    }, {});

    return {
      totalTurns,
      averageLatencyMs: withLatency.length
        ? Math.round(withLatency.reduce((sum, trace) => sum + Number(trace.latency_ms || 0), 0) / withLatency.length)
        : null,
      averageAiLatencyMs: withAiLatency.length
        ? Math.round(withAiLatency.reduce((sum, trace) => sum + Number(trace.ai_latency_ms || 0), 0) / withAiLatency.length)
        : null,
      slowestTurns: [...traces]
        .sort((a, b) => Number(b.latency_ms || 0) - Number(a.latency_ms || 0))
        .slice(0, 5)
        .map((trace) => ({
          id: trace.id,
          phase: trace.phase,
          turn_type: trace.turn_type,
          action: trace.action,
          section_index: trace.section_index,
          section_title: trace.section_title,
          latency_ms: trace.latency_ms,
          ai_latency_ms: trace.ai_latency_ms,
          error_message: trace.error_message,
          created_at: trace.created_at,
        })),
      contextUsageCounts,
      qualityIssueCounts,
      errorCount: traces.filter((trace) => !!trace.error_message).length,
      phases,
    };
  }

  async getVisualPlan(
    sessionId: string,
    requester: { userId: string; email: string },
  ) {
    await this.assertTutorTraceAccess(sessionId, requester);
    return studyCompanionService.getVisualPlan(sessionId);
  }

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

  async synthesizeTutorSpeech(text: string) {
    const sanitized = sanitizeSpeechText(text || '');
    if (!sanitized) {
      throw new Error('Text is required for speech synthesis.');
    }

    if (!config.elevenLabsApiKey) {
      throw new Error('ElevenLabs is not configured. Add ELEVENLABS_API_KEY to the backend environment.');
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenLabsVoiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': config.elevenLabsApiKey,
        },
        body: JSON.stringify({
          text: sanitized,
          model_id: config.elevenLabsModelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.15,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!response.ok) {
      let detail = '';
      try {
        detail = await response.text();
      } catch {
        detail = '';
      }
      throw new Error(parseElevenLabsError(response.status, detail));
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    if (!audioBuffer.length) {
      throw new Error('ElevenLabs returned empty audio.');
    }

    return {
      audioBase64: audioBuffer.toString('base64'),
      mimeType: 'audio/mpeg',
      provider: 'elevenlabs',
    };
  }

  async createTutorSpeechStream(userId: string, sessionId: string, text: string) {
    const session = await this.getSession(sessionId);
    if (session.user_id !== userId) {
      throw new Error('You do not have access to this session.');
    }

    return elevenLabsStreamService.createPendingStream(sessionId, userId, text);
  }

  async streamTutorSpeech(userId: string, sessionId: string, streamId: string, res: Response) {
    const session = await this.getSession(sessionId);
    if (session.user_id !== userId) {
      throw new Error('You do not have access to this session.');
    }

    return elevenLabsStreamService.streamPendingAudio(sessionId, userId, streamId, res);
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
