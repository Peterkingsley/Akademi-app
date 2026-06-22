// New types for Whiteboard Tutor

export interface ScriptBlock {
  id: string;
  text: string;
  durationMs: number;
  visualCueId?: string;
}

export interface VisualCue {
  id: string;
  timeStartMs: number;
  timeEndMs: number;
  visualType: 'title_board' | 'bullet_board' | 'flowchart' | 'timeline' | 'table' | 'hierarchy' | 'labeled_diagram' | 'graph';
  renderMode: 'native_svg' | 'mermaid' | 'image';
  payload: any;
}

export interface LessonSegment {
  segmentId: string;
  conceptTitle: string;
  scriptBlocks: ScriptBlock[];
  visualCues: VisualCue[];
  estimatedDurationMs: number;
}

export interface PlayableLesson {
  sessionId: string;
  lessonTitle: string;
  segments: LessonSegment[];
}

export interface VisualPlanRequest {
  script: string;
  conceptMetadata?: any;
  materialContext?: string;
}