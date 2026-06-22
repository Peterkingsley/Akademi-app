import sys

file_path = './akademi-backend/src/modules/ai/ai.service.ts'
with open(file_path, 'r') as f:
    content = f.read()

search_text = """    const parsedLesson = JSON.parse(this.extractJsonObject(response));

    for (const segmentData of parsedLesson.segments) {
      const segment = await prisma.lessonSegment.create({
        data: {
          session_id: sessionId,
          concept_title: segmentData.concept_title,
          script: segmentData.script,
          order: parsedLesson.segments.indexOf(segmentData),
          estimated_duration_ms: segmentData.caption_chunks.reduce((acc: number, c: any) => acc + (c.duration_ms || 0), 0),
        },
      });

      for (const cueData of segmentData.visual_cues) {
        await prisma.visualCue.create({
          data: {
            segment_id: segment.id,
            visual_type: cueData.visual_type,
            render_mode: cueData.render_mode,
            start_ms: cueData.start_ms,
            end_ms: cueData.end_ms,
            payload: cueData.payload,
          },
        });
      }
    }

    return parsedLesson;"""

replace_text = """    const parsedLesson = JSON.parse(this.extractJsonObject(response));
    const segments = Array.isArray(parsedLesson?.segments) ? parsedLesson.segments : [];

    if (segments.length === 0) {
      throw new Error('AI failed to generate a structured lesson. Please try again.');
    }

    const createdSegments = [];

    for (const [index, segmentData] of segments.entries()) {
      const captionChunks = Array.isArray(segmentData?.caption_chunks) ? segmentData.caption_chunks : [];
      const visualCues = Array.isArray(segmentData?.visual_cues) ? segmentData.visual_cues : [];

      const segment = await prisma.lessonSegment.create({
        data: {
          session_id: sessionId,
          concept_title: String(segmentData?.concept_title || 'Untitled Concept'),
          script: String(segmentData?.script || ''),
          order: index,
          estimated_duration_ms: captionChunks.reduce((acc: number, c: any) => acc + (Number(c?.duration_ms) || 0), 0),
        },
      });

      const createdCues = [];
      for (const cueData of visualCues) {
        const cue = await prisma.visualCue.create({
          data: {
            segment_id: segment.id,
            visual_type: String(cueData?.visual_type || 'title_board'),
            render_mode: String(cueData?.render_mode || 'bullet_card'),
            start_ms: Number(cueData?.start_ms) || 0,
            end_ms: Number(cueData?.end_ms) || 10000,
            payload: (cueData?.payload || {}) as Prisma.InputJsonValue,
          },
        });
        createdCues.push(cue);
      }

      createdSegments.push({
        ...segment,
        visual_cues: createdCues,
      });
    }

    return createdSegments;"""

if search_text in content:
    new_content = content.replace(search_text, replace_text)
    with open(file_path, 'w') as f:
        f.write(new_content)
    print("Successfully edited ai.service.ts")
else:
    print("Could not find search text in ai.service.ts")
    sys.exit(1)
