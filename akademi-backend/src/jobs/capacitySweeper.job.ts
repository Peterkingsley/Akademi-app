import cron from 'node-cron';
import prisma from '../config/db';
import { systemQueue, JOB_NAMES } from '../config/queue';
import { forceRegenerateTextbookOutline } from '../modules/textbooks/textbook-trigger';

export function startCapacitySweeper() {
  // Run every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    try {
      console.log('[capacity-sweeper] Running sweeper...');

      // 1. Re-enqueue AWAITING_CAPACITY nodes (existing logic)
      const nodes = await prisma.generatedTextbookOutlineNode.findMany({
        where: { status: 'AWAITING_CAPACITY' },
        include: {
          outline: { select: { course_code: true, university_id: true } },
          section: { select: { id: true, content: true, needs_diagram: true, diagram_image_url: true } }
        }
      });

      if (nodes.length > 0) {
        console.log(`[capacity-sweeper] Found ${nodes.length} nodes awaiting capacity`);
        for (const node of nodes) {
          if (node.title === 'Curriculum Decomposition Pending') {
            await prisma.generatedTextbookOutline.delete({ where: { id: node.outline_id } });
            await forceRegenerateTextbookOutline(node.outline.course_code, node.outline.university_id);
            console.log(`[capacity-sweeper] Re-enqueued decomposition for ${node.outline.course_code}`);
          } else if (!node.section?.content) {
            await prisma.generatedTextbookOutlineNode.update({ where: { id: node.id }, data: { status: 'PENDING' } });
            systemQueue.add(JOB_NAMES.GENERATE_TEXTBOOK_SECTION, { nodeId: node.id }).catch((error: unknown) => {
              console.error('[capacity-sweeper] failed to re-enqueue section generation', { nodeId: node.id, error });
            });
            console.log(`[capacity-sweeper] Re-enqueued section generation for node ${node.id}`);
          } else {
            await prisma.generatedTextbookOutlineNode.update({ where: { id: node.id }, data: { status: 'GENERATED' } });
            
            if (node.section!.needs_diagram && !node.section!.diagram_image_url) {
              systemQueue.add(JOB_NAMES.FETCH_TEXTBOOK_DIAGRAM, { sectionId: node.section!.id }).catch((error: unknown) => {
                console.error('[capacity-sweeper] failed to re-enqueue diagram fetch', { sectionId: node.section!.id, error });
              });
            }

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
      }

      // 2. Queue processing
      // Check for any ACTIVE queue entries and see if they are done
      const activeEntries = await prisma.textbookGenerationQueueEntry.findMany({
        where: { status: 'ACTIVE' }
      });

      for (const entry of activeEntries) {
        // Check if there's an outline that is current (published)
        const currentOutline = await prisma.generatedTextbookOutline.findFirst({
          where: {
            course_code: entry.course_code,
            university_id: entry.university_id,
            is_current: true
          }
        });

        if (currentOutline) {
           await prisma.textbookGenerationQueueEntry.update({
             where: { id: entry.id },
             data: { status: 'DONE' }
           });
           continue;
        }

        // Also check if an active outline exists but has NO active nodes (fully stalled or audit failed)
        // Active nodes = PENDING, GENERATING, AWAITING_CAPACITY
        const activeNodesCount = await prisma.generatedTextbookOutlineNode.count({
          where: {
            outline: {
              course_code: entry.course_code,
              university_id: entry.university_id,
              is_current: false
            },
            status: { in: ['PENDING', 'GENERATING', 'AWAITING_CAPACITY'] }
          }
        });

        // If an outline was created but has 0 active nodes, and it's not published, it's completely stalled (e.g. all failed).
        // Let's also check if the outline actually exists so we don't clear it right after it's queued but before DECOMPOSE creates the outline.
        const unpublishedOutline = await prisma.generatedTextbookOutline.findFirst({
          where: {
            course_code: entry.course_code,
            university_id: entry.university_id,
            is_current: false
          }
        });

        if (unpublishedOutline && activeNodesCount === 0) {
           await prisma.textbookGenerationQueueEntry.update({
             where: { id: entry.id },
             data: { status: 'DONE' }
           });
           console.log(`[capacity-sweeper] Marked ACTIVE entry DONE due to fully stalled outline: ${entry.course_code}`);
        }
      }

      // Re-fetch active entries
      const stillActive = await prisma.textbookGenerationQueueEntry.count({
        where: { status: 'ACTIVE' }
      });

      // Check if anything is truly "in flight" by looking for an outline with `is_current: false` that has any active nodes.
      // Or simply, if there's any active entry, we consider it in-flight and wait.
      if (stillActive > 0) {
         console.log(`[capacity-sweeper] Halting queue processing: ${stillActive} generations currently in flight.`);
         return;
      }

      // If nothing is in flight, start the next one
      const nextEntry = await prisma.textbookGenerationQueueEntry.findFirst({
        where: { status: 'QUEUED' },
        orderBy: { requested_at: 'asc' }
      });

      if (nextEntry) {
        await prisma.textbookGenerationQueueEntry.update({
          where: { id: nextEntry.id },
          data: { status: 'ACTIVE', started_at: new Date() }
        });
        systemQueue.add(JOB_NAMES.DECOMPOSE_CURRICULUM, { 
          courseCode: nextEntry.course_code, 
          universityId: nextEntry.university_id || undefined 
        }).catch((error: unknown) => {
          console.error('[capacity-sweeper] failed to start queued decomposition', error);
        });
        console.log(`[capacity-sweeper] Started decomposition for queued course ${nextEntry.course_code}`);
      }

    } catch (error) {
      console.error('[capacity-sweeper] Unexpected failure:', error);
    }
  });
}
