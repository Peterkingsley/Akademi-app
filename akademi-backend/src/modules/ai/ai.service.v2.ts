import { Prisma, ReplyMode } from '@prisma/client';
import prisma from '../../config/db';
import { checkDailyLimit, getAICacheKey, getCachedAIResponse, setCachedAIResponse } from './ai.cache';
import { graphSystemPrompt } from './ai.prompts';
import {
  ADAPTIVE_PROMPT_VERSION,
  adaptiveVerifierSystemPrompt,
  buildAdaptiveEssayBlueprintSystemPrompt,
  buildAdaptiveTutorSystemPrompt,
  buildAdaptiveWhiteboardSystemPrompt,
} from './ai.prompts.v2';
import { buildHybridCourseMaterialContext, RetrievalResult } from './adaptive-retrieval';
import { generateAdaptiveResponse } from './adaptive-model-router';
import { planTutorState, TutorState } from './tutor-state';
import { sampleFunction, findRoots, findYIntercept, findTurningPoints, Point } from './expression-evaluator';
import { GraphMarker, GraphSpec, RawGraphResponse } from './graph.types';
import type { OrchestratedAIResponse } from '../../shared/utils/ai-orchestrator';

function formatConversation(messages: Array<{ role: string; content: string; created_at: Date }>) {
  return messages
    .map((message) => `${message.role === 'STUDENT' ? 'Student' : 'Akademi'}: ${message.content}`)
    .join('\n\n');
}

const ROUTING_STOP_WORDS = new Set([
  'about', 'again', 'answer', 'because', 'before', 'being', 'could', 'course', 'does',
  'explain', 'from', 'have', 'into', 'just', 'know', 'learn', 'like', 'make', 'more',
  'question', 'school', 'should', 'show', 'student', 'tell', 'that', 'their', 'them',
  'then', 'there', 'these', 'they', 'thing', 'this', 'topic', 'understand', 'what',
  'when', 'where', 'which', 'with', 'would',
]);

function routingTokens(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !ROUTING_STOP_WORDS.has(token));
}

function filterRelevantCommunityPatterns(patterns: any[], studentMessage: string, conversationHistory: string) {
  if (!patterns?.length) return [];
  const queryTokens = new Set(routingTokens(`${studentMessage} ${conversationHistory.slice(-1200)}`));
  return patterns
    .map((pattern) => {
      const payload = pattern.question_pattern || {};
      const text = [pattern.university, pattern.faculty, pattern.department, payload.title, payload.story, payload.topic, ...(payload.tags || [])]
        .filter(Boolean)
        .join(' ');
      const tokens = new Set(routingTokens(text));
      let score = 0;
      queryTokens.forEach((token) => { if (tokens.has(token)) score += 1; });
      if (payload.type !== 'school_story') score += 0.5;
      return { pattern, score };
    })
    .filter(({ pattern, score }) => (pattern.question_pattern || {}).type === 'school_story' ? score >= 2 : score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ pattern }) => pattern);
}

export function hasCalculationSignals(studentMessage: string) {
  const text = studentMessage.toLowerCase();
  const mathSignals = [
    'solve', 'calculate', 'ratio', 'simplify', 'differentiate', 'derivative', 'dy/dx',
    'integrate', 'integration', 'limit', 'find x', 'solve for x', 'quadratic', 'factorize',
    'logarithm', 'trigonometry', 'equation', 'simultaneous', 'matrix', 'probability',
    'mean', 'median', 'fraction', 'percentage', 'velocity', 'acceleration', 'kinetic energy',
    'mole', 'molar', 'stoichiometry', 'balance this reaction',
  ];
  const symbolSignal = /[\d]+\s*[+\-*\/=]|[÷×√π∫Σ]|\bdy\/dx\b|\bdx\b|\bx\^|\bx²|\bx³/.test(studentMessage);
  return symbolSignal || mathSignals.some((signal) => {
    const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  });
}

export function hasEssayDirectiveSignals(studentMessage: string) {
  const text = studentMessage.toLowerCase();
  const signals = [
    'critically examine', 'critically evaluate', 'critically discuss', 'critically assess',
    'discuss', 'evaluate', 'assess', 'examine', 'analyze', 'analyse', 'to what extent',
    'compare and contrast', 'justify', 'account for', 'explain the significance',
    'explain the role', 'list and explain',
  ];
  return signals.some((signal) => {
    const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  });
}

function extractJsonObject(raw: string) {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] || raw;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) return candidate.slice(firstBrace, lastBrace + 1);
  return candidate.trim();
}

function hasBalancedBraces(value: string) {
  let depth = 0;
  for (const char of value) {
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function normalizeMath(value: unknown) {
  const text = String(value || '')
    .trim()
    .replace(/\$\$?/g, '')
    .replace(/\\\((.*?)\\\)/gs, '$1')
    .replace(/\\\[(.*?)\\\]/gs, '$1')
    .replace(/\\{2,}(?=[A-Za-z])/g, '\\')
    .replace(/×/g, '\\cdot')
    .replace(/÷/g, '\\div')
    .trim();
  return hasBalancedBraces(text) ? text : '';
}

function cleanCopy(value: unknown, maxLength = 260) {
  return String(value || '')
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function parseWhiteboardPayload(raw: string) {
  try {
    const parsed = JSON.parse(extractJsonObject(raw));
    if (typeof parsed?.final_answer !== 'string' || !Array.isArray(parsed?.steps)) return null;
    const steps = parsed.steps
      .map((step: any, index: number) => ({
        id: String(step?.id || `step-${index + 1}`),
        type: ['write', 'highlight', 'answer'].includes(step?.type) ? step.type : 'write',
        phase: ['understand', 'method', 'work', 'verify'].includes(step?.phase) ? step.phase : 'work',
        text: cleanCopy(step?.text, 220),
        math: normalizeMath(step?.math),
        note: cleanCopy(step?.note, 180),
      }))
      .filter((step: { text: string; math: string }) => step.text || step.math)
      .slice(0, 16);
    if (!steps.length) return null;
    return {
      title: cleanCopy(parsed?.title || 'Board walkthrough', 120),
      board_style: 'digital-whiteboard' as const,
      steps,
      final_answer: cleanCopy(parsed.final_answer, 500),
      final_answer_math: normalizeMath(parsed?.final_answer_math || parsed.final_answer),
      summary: cleanCopy(parsed?.summary, 500),
    };
  } catch {
    return null;
  }
}

function parseEssayBlueprintPayload(raw: string) {
  try {
    const parsed = JSON.parse(extractJsonObject(raw));
    if (typeof parsed?.final_answer !== 'string' || !Array.isArray(parsed?.steps)) return null;
    const steps = parsed.steps
      .map((step: any, index: number) => ({
        id: String(step?.id || `step-${index + 1}`),
        type: ['write', 'highlight', 'answer'].includes(step?.type) ? step.type : 'write',
        phase: String(step?.phase || 'point'),
        text: cleanCopy(step?.text, 420),
        math: '',
        note: cleanCopy(step?.note, 220),
      }))
      .filter((step: { text: string }) => step.text)
      .slice(0, 12);
    if (!steps.length) return null;
    return {
      title: cleanCopy(parsed?.title || 'Essay blueprint', 120),
      board_style: 'essay-blueprint' as const,
      question_type: String(parsed?.question_type || 'explanatory'),
      steps,
      final_answer: cleanCopy(parsed.final_answer, 1200),
      summary: cleanCopy(parsed?.summary, 600),
    };
  } catch {
    return null;
  }
}

function extractPracticeBlock(text: string): { content: string; practice: { question: string; answer: string } | null } {
  const match = text.match(/\[PRACTICE\]([\s\S]*?)\[\/PRACTICE\]\s*\[PRACTICE_ANSWER\]([\s\S]*?)\[\/PRACTICE_ANSWER\]/);
  if (!match) return { content: text, practice: null };
  const question = match[1].trim();
  const answer = match[2].trim();
  const content = (text.slice(0, match.index) + text.slice((match.index || 0) + match[0].length)).trim();
  return question && answer ? { content, practice: { question, answer } } : { content, practice: null };
}

interface VerificationResult {
  ok: boolean;
  severity: 'none' | 'minor' | 'critical';
  issue: string;
  repair_instruction: string;
  checked: boolean;
}

export class AdaptiveAIService {
  private normalizeGraphResponse(raw: RawGraphResponse | null | undefined): GraphSpec | null {
    if (!raw || raw.eligible !== true || !raw.kind) return null;
    const title = cleanCopy(raw.title || 'Graph', 120) || 'Graph';
    const xAxisLabel = cleanCopy(raw.x_axis_label, 60);
    const yAxisLabel = cleanCopy(raw.y_axis_label, 60);
    const caption = cleanCopy(raw.caption, 220);

    if (raw.kind === 'function_plot') {
      const expression = String(raw.expression || '').trim();
      const domainMin = Number(raw.domain_min);
      const domainMax = Number(raw.domain_max);
      if (!expression || !Number.isFinite(domainMin) || !Number.isFinite(domainMax) || domainMin >= domainMax) return null;
      let points: Point[];
      try {
        points = sampleFunction(expression, domainMin, domainMax);
      } catch {
        return null;
      }
      if (points.length < 2) return null;
      const markers: GraphMarker[] = [];
      findRoots(points).forEach((root, index) => markers.push({ x: root.x, y: root.y, label: index === 0 ? 'Root' : `Root ${index + 1}` }));
      const yIntercept = findYIntercept(expression, domainMin, domainMax);
      if (yIntercept) markers.push({ x: yIntercept.x, y: yIntercept.y, label: 'y-intercept' });
      findTurningPoints(points).forEach((point) => markers.push({ x: point.x, y: point.y, label: 'Turning point' }));
      return {
        kind: 'function_plot',
        title,
        x_axis: { label: xAxisLabel || 'x', min: domainMin, max: domainMax },
        y_axis: { label: yAxisLabel || 'y' },
        series: [{ label: expression, points }],
        markers,
        caption,
      };
    }

    if (raw.kind === 'pie_chart' || raw.kind === 'bar_chart') {
      const segments = (raw.segments || [])
        .map((segment) => ({ label: cleanCopy(segment?.label, 80), value: Number(segment?.value) }))
        .filter((segment) => segment.label && Number.isFinite(segment.value) && segment.value >= 0)
        .slice(0, 12);
      if (segments.length < 2) return null;
      return { kind: raw.kind, title, x_axis: { label: xAxisLabel }, y_axis: { label: yAxisLabel }, segments, caption };
    }

    if (raw.kind === 'line_chart' || raw.kind === 'scatter_plot') {
      const series = (raw.series || [])
        .map((entry) => ({
          label: cleanCopy(entry?.label || 'Series', 80) || 'Series',
          points: (entry?.points || [])
            .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
        }))
        .filter((entry) => entry.points.length >= 2)
        .slice(0, 4);
      if (!series.length) return null;
      return { kind: raw.kind, title, x_axis: { label: xAxisLabel }, y_axis: { label: yAxisLabel }, series, caption };
    }
    return null;
  }

  private async buildWhiteboardPayload(studentMessage: string, answer: string, state: TutorState) {
    try {
      const raw = await generateAdaptiveResponse(
        `Question: ${studentMessage}\n\nReference solution:\n${answer}\n\nCreate the adaptive board replay.`,
        {
          systemPrompt: buildAdaptiveWhiteboardSystemPrompt(state),
          maxTokens: state.depth === 'FOUNDATION' ? 1100 : 850,
          complexity: state.complexity,
          purpose: 'tutor',
        },
      );
      return parseWhiteboardPayload(raw);
    } catch (error) {
      console.error('adaptive_whiteboard_generation_failed', { error });
      return null;
    }
  }

  private async buildEssayBlueprintPayload(studentMessage: string, answer: string, state: TutorState) {
    try {
      const raw = await generateAdaptiveResponse(
        `Question: ${studentMessage}\n\nReference answer:\n${answer}\n\nCreate the adaptive exam blueprint.`,
        {
          systemPrompt: buildAdaptiveEssayBlueprintSystemPrompt(state),
          maxTokens: 900,
          complexity: state.complexity,
          purpose: 'tutor',
        },
      );
      return parseEssayBlueprintPayload(raw);
    } catch (error) {
      console.error('adaptive_essay_blueprint_failed', { error });
      return null;
    }
  }

  private async buildGraphPayload(studentMessage: string, answer: string): Promise<GraphSpec | null> {
    try {
      const raw = await generateAdaptiveResponse(
        `Question: ${studentMessage}\n\nReference solution:\n${answer}\n\nDecide whether this needs a graph or chart, and if so extract the raw data for it.`,
        { systemPrompt: graphSystemPrompt, maxTokens: 500, complexity: 3, purpose: 'tutor' },
      );
      return this.normalizeGraphResponse(JSON.parse(extractJsonObject(raw)) as RawGraphResponse);
    } catch {
      return null;
    }
  }

  private async verifyAnswer(
    question: string,
    answer: string,
    courseContext: string,
    state: TutorState,
  ): Promise<VerificationResult> {
    if (!state.needsVerification && state.complexity < 4) {
      return { ok: true, severity: 'none', issue: '', repair_instruction: '', checked: false };
    }
    try {
      const raw = await generateAdaptiveResponse(
        `Student question:\n${question}\n\nTutor State:\n${JSON.stringify(state)}\n\nCourse evidence:\n${courseContext.slice(0, 5000)}\n\nProposed answer:\n${answer.slice(0, 12000)}`,
        {
          systemPrompt: adaptiveVerifierSystemPrompt,
          maxTokens: 220,
          complexity: Math.max(4, state.complexity),
          purpose: 'verifier',
          temperature: 0,
        },
      );
      const parsed = JSON.parse(extractJsonObject(raw));
      const severity = ['none', 'minor', 'critical'].includes(parsed?.severity) ? parsed.severity : (parsed?.ok === false ? 'critical' : 'none');
      return {
        ok: parsed?.ok !== false,
        severity,
        issue: cleanCopy(parsed?.issue, 500),
        repair_instruction: cleanCopy(parsed?.repair_instruction, 700),
        checked: true,
      };
    } catch (error) {
      console.warn('adaptive_answer_verifier_failed_open', { error });
      return { ok: true, severity: 'none', issue: '', repair_instruction: '', checked: false };
    }
  }

  private isGraphEligibleQuestion(studentMessage: string, state: TutorState, sessionType: string) {
    if (sessionType !== 'ASSIGNMENT' && sessionType !== 'STUDY') return false;
    const text = studentMessage.toLowerCase();
    const explicit = [
      'plot', 'graph', 'sketch', 'pie chart', 'bar chart', 'histogram', 'ogive', 'scatter plot',
      'line graph', 'demand curve', 'supply curve', 'frequency distribution', 'pictogram',
      'injective', 'surjective', 'bijective', 'one-to-one', 'onto', 'domain and range',
    ].some((signal) => text.includes(signal));
    return explicit || (state.needsVisual && state.needsCalculation);
  }

  private async getLatestIntelligence(userId: string, courseCode: string | null) {
    try {
      return await prisma.learningIntelligenceRecord.findFirst({
        where: {
          user_id: userId,
          ...(courseCode ? { course_code: courseCode } : {}),
        },
        orderBy: { updated_at: 'desc' },
      });
    } catch {
      return null;
    }
  }

  private async recordTrace(input: {
    session: any;
    userId: string;
    state: TutorState;
    retrieval: RetrievalResult;
    verification: VerificationResult;
    responseChars: number;
    startedAt: number;
  }) {
    try {
      await prisma.tutorTurnTrace.create({
        data: {
          session_id: input.session.id,
          user_id: input.userId,
          material_id: input.session.material_id || null,
          course_code: input.session.course_code || null,
          phase: 'ADAPTIVE_TUTOR_V2',
          turn_type: input.state.taskType,
          action: input.state.strategy,
          relevant_material_used: input.retrieval.used,
          quality_guardrail_used: input.verification.checked,
          quality_issues: input.verification.ok ? [] : [input.verification.issue],
          response_chars: input.responseChars,
          latency_ms: Date.now() - input.startedAt,
          metadata: {
            tutor_state: input.state,
            retrieval: {
              semantic_used: input.retrieval.semanticUsed,
              candidate_count: input.retrieval.candidateCount,
              selected_count: input.retrieval.selectedCount,
            },
            verification: input.verification,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      console.warn('adaptive_tutor_trace_failed', { error });
    }
  }

  async getOrchestratedResponse(
    userId: string,
    sessionId: string,
    studentMessage: string,
    replyMode: ReplyMode,
    hasActivePaidFeature: boolean,
    standalone = false,
  ): Promise<OrchestratedAIResponse> {
    const startedAt = Date.now();
    await checkDailyLimit(userId, hasActivePaidFeature);

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        material: {
          select: { id: true, title: true, course_code: true, content: true, reader_structure: true },
        },
        messages: {
          orderBy: { created_at: 'asc' },
          select: { role: true, content: true, created_at: true },
        },
      },
    });
    if (!session) throw new Error('Session not found');

    const effectiveReplyMode = standalone || replyMode === ReplyMode.SOCRATIC ? ReplyMode.STUDY : replyMode;
    const recentMessages = session.messages.slice(-12);
    const conversationHistory = formatConversation(recentMessages);
    const isCalculationQuestion = hasCalculationSignals(studentMessage);
    const isEssayQuestion = !isCalculationQuestion && hasEssayDirectiveSignals(studentMessage);

    const [learningProfile, communityPatterns, disciplineDocument, latestIntelligence] = await Promise.all([
      prisma.learningProfile.findUnique({ where: { user_id: userId } }),
      prisma.communityPattern.findMany({
        where: {
          OR: [
            { university: session.university, faculty: 'ALL', department: 'ALL', course_code: null, question_pattern: { path: ['is_active'], equals: true } },
            { department: session.department, course_code: session.course_code || undefined },
          ],
        },
        orderBy: { updated_at: 'desc' },
        take: 8,
      }),
      prisma.disciplineDocument.findFirst({ where: { department: session.department, is_active: true }, orderBy: { version: 'desc' } }),
      this.getLatestIntelligence(userId, session.course_code),
    ]);

    const relevantCommunityPatterns = filterRelevantCommunityPatterns(communityPatterns, studentMessage, conversationHistory);
    const tutorState = await planTutorState({
      studentMessage,
      replyMode: effectiveReplyMode,
      standalone,
      learningProfile,
      latestIntelligence,
      conversationHistory,
      calculationSignal: isCalculationQuestion,
      essaySignal: isEssayQuestion,
    });

    const retrievalQuery = [studentMessage, ...tutorState.focusConcepts].filter(Boolean).join(' ');
    const retrieval = await buildHybridCourseMaterialContext(
      session.course_code,
      session.university,
      session.department,
      retrievalQuery,
    );

    const isFollowUp = !standalone && session.messages.length > 1;
    const prompt = standalone
      ? `This is a standalone assignment question with no chat input on this screen.
Solve every sub-part completely in this response at the learner depth in the Tutor State. Do not ask for clarification or wait for a reply. Explain the reasoning needed at that depth; do not force beginner definitions when the state is STANDARD or ADVANCED.
After the complete answer, add exactly one same-skill practice question and a short worked answer using these exact tags at the very end, with nothing after them:
[PRACTICE]practice question[/PRACTICE][PRACTICE_ANSWER]short worked answer[/PRACTICE_ANSWER]

Question:\n${studentMessage}`
      : isFollowUp
        ? `Continue the existing learning conversation without restarting it.
Recent conversation:\n${conversationHistory}\n\nLatest student reply:\n${studentMessage}
Evaluate the latest reply first if it answers Akademi's previous question. If the learner is stuck, give a concrete foothold and move forward.`
        : studentMessage;

    const cacheKey = getAICacheKey(
      `${session.course_code || 'GENERAL'}:${tutorState.depth}:${tutorState.intent}:${tutorState.strategy}`,
      studentMessage,
      effectiveReplyMode,
      disciplineDocument?.version || 1,
      ADAPTIVE_PROMPT_VERSION,
    );
    const cachedResponse = isFollowUp || standalone ? null : await getCachedAIResponse(cacheKey);
    if (cachedResponse) {
      return {
        content: cachedResponse,
        metadata: { tutor_state: tutorState, cache: { hit: true } },
      };
    }

    const systemPrompt = [
      `Student academic context:\nUniversity: ${session.university}\nDepartment: ${session.department}\nSelected course: ${session.course_code || 'GENERAL'}`,
      retrieval.context,
      buildAdaptiveTutorSystemPrompt({
        disciplineDocument,
        learningProfile,
        communityPatterns: relevantCommunityPatterns,
        replyMode: effectiveReplyMode,
        tutorState,
      }),
    ].filter(Boolean).join('\n\n---\n\n');

    const baseMaxTokens = standalone
      ? 8000
      : tutorState.depth === 'FOUNDATION'
        ? 1700
        : tutorState.depth === 'GUIDED'
          ? 1400
          : tutorState.complexity >= 4
            ? 1800
            : 1100;

    let answer = await generateAdaptiveResponse(prompt, {
      systemPrompt,
      maxTokens: baseMaxTokens,
      complexity: tutorState.complexity,
      purpose: 'tutor',
      extendedTimeouts: standalone || tutorState.complexity >= 4,
    });

    let verification = await this.verifyAnswer(studentMessage, answer, retrieval.context, tutorState);
    if (!verification.ok && verification.severity === 'critical') {
      answer = await generateAdaptiveResponse(prompt, {
        systemPrompt: `${systemPrompt}\n\nQUALITY REPAIR REQUIRED:\n${verification.repair_instruction || verification.issue}\nCorrect the issue silently. Return the complete corrected student-facing answer, not a patch or apology.`,
        maxTokens: baseMaxTokens,
        complexity: Math.max(4, tutorState.complexity),
        purpose: 'tutor',
        extendedTimeouts: standalone || tutorState.complexity >= 4,
      });
      verification = await this.verifyAnswer(studentMessage, answer, retrieval.context, tutorState);
    }

    const { content: cleanedResponseText, practice: practiceBlock } = standalone
      ? extractPracticeBlock(answer)
      : { content: answer.trim(), practice: null };

    const boardEligible = (session.session_type === 'ASSIGNMENT' || session.session_type === 'STUDY') && tutorState.needsCalculation;
    const essayEligible = (session.session_type === 'ASSIGNMENT' || session.session_type === 'STUDY')
      && !tutorState.needsCalculation
      && (tutorState.taskType === 'essay' || isEssayQuestion);
    const graphEligible = this.isGraphEligibleQuestion(studentMessage, tutorState, session.session_type);

    const [whiteboardPayload, graphPayload, essayBlueprintPayload] = await Promise.all([
      boardEligible ? this.buildWhiteboardPayload(studentMessage, cleanedResponseText, tutorState) : Promise.resolve(null),
      graphEligible ? this.buildGraphPayload(studentMessage, cleanedResponseText) : Promise.resolve(null),
      essayEligible ? this.buildEssayBlueprintPayload(studentMessage, cleanedResponseText, tutorState) : Promise.resolve(null),
    ]);

    if (!isFollowUp && !standalone) await setCachedAIResponse(cacheKey, cleanedResponseText);

    await this.recordTrace({
      session,
      userId,
      state: tutorState,
      retrieval,
      verification,
      responseChars: cleanedResponseText.length,
      startedAt,
    });

    return {
      content: cleanedResponseText,
      metadata: {
        tutor_state: tutorState,
        retrieval: {
          used: retrieval.used,
          semantic_used: retrieval.semanticUsed,
          candidate_count: retrieval.candidateCount,
          selected_count: retrieval.selectedCount,
        },
        verification,
        ...(whiteboardPayload ? { whiteboard: { available: true, subject_family: 'quantitative', payload: whiteboardPayload } } : {}),
        ...(graphPayload ? { graph: { available: true, payload: graphPayload } } : {}),
        ...(essayBlueprintPayload ? { essay_blueprint: { available: true, subject_family: 'conceptual', payload: essayBlueprintPayload } } : {}),
        ...(practiceBlock ? { practice: practiceBlock } : {}),
      },
    };
  }
}

export const adaptiveAIService = new AdaptiveAIService();
