import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import {
  TutorMessageQualityArgs,
  TutorQualityTraceCapture,
  TutorTraceRuntime,
  TutorTraceSeed,
} from './study-companion.types';
import {
  PASS_2,
  normalizeText,
  formatLessonScopePrompt,
  formatTeachingDepthPlan,
} from './study-companion-prompt-directives';
import {
  buildDeterministicTutorFallback,
  validateTutorMessageQuality,
  generateText,
} from './study-companion-quality-relevance';
import { companionSystemPrompt } from './study-companion-session-state';

export async function startTutorTrace(
  seed: TutorTraceSeed,
): Promise<TutorTraceRuntime> {
  const runtime: TutorTraceRuntime = {
    id: null,
    startedAt: Date.now(),
    aiLatencyMs: 0,
    metadata: { ...(seed.metadata || {}) },
    quality: {
      issues: [],
      regenerated: false,
      fallbackUsed: false,
      correctionApplied: false,
    },
  };

  try {
    const trace = await (
      prisma as typeof prisma & {
        tutorTurnTrace: {
          create: (query: unknown) => Promise<{ id: string }>;
        };
      }
    ).tutorTurnTrace.create({
      data: {
        session_id: seed.sessionId,
        user_id: seed.userId,
        material_id: seed.materialId || null,
        course_code: seed.courseCode || null,
        section_index: seed.sectionIndex ?? null,
        section_title: seed.sectionTitle || null,
        phase: seed.phase,
        turn_type: seed.turnType || null,
        action: seed.action || null,
        teacher_brain_used: seed.teacherBrainUsed,
        student_memory_used: seed.studentMemoryUsed,
        lesson_plan_used: seed.lessonPlanUsed,
        relevant_material_used: seed.relevantMaterialUsed,
        calculation_context_used: seed.calculationContextUsed,
        diagram_context_used: seed.diagramContextUsed,
        quality_guardrail_used: seed.qualityGuardrailUsed,
        prompt_tokens_estimate: seed.promptTokensEstimate ?? null,
        metadata: (seed.metadata || {}) as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    runtime.id = trace.id;
    console.log('tutor_trace_started', {
      traceId: runtime.id,
      sessionId: seed.sessionId,
      phase: seed.phase,
      turnType: seed.turnType,
      action: seed.action,
    });
  } catch (error) {
    console.error('tutor_trace_failed', {
      sessionId: seed.sessionId,
      phase: seed.phase,
      stage: 'start',
      message:
        error instanceof Error ? error.message : 'Unknown trace start error',
    });
  }

  return runtime;
}

export async function finishTutorTrace(
  trace: TutorTraceRuntime,
  args: {
    content: string;
    qualityGuardrailUsed?: boolean;
    extraMetadata?: Record<string, unknown>;
  },
) {
  if (!trace.id) return;

  try {
    const latencyMs = Date.now() - trace.startedAt;
    await (
      prisma as typeof prisma & {
        tutorTurnTrace: {
          update: (query: unknown) => Promise<unknown>;
        };
      }
    ).tutorTurnTrace.update({
      where: { id: trace.id },
      data: {
        quality_guardrail_used: args.qualityGuardrailUsed ?? false,
        quality_issues: trace.quality
          .issues as unknown as Prisma.InputJsonValue,
        response_chars: args.content.length,
        latency_ms: latencyMs,
        ai_latency_ms: trace.aiLatencyMs || null,
        metadata: {
          ...(trace.metadata || {}),
          regenerated: trace.quality.regenerated,
          fallback_used: trace.quality.fallbackUsed,
          correction_applied: trace.quality.correctionApplied,
          scope_violation_detected: trace.quality.issues.some(
            (issue) =>
              issue.startsWith('scope_') ||
              issue === 'teachback_scope_violation',
          ),
          scope_violations: trace.quality.issues.filter(
            (issue) =>
              issue.startsWith('scope_') ||
              issue === 'teachback_scope_violation',
          ),
          depth_violation_detected: trace.quality.issues.some((issue) =>
            issue.startsWith('depth_'),
          ),
          depth_violations: trace.quality.issues.filter((issue) =>
            issue.startsWith('depth_'),
          ),
          ...(args.extraMetadata || {}),
        } as Prisma.InputJsonValue,
      },
    });
    console.log('tutor_trace_finished', {
      traceId: trace.id,
      latencyMs,
      aiLatencyMs: trace.aiLatencyMs,
      responseChars: args.content.length,
    });
  } catch (error) {
    console.error('tutor_trace_failed', {
      traceId: trace.id,
      stage: 'finish',
      message:
        error instanceof Error ? error.message : 'Unknown trace finish error',
    });
  }
}

export async function failTutorTrace(trace: TutorTraceRuntime, error: unknown) {
  if (!trace.id) return;

  try {
    await (
      prisma as typeof prisma & {
        tutorTurnTrace: {
          update: (query: unknown) => Promise<unknown>;
        };
      }
    ).tutorTurnTrace.update({
      where: { id: trace.id },
      data: {
        latency_ms: Date.now() - trace.startedAt,
        ai_latency_ms: trace.aiLatencyMs || null,
        quality_issues: trace.quality
          .issues as unknown as Prisma.InputJsonValue,
        error_message:
          error instanceof Error ? error.message : 'Unknown tutor trace error',
        metadata: {
          ...(trace.metadata || {}),
          regenerated: trace.quality.regenerated,
          fallback_used: trace.quality.fallbackUsed,
          correction_applied: trace.quality.correctionApplied,
          scope_violation_detected: trace.quality.issues.some(
            (issue) =>
              issue.startsWith('scope_') ||
              issue === 'teachback_scope_violation',
          ),
          scope_violations: trace.quality.issues.filter(
            (issue) =>
              issue.startsWith('scope_') ||
              issue === 'teachback_scope_violation',
          ),
          depth_violation_detected: trace.quality.issues.some((issue) =>
            issue.startsWith('depth_'),
          ),
          depth_violations: trace.quality.issues.filter((issue) =>
            issue.startsWith('depth_'),
          ),
        } as Prisma.InputJsonValue,
      },
    });
    console.error('tutor_trace_failed', {
      traceId: trace.id,
      stage: 'turn',
      message:
        error instanceof Error ? error.message : 'Unknown tutor turn error',
    });
  } catch (traceError) {
    console.error('tutor_trace_failed', {
      traceId: trace.id,
      stage: 'fail',
      message:
        traceError instanceof Error
          ? traceError.message
          : 'Unknown trace fail error',
    });
  }
}

export async function enforceTutorMessageQuality(
  args: TutorMessageQualityArgs & {
    prompt: string;
    maxTokens?: number;
    contextMeta?: {
      sessionId: string;
      materialId: string;
      sectionIndex: number;
      prompt: string;
    };
    qualityTrace?: TutorQualityTraceCapture;
  },
) {
  console.log('tutor_quality_check_started', {
    phase: args.phase,
    turnType: args.turnType,
    prompt: args.contextMeta?.prompt,
    sectionTitle: args.section.title,
  });

  const validation = validateTutorMessageQuality(args);
  if (validation.passed) {
    if (args.qualityTrace) {
      args.qualityTrace.issues = [];
    }
    console.log('tutor_quality_check_passed', {
      phase: args.phase,
      turnType: args.turnType,
      prompt: args.contextMeta?.prompt,
    });
    return normalizeText(args.content);
  }

  console.log('tutor_quality_check_failed', {
    phase: args.phase,
    turnType: args.turnType,
    prompt: args.contextMeta?.prompt,
    issues: validation.issues,
  });

  const corrected = normalizeText(validation.correctedContent || '');
  if (args.qualityTrace) {
    args.qualityTrace.issues = [...validation.issues];
  }
  const regenerationNeeded =
    validation.issues.includes('empty_content') ||
    validation.issues.includes('missing_calculation_steps') ||
    validation.issues.includes('missing_visual_language') ||
    validation.issues.includes('micro_question_missing') ||
    validation.issues.includes('too_many_questions') ||
    validation.issues.includes('pacing_too_long') ||
    validation.issues.includes('intro_too_dense') ||
    validation.issues.includes('pass1_too_dense') ||
    validation.issues.includes('scope_out_of_scope_expansion') ||
    validation.issues.includes('scope_preview_overexplained') ||
    validation.issues.includes('teachback_scope_violation') ||
    validation.issues.includes('depth_deferred_explained') ||
    validation.issues.includes('depth_too_advanced_for_pass');

  if (!regenerationNeeded && corrected) {
    if (args.qualityTrace) {
      args.qualityTrace.correctionApplied = true;
    }
    console.log('tutor_quality_correction_applied', {
      phase: args.phase,
      turnType: args.turnType,
      prompt: args.contextMeta?.prompt,
      issues: validation.issues,
    });
    return corrected;
  }

  console.log('tutor_quality_regeneration_used', {
    phase: args.phase,
    turnType: args.turnType,
    prompt: args.contextMeta?.prompt,
    issues: validation.issues,
  });
  console.log('pacing_regeneration_used', {
    phase: args.phase,
    turnType: args.turnType,
    prompt: args.contextMeta?.prompt,
    issues: validation.issues,
  });
  if (
    validation.issues.some(
      (issue) =>
        issue.startsWith('scope_') || issue === 'teachback_scope_violation',
    )
  ) {
    console.log('scope_regeneration_used', {
      phase: args.phase,
      turnType: args.turnType,
      prompt: args.contextMeta?.prompt,
      issues: validation.issues,
    });
  }
  if (validation.issues.some((issue) => issue.startsWith('depth_'))) {
    console.log('depth_regeneration_used', {
      phase: args.phase,
      turnType: args.turnType,
      prompt: args.contextMeta?.prompt,
      issues: validation.issues,
    });
  }
  if (args.qualityTrace) {
    args.qualityTrace.regenerated = true;
  }

  try {
    const regenerationPrompt = [
      args.prompt,
      'Quality fix required:',
      args.microQuestionAllowed
        ? 'End with exactly one short real question the student must answer next. Not zero questions, not more than one.'
        : args.questionAllowed
          ? 'Keep exactly one short question if this turn is a checkpoint.'
          : 'Do not include any question mark or question.',
      args.isCalculationHeavy && args.phase === PASS_2
        ? 'This is a calculation-heavy Pass 2. Include the formula or method and the solving steps clearly.'
        : '',
      args.isDiagramHeavy
        ? 'Use clear visual language such as imagine, picture, parts, arrows, stages, flow, graph, axis, or labels.'
        : '',
      args.lessonScope
        ? `Strict scope reminder:\n${formatLessonScopePrompt(args.lessonScope)}`
        : '',
      args.teachingDepthPlan
        ? `Strict depth reminder:\n${formatTeachingDepthPlan(args.teachingDepthPlan)}`
        : '',
      'Stay grounded in the current section.',
      'Keep the reply concise.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const regenerated = await generateText(
      regenerationPrompt,
      companionSystemPrompt(),
      args.maxTokens || 320,
    );
    const secondPass = validateTutorMessageQuality({
      ...args,
      content: regenerated,
    });
    if (secondPass.passed) {
      return normalizeText(regenerated);
    }
    if (secondPass.correctedContent) {
      if (args.qualityTrace) {
        args.qualityTrace.correctionApplied = true;
        args.qualityTrace.issues = [...secondPass.issues];
      }
      console.log('tutor_quality_correction_applied', {
        phase: args.phase,
        turnType: args.turnType,
        prompt: args.contextMeta?.prompt,
        issues: secondPass.issues,
      });
      return normalizeText(secondPass.correctedContent);
    }
  } catch (error) {
    console.error('tutor_quality_regeneration_used', {
      phase: args.phase,
      turnType: args.turnType,
      prompt: args.contextMeta?.prompt,
      error:
        error instanceof Error ? error.message : 'Unknown regeneration error',
    });
  }

  const fallback = buildDeterministicTutorFallback(args);
  if (args.qualityTrace) {
    args.qualityTrace.fallbackUsed = true;
    args.qualityTrace.correctionApplied = true;
  }
  console.log('tutor_quality_correction_applied', {
    phase: args.phase,
    turnType: args.turnType,
    prompt: args.contextMeta?.prompt,
    issues: validation.issues,
    fallback: true,
  });
  return normalizeText(fallback);
}
