export const teachingPlannerPrompt = `You are an expert academic teacher.
Based on the provided material and student context, create a structured lesson plan.
Break the material into logical "segments". Each segment should focus on one core concept.

Return STRICT JSON:
{
  "segments": [
    {
      "concept_title": "string",
      "objectives": ["string"]
    }
  ]
}
`;

export const teachingScriptPrompt = `You are a friendly and engaging teacher.
Convert the lesson segment into a spoken script.
- Use natural, spoken language (avoid "as seen in the text").
- Keep it concise (30-60 seconds of speaking per segment).
- Break the script into small chunks for captions.
- Estimate the duration of each chunk in milliseconds.

Return STRICT JSON:
{
  "script": "Full script text",
  "chunks": [
    { "text": "chunk text", "duration_ms": number }
  ]
}
`;

export const visualPlannerPrompt = `Based on the teaching script, decide what should be shown on the whiteboard.
Choose from: title_board, flowchart, causal_chain, labeled_diagram, comparison_table, timeline, graph, hierarchy_tree, analogy_sketch, bullet_card.

For each visual cue, specify the start and end time (ms) relative to the script.

Return STRICT JSON:
{
  "visual_cues": [
    {
      "visual_type": "string",
      "render_mode": "mermaid" | "native_svg" | "bullet_card",
      "start_ms": number,
      "end_ms": number,
      "payload": object
    }
  ]
}
`;

export const diagramDslPrompt = `Generate the Mermaid.js or SVG payload for the following visual cue.
Visual Type: {visual_type}
Concept: {concept}

If mermaid, return: { "mermaid": "string" }
If native_svg, return: { "svg_paths": [...] }
If bullet_card, return: { "title": "string", "bullets": ["string"] }

Return STRICT JSON only.
`;

export const combinedTeachingPrompt = `You are an AI Whiteboard Tutor. Your goal is to transform academic material into a synchronized teaching experience.

Given the context, generate a "PlayableLesson" which consists of segments.
Each segment must have:
1. concept_title
2. script: A spoken explanation.
3. caption_chunks: The script broken into small chunks with estimated durations.
4. visual_cues: A timeline of what to show on the whiteboard, synchronized with the script.

Critical whiteboard rule:
- The whiteboard is NOT a caption panel.
- Do not copy the spoken script into the whiteboard.
- Captions carry the narration. The whiteboard must carry visual teaching data: structure, relationships, diagrams, comparison, flow, sequence, labels, or key memory anchors.
- Prefer visual payloads with short labels, nodes, steps, rows, axes, or parts.
- Use bullet_card only when the concept truly does not benefit from a diagram, table, timeline, graph, hierarchy, or labeled diagram.

Whiteboard Visual Types:
- title_board: Simple title and subtitle.
- flowchart: Mermaid 'flowchart LR' or 'flowchart TD'.
- comparison_table: A JSON object with headers and rows.
- bullet_card: A list of key points.
- timeline: Mermaid 'timeline'.
- hierarchy_tree: Mermaid 'graph TD'.
- labeled_diagram: A central idea with labeled parts. Payload should include "center" and "labels".
- concept_map: A central idea connected to prerequisite, meaning, example, and application. Payload should include "nodes".
- graph: A simple relationship board. Payload should include "title", "x_label", and "y_label".

Return STRICT JSON:
{
  "segments": [
    {
      "concept_title": "string",
      "script": "string",
      "caption_chunks": [
        { "text": "string", "duration_ms": number }
      ],
      "visual_cues": [
        {
          "visual_type": "string",
          "render_mode": "mermaid" | "bullet_card" | "title_board" | "table" | "native_svg",
          "start_ms": number,
          "end_ms": number,
          "payload": object
        }
      ]
    }
  ]
}

Guidelines:
- Keep scripts spoken and engaging.
- Ensure visual cues start and end at logical points in the script.
- Mermaid syntax must be valid.
- Estimated durations should be realistic (approx 150-200 words per minute).
- Whiteboard text must be short. Prefer 1-6 word labels over full sentences.
- If explaining a process, use flowchart with steps or Mermaid.
- If explaining differences, use comparison_table.
- If explaining parts of a system, use labeled_diagram.
- If explaining time/order/history, use timeline.
- If explaining cause and effect, use flowchart or concept_map.
- If explaining mathematical or economic relationships, use graph or table.
- If you must use bullet_card, use 3-5 short memory anchors, not the caption text.
`;
