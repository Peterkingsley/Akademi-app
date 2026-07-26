import prisma from '../config/db';
import { systemQueue, JOB_NAMES } from '../config/queue';

export async function buildCourseFloorJob(courseCode: string): Promise<void> {
  // Upsert CourseFloor row
  await prisma.courseFloor.upsert({
    where: { courseCode },
    create: {
      courseCode,
      assumesCompleted: ['SSCE Mathematics', 'MTH 101'],
      floorPolicy: 'JIT_REFRESH',
      assumedKCIds: ['SSCE.algebra.diff_squares', 'SSCE.algebra.polynomial_mult']
    },
    update: {}
  });

  // Seed default ScenarioPool for course
  await prisma.scenarioPool.upsert({
    where: { courseCode_slotKind: { courseCode, slotKind: 'scenario' } },
    create: {
      courseCode,
      slotKind: 'scenario',
      values: ['numeric_only', 'symbolic_expression']
    },
    update: {}
  });

  // Find all leaf nodes for this course outline
  const outline = await prisma.generatedTextbookOutline.findFirst({
    where: { course_code: courseCode, is_current: true },
    include: { nodes: { where: { children: { none: {} } } } }
  });

  if (!outline || outline.nodes.length === 0) {
    console.warn(`[build-course-floor] No outline nodes found for course ${courseCode}`);
    return;
  }

  // Fan-out Phase 1 in parallel across all leaf topics
  for (const node of outline.nodes) {
    await systemQueue.add(JOB_NAMES.MODEL_TOPIC_PHASE_1, { nodeId: node.id, courseCode });
  }
}
