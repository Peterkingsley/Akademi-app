import { Prisma, SessionType, TutorConfidenceBucket } from '@prisma/client';
import prisma from '../../config/db';

type TutorMaterialContext = {
  id: string;
  title: string;
  course_code?: string | null;
  content?: string | null;
  reader_structure?: Prisma.JsonValue | null;
};

type TutorSessionContext = {
  id: string;
  user_id: string;
  session_type: SessionType;
  course_code?: string | null;
  department: string;
  topic?: string | null;
  material?: TutorMaterialContext | null;
};

type LessonSection = {
  sectionId: string;
  title: string;
  objective: string;
  visuals: string[];
  keyPoints: string[];
  checkpointQuestions: string[];
};

const CONFUSION_PATTERNS = [
  /\bi don'?t understand\b/i,
  /\bconfused\b/i,
  /\bexplain again\b/i,
  /\bgo slower\b/i,
  /\bshow me\b/i,
  /\bvisual/i,
  /\bdraw\b/i,
  /\bwhat do you mean\b/i,
  /\bi don'?t know\b/i,
];

const MASTERY_PATTERNS = [
  /\bi understand\b/i,
  /\bgot it\b/i,
  /\bcorrect\b/i,
  /\bit means\b/i,
  /\bthe answer is\b/i,
  /\bso\b.+\bmeans\b/i,
];

function safeWords(value: string, max = 8) {
  return value.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).slice(0, max).join(' ');
}

function extractMaterialSections(material: TutorMaterialContext | null | undefined): LessonSection[] {
  const pages = Array.isArray((material?.reader_structure as any)?.pages)
    ? ((material?.reader_structure as any).pages as any[])
    : [];

  const fromPages = pages
    .map((page, index) => {
      const title = String(page.chapterTitle || page.pageTitle || '').trim();
      if (!title) return null;
      return {
        sectionId: `section-${index + 1}`,
        title: safeWords(title, 10),
        objective: `Understand ${safeWords(title, 12)} well enough to explain it back.`,
        visuals: [],
        keyPoints: [],
        checkpointQuestions: [`In your own words, what is the main idea of ${safeWords(title, 6)}?`],
      } satisfies LessonSection;
    })
    .filter(Boolean) as LessonSection[];

  if (fromPages.length > 0) return fromPages.slice(0, 12);

  const title = material?.title || 'this material';
  return [
    {
      sectionId: 'section-1',
      title: `Foundation of ${safeWords(title, 6)}`,
      objective: 'Build the starting idea before moving into details.',
      visuals: [],
      keyPoints: [],
      checkpointQuestions: [`What do you already know about ${safeWords(title, 5)}?`],
    },
    {
      sectionId: 'section-2',
      title: 'Core ideas',
      objective: 'Connect the main terms, rules, and examples.',
      visuals: [],
      keyPoints: [],
      checkpointQuestions: ['Which part feels most important so far?'],
    },
    {
      sectionId: 'section-3',
      title: 'Practice and check',
      objective: 'Use the idea in a small task and confirm understanding.',
      visuals: [],
      keyPoints: [],
      checkpointQuestions: ['Can you try a short example from this section?'],
    },
  ];
}

function classifyConfidence(studentInput: string, questionCount: number) {
  const text = studentInput.trim();
  const isConfused = CONFUSION_PATTERNS.some((pattern) => pattern.test(text));
  if (isConfused) {
    return {
      score: 25,
      bucket: TutorConfidenceBucket.CONFUSED,
      reason: 'Student signaled confusion or asked for a visual/slower explanation.',
    };
  }

  const isMastery = text.length > 18 && MASTERY_PATTERNS.some((pattern) => pattern.test(text));
  if (isMastery) {
    return {
      score: 86,
      bucket: TutorConfidenceBucket.MASTERY,
      reason: 'Student response suggests they can explain or confirm the idea.',
    };
  }

  const shortReply = text.split(/\s+/).filter(Boolean).length <= 4;
  return {
    score: shortReply && questionCount > 0 ? 45 : 62,
    bucket: TutorConfidenceBucket.PARTIAL,
    reason: shortReply
      ? 'Student gave a short response that needs a quick check.'
      : 'Student is participating, but mastery is not yet clear.',
  };
}

function chooseDecision(bucket: TutorConfidenceBucket, visualRequested: boolean, isNewSection: boolean) {
  if (bucket === TutorConfidenceBucket.MASTERY) {
    return {
      action: 'MOVE_FORWARD',
      shouldGenerateVisual: isNewSection,
      shouldAskCheckpoint: true,
      instruction: 'Affirm briefly, connect the idea, then move to the next section if appropriate.',
    };
  }

  if (bucket === TutorConfidenceBucket.CONFUSED || visualRequested) {
    return {
      action: 'RETEACH_WITH_VISUAL',
      shouldGenerateVisual: true,
      shouldAskCheckpoint: true,
      instruction: 'Slow down, use a visual explanation, then ask one simple checkpoint question.',
    };
  }

  return {
    action: 'CLARIFY',
    shouldGenerateVisual: isNewSection,
    shouldAskCheckpoint: true,
    instruction: 'Give a short clarification or mini example before checking understanding.',
  };
}

function buildVisualPayload(concept: string, topic: string) {
  return {
    title: safeWords(concept, 6),
    center: safeWords(concept, 5),
    nodes: [
      'Meaning',
      'How it works',
      'Example',
      'Common mistake',
    ],
    labels: [
      safeWords(topic, 4),
      'Key idea',
      'Example',
      'Checkpoint',
    ],
  };
}

export class TutorOrchestrator {
  async prepareTurn(userId: string, session: TutorSessionContext, studentInput: string) {
    if (session.session_type !== SessionType.TUTOR || !session.material) {
      return null;
    }

    const existingState = await prisma.tutorSessionState.findUnique({
      where: { session_id: session.id },
    });
    const lessonPlan = existingState?.lesson_plan && Array.isArray(existingState.lesson_plan)
      ? existingState.lesson_plan as unknown as LessonSection[]
      : extractMaterialSections(session.material);

    const currentSection =
      lessonPlan.find((section) => section.sectionId === existingState?.current_section_id) ||
      lessonPlan[0];

    const confidence = classifyConfidence(studentInput, existingState?.questions_asked || 0);
    const visualRequested = CONFUSION_PATTERNS.slice(3, 7).some((pattern) => pattern.test(studentInput));
    const seenVisualIds = Array.isArray(existingState?.visuals_shown)
      ? existingState?.visuals_shown.map(String)
      : [];
    const isNewSection = !existingState || currentSection?.sectionId !== existingState.current_section_id;
    const decision = chooseDecision(confidence.bucket, visualRequested, isNewSection);

    let visualAsset: any = null;
    if (decision.shouldGenerateVisual && currentSection) {
      visualAsset = await prisma.tutorVisualAsset.findFirst({
        where: {
          course_code: session.material.course_code || session.course_code || null,
          department: session.department,
          concept: { equals: currentSection.title, mode: 'insensitive' },
        },
        orderBy: [{ effectiveness_score: 'desc' }, { reuse_count: 'desc' }],
      });

      if (visualAsset) {
        await prisma.tutorVisualAsset.update({
          where: { id: visualAsset.id },
          data: { reuse_count: { increment: 1 } },
        });
      } else {
        visualAsset = await prisma.tutorVisualAsset.create({
          data: {
            topic: session.material.title,
            concept: currentSection.title,
            course_code: session.material.course_code || session.course_code || null,
            department: session.department,
            difficulty: confidence.bucket === TutorConfidenceBucket.CONFUSED ? 'Beginner' : 'Standard',
            visual_type: confidence.bucket === TutorConfidenceBucket.CONFUSED ? 'Concept Illustration' : 'Concept Map',
            render_mode: 'native',
            payload: buildVisualPayload(currentSection.title, session.material.title) as Prisma.InputJsonValue,
            prerequisites: [] as Prisma.InputJsonValue,
            created_for_user_id: userId,
          },
        });
      }
    }

    const nextVisuals = visualAsset && !seenVisualIds.includes(visualAsset.id)
      ? [...seenVisualIds, visualAsset.id]
      : seenVisualIds;
    const nextQuestionCount = (existingState?.questions_asked || 0) + (decision.shouldAskCheckpoint ? 1 : 0);
    const statePayload = {
      current_topic: session.material.title,
      current_section_id: currentSection?.sectionId || null,
      current_section_title: currentSection?.title || null,
      confidence_score: confidence.score,
      confidence_bucket: confidence.bucket,
      visuals_shown: nextVisuals as Prisma.InputJsonValue,
      questions_asked: nextQuestionCount,
      lesson_plan: lessonPlan as unknown as Prisma.InputJsonValue,
      last_decision: {
        action: decision.action,
        reason: confidence.reason,
        visualAssetId: visualAsset?.id || null,
      } as Prisma.InputJsonValue,
    };

    await prisma.tutorSessionState.upsert({
      where: { session_id: session.id },
      update: statePayload,
      create: {
        session_id: session.id,
        ...statePayload,
      },
    });

    await prisma.tutorConfidenceEvent.create({
      data: {
        session_id: session.id,
        user_id: userId,
        student_input: studentInput.slice(0, 1200),
        confidence_score: confidence.score,
        confidence_bucket: confidence.bucket,
        decision: decision.action,
        visual_triggered: !!visualAsset,
        current_section_id: currentSection?.sectionId || null,
      },
    });

    return {
      promptContext: [
        'Adaptive Tutor V2 State:',
        `- Current section: ${currentSection?.title || 'Not set'}`,
        `- Section objective: ${currentSection?.objective || 'Teach the next useful chunk.'}`,
        `- Confidence bucket: ${confidence.bucket} (${confidence.score}/100)`,
        `- Orchestrator decision: ${decision.action}`,
        `- Teaching instruction: ${decision.instruction}`,
        visualAsset
          ? `- Use visual asset: ${visualAsset.visual_type} for ${visualAsset.concept}. Describe it as a simple teaching board, not as a technical diagram.`
          : '- No visual needed unless the student asks for one.',
        decision.shouldAskCheckpoint
          ? `- End with this checkpoint style: ${currentSection?.checkpointQuestions?.[0] || 'Ask one short understanding check.'}`
          : '- Do not ask a checkpoint this turn.',
      ].join('\n'),
      metadata: {
        tutorAdaptive: {
          confidenceScore: confidence.score,
          confidenceBucket: confidence.bucket,
          decision: decision.action,
          reason: confidence.reason,
          currentSection: currentSection
            ? {
                id: currentSection.sectionId,
                title: currentSection.title,
                objective: currentSection.objective,
              }
            : null,
          checkpointQuestion: decision.shouldAskCheckpoint
            ? currentSection?.checkpointQuestions?.[0] || null
            : null,
          visual: visualAsset
            ? {
                id: visualAsset.id,
                topic: visualAsset.topic,
                concept: visualAsset.concept,
                visualType: visualAsset.visual_type,
                renderMode: visualAsset.render_mode,
                payload: visualAsset.payload,
              }
            : null,
        },
      },
    };
  }
}

export const tutorOrchestrator = new TutorOrchestrator();
