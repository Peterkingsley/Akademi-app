import cron from 'node-cron';
import prisma from '../config/db';
import { systemQueue, JOB_NAMES } from '../config/queue';
import { forceRegenerateTextbookOutline } from '../modules/textbooks/textbook-trigger';

export function startCapacitySweeper() {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      console.log('[capacity-sweeper] Running sweeper for AWAITING_CAPACITY nodes...');

      const nodes = await prisma.generatedTextbookOutlineNode.findMany({
        where: { status: 'AWAITING_CAPACITY' },
        include: {
          outline: { select: { course_code: true, university_id: true } },
          section: { select: { id: true, content: true, needs_diagram: true, diagram_image_url: true } }
        }
      });

      if (nodes.length === 0) return;
      console.log(`[capacity-sweeper] Found ${nodes.length} nodes awaiting capacity`);

      for (const node of nodes) {
        if (node.title === 'Curriculum Decomposition Pending') {
          // 1. Failed during decomposeCurriculum
          await prisma.generatedTextbookOutline.delete({ where: { id: node.outline_id } });
          await forceRegenerateTextbookOutline(node.outline.course_code, node.outline.university_id);
          console.log(`[capacity-sweeper] Re-enqueued decomposition for ${node.outline.course_code}`);
        } else if (!node.section?.content) {
          // 2. Failed during generateTextbookSection
          await prisma.generatedTextbookOutlineNode.update({ where: { id: node.id }, data: { status: 'PENDING' } });
          systemQueue.add(JOB_NAMES.GENERATE_TEXTBOOK_SECTION, { nodeId: node.id }).catch((error: unknown) => {
            console.error('[capacity-sweeper] failed to re-enqueue section generation', { nodeId: node.id, error });
          });
          console.log(`[capacity-sweeper] Re-enqueued section generation for node ${node.id}`);
        } else {
          // 3. Failed during diagram fetch, quality check, or embedding
          await prisma.generatedTextbookOutlineNode.update({ where: { id: node.id }, data: { status: 'GENERATED' } });
          
          if (node.section.needs_diagram && !node.section.diagram_image_url) {
            systemQueue.add(JOB_NAMES.FETCH_TEXTBOOK_DIAGRAM, { sectionId: node.section.id }).catch((error: unknown) => {
              console.error('[capacity-sweeper] failed to re-enqueue diagram fetch', { sectionId: node.section.id, error });
            });
          }

          // Check if this unblocked the whole outline for audit
          const outstandingLeaf = await prisma.generatedTextbookOutlineNode.findFirst({
            where: {
              outline_id: node.outline_id,
              children: { none: {} },
              status: { notIn: ['GENERATED', 'ADMIN_QUEUED'] },
            },
            select: { id: true },
          });

          if (!outstandingLeaf) {
            systemQueue.add(JOB_NAMES.AUDIT_TEXTBOOK_OUTLINE, { outlineId: node.outline_id }).catch((error: unknown) => {
              console.error('[capacity-sweeper] failed to enqueue outline audit', { outlineId: node.outline_id, error });
            });
            console.log(`[capacity-sweeper] Re-enqueued audit for outline ${node.outline_id}`);
          }
        }
      }
    } catch (error) {
      console.error('[capacity-sweeper] Unexpected failure:', error);
    }
  });
}
