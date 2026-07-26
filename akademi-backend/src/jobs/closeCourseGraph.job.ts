import prisma from '../config/db';
import { systemQueue, JOB_NAMES } from '../config/queue';

export async function closeCourseGraphJob(courseCode: string, generation: number = 1): Promise<void> {
  if (generation > 3) {
    console.error(`[close-course-graph] Exceeded max relocation generations (${generation}) for ${courseCode}; escalating to admin review.`);
    return;
  }

  const outline = await prisma.generatedTextbookOutline.findFirst({
    where: { course_code: courseCode, is_current: true },
    include: {
      nodes: {
        where: { children: { none: {} } },
        orderBy: { order_index: 'asc' }
      }
    }
  });

  if (!outline) return;

  const floor = await prisma.courseFloor.findUnique({ where: { courseCode } });
  const priorKCs = new Map<string, string>();
  (floor?.assumedKCIds || []).forEach(id => priorKCs.set(id, 'FLOOR_SENTINEL'));

  let anyRelocationCreated = false;

  for (const topic of outline.nodes) {
    const model = await prisma.knowledgeModel.findUnique({
      where: { topicId: topic.id },
      include: { kcs: { include: { dependsOn: true } } }
    });

    if (!model) continue;

    const unresolvedGaps = model.kcs
      .flatMap(kc => kc.dependsOn)
      .filter(d => d.resolution === 'UNRESOLVED');

    for (const gap of unresolvedGaps) {
      if (priorKCs.has(gap.dependentId)) {
        await prisma.kCDependency.update({
          where: { id: gap.id },
          data: { resolution: 'JIT_REFRESH' }
        });
      } else {
        await prisma.relocationRequest.create({
          data: {
            courseCode,
            kcPublicId: gap.dependentId,
            fromTopicId: topic.id,
            toTopicId: 'earlier_topic_id',
            reason: 'Gap resolution relocation'
          }
        });
        anyRelocationCreated = true;
      }
    }

    model.kcs.forEach(kc => priorKCs.set(kc.publicId, kc.id));
  }

  // Handle Relocation Settling
  const unappliedRelocations = await prisma.relocationRequest.count({
    where: { courseCode, applied: false }
  });

  if (unappliedRelocations > 0 && anyRelocationCreated) {
    await prisma.relocationRequest.updateMany({
      where: { courseCode, applied: false },
      data: { applied: true }
    });
    // Re-run closeCourseGraph for next generation
    return closeCourseGraphJob(courseCode, generation + 1);
  }

  // Barrier completion -> Fan-out Phase 3 for all leaf topics
  for (const node of outline.nodes) {
    await systemQueue.add(JOB_NAMES.MODEL_TOPIC_PHASE_3, { nodeId: node.id, courseCode });
  }
}
