import fs from 'fs/promises';
import path from 'path';

import { config } from '../../config/env';
import { uploadFile } from '../../shared/storage/r2.service';
import type { BlueprintTurn, Host, ProductionDialogueScript } from './types';

export type PauseClass = 'NORMAL_HANDOFF' | 'QUICK_RESPONSE' | 'REFLECTIVE_PAUSE' | 'INTERRUPTION';

export interface TeachingAudioVoiceConfig {
  host1VoiceId: string;
  host2VoiceId: string;
  modelId: string;
}

export interface TeachingAudioManifestTurn {
  turn_id: string;
  speaker: Host;
  voice_id: string;
  intent: BlueprintTurn['intent'];
  segment_key: string;
  segment_url: string;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  pause_class: PauseClass;
  pause_after_ms: number;
  synthesis_latency_ms: number;
  retry_count: number;
  provider_character_cost?: number;
}

export interface TeachingAudioManifest {
  version: '1.0';
  episode_id: string;
  provider: 'elevenlabs';
  format: 'audio/wav; codec=pcm_s16le; rate=44100; channels=1';
  created_at: string;
  voices: Pick<TeachingAudioVoiceConfig, 'host1VoiceId' | 'host2VoiceId' | 'modelId'>;
  turns: TeachingAudioManifestTurn[];
  assembled_episode: { key: string; url: string; duration_ms: number; assembly_latency_ms: number };
  metrics: {
    total_tts_latency_ms: number;
    average_handoff_gap_ms: number;
    quick_response_count: number;
    reflective_pause_count: number;
    interruption_count: number;
    provider_character_cost?: number;
  };
}

export interface TeachingAudioRenderResult {
  manifest: TeachingAudioManifest;
  manifest_key: string;
  manifest_url: string;
}

export class TeachingAudioRenderError extends Error {
  constructor(message: string, public readonly turnId?: string, public readonly attempts?: number) {
    super(message);
  }
}

const SAMPLE_RATE = 44_100;
const CHANNELS = 1;
const BYTES_PER_SAMPLE = 2;
const PCM_BYTES_PER_SECOND = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;
const WAV_CONTENT_TYPE = 'audio/wav';
const MAX_TURN_ATTEMPTS = 2;

const PAUSES: Record<PauseClass, number> = {
  NORMAL_HANDOFF: 350,
  QUICK_RESPONSE: 170,
  REFLECTIVE_PAUSE: 650,
  INTERRUPTION: 60,
};

export function resolveTeachingAudioVoices(input: Partial<TeachingAudioVoiceConfig> = {}): TeachingAudioVoiceConfig {
  const host1VoiceId = (input.host1VoiceId ?? config.teachingHost1VoiceId).trim();
  const host2VoiceId = (input.host2VoiceId ?? config.teachingHost2VoiceId).trim();
  const modelId = (input.modelId ?? config.elevenLabsModelId).trim();
  if (!config.elevenLabsApiKey) throw new TeachingAudioRenderError('ELEVENLABS_API_KEY is required for Teaching Audio Baseline V1.');
  if (!host1VoiceId || !host2VoiceId) throw new TeachingAudioRenderError('TEACHING_HOST1_VOICE_ID and TEACHING_HOST2_VOICE_ID must both be configured.');
  if (host1VoiceId === host2VoiceId) throw new TeachingAudioRenderError('Teaching host voices must be distinct.');
  if (!modelId) throw new TeachingAudioRenderError('ELEVENLABS_MODEL_ID is required for Teaching Audio Baseline V1.');
  return { host1VoiceId, host2VoiceId, modelId };
}

export function voiceForSpeaker(speaker: Host, voices: TeachingAudioVoiceConfig) {
  return speaker === 'HOST_1' ? voices.host1VoiceId : voices.host2VoiceId;
}

export function pauseClassForTurn(turn: BlueprintTurn): PauseClass {
  if (turn.intent === 'CHECK_UNDERSTANDING' || turn.intent === 'DEDUCE') return 'QUICK_RESPONSE';
  if (turn.intent === 'SYNTHESIZE' || turn.intent === 'CLOSE_LOOP' || turn.intent === 'CHALLENGE') return 'REFLECTIVE_PAUSE';
  return 'NORMAL_HANDOFF';
}

export function pcmDurationMs(pcm: Buffer) {
  return Math.round((pcm.length / PCM_BYTES_PER_SECOND) * 1000);
}

export function pcmToWav(pcm: Buffer) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(PCM_BYTES_PER_SECOND, 28);
  header.writeUInt16LE(CHANNELS * BYTES_PER_SAMPLE, 32);
  header.writeUInt16LE(BYTES_PER_SAMPLE * 8, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function cleanupTemporaryAudioDirectory(root: string, temporaryDirectory: string) {
  const resolvedRoot = path.resolve(root);
  const resolvedDirectory = path.resolve(temporaryDirectory);
  if (!resolvedDirectory.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new TeachingAudioRenderError('Refusing to clean an audio directory outside its declared temporary root.');
  }
  await fs.rm(resolvedDirectory, { recursive: true, force: true });
}

type SynthesisResult = { pcm: Buffer; latencyMs: number; retryCount: number; characterCost?: number };

export class TeachingAudioRenderer {
  constructor(
    private readonly upload: typeof uploadFile = uploadFile,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly voiceConfig?: Partial<TeachingAudioVoiceConfig>,
  ) {}

  private async synthesizeTurn(turnId: string, text: string, voiceId: string, modelId: string): Promise<SynthesisResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_TURN_ATTEMPTS; attempt += 1) {
      const startedAt = Date.now();
      try {
        const response = await this.fetchImpl(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=pcm_44100`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'xi-api-key': config.elevenLabsApiKey, Accept: 'audio/pcm' },
            body: JSON.stringify({ text, model_id: modelId, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true } }),
          },
        );
        if (!response.ok) throw new Error(`ElevenLabs returned HTTP ${response.status}.`);
        const pcm = Buffer.from(await response.arrayBuffer());
        if (!pcm.length) throw new Error('ElevenLabs returned an empty audio segment.');
        const rawCost = response.headers.get('character-cost');
        const characterCost = rawCost && /^\d+$/.test(rawCost) ? Number(rawCost) : undefined;
        return { pcm, latencyMs: Date.now() - startedAt, retryCount: attempt, characterCost };
      } catch (error) {
        lastError = error;
      }
    }
    throw new TeachingAudioRenderError(`Turn synthesis failed after ${MAX_TURN_ATTEMPTS} attempts: ${lastError instanceof Error ? lastError.message : 'unknown error'}`, turnId, MAX_TURN_ATTEMPTS);
  }

  async renderFinalDialogue(episodeId: string, dialogue: ProductionDialogueScript): Promise<TeachingAudioRenderResult> {
    if (!episodeId.trim()) throw new TeachingAudioRenderError('An episode ID is required for audio rendering.');
    if (!dialogue.turns.length) throw new TeachingAudioRenderError('Cannot render an empty teaching dialogue.');
    const voices = resolveTeachingAudioVoices(this.voiceConfig);
    const rootKey = `teaching-audio/${episodeId}`;
    const startedAt = Date.now();
    const manifestTurns: TeachingAudioManifestTurn[] = [];
    const assembledPcm: Buffer[] = [];
    let cursorMs = 0;
    let totalTtsLatencyMs = 0;
    let providerCharacterCost = 0;
    let hasProviderCost = false;

    for (const [index, turn] of dialogue.turns.entries()) {
      // spoken_text is passed untouched: TTS is a renderer, never a dialogue editor.
      if (!turn.spoken_text.trim()) throw new TeachingAudioRenderError('Cannot synthesize an empty dialogue turn.', turn.turn_id);
      const voiceId = voiceForSpeaker(turn.speaker, voices);
      const synthesis = await this.synthesizeTurn(turn.turn_id, turn.spoken_text, voiceId, voices.modelId);
      const durationMs = pcmDurationMs(synthesis.pcm);
      const pauseClass = pauseClassForTurn(turn);
      const pauseAfterMs = index === dialogue.turns.length - 1 ? 0 : PAUSES[pauseClass];
      const segmentKey = `${rootKey}/turns/${turn.turn_id}.wav`;
      const segmentUrl = await this.upload(segmentKey, pcmToWav(synthesis.pcm), WAV_CONTENT_TYPE);
      manifestTurns.push({
        turn_id: turn.turn_id, speaker: turn.speaker, voice_id: voiceId, intent: turn.intent,
        segment_key: segmentKey, segment_url: segmentUrl, start_ms: cursorMs, end_ms: cursorMs + durationMs,
        duration_ms: durationMs, pause_class: pauseClass, pause_after_ms: pauseAfterMs,
        synthesis_latency_ms: synthesis.latencyMs, retry_count: synthesis.retryCount, provider_character_cost: synthesis.characterCost,
      });
      assembledPcm.push(synthesis.pcm);
      if (pauseAfterMs) assembledPcm.push(Buffer.alloc(Math.round((pauseAfterMs / 1000) * PCM_BYTES_PER_SECOND)));
      cursorMs += durationMs + pauseAfterMs;
      totalTtsLatencyMs += synthesis.latencyMs;
      if (synthesis.characterCost !== undefined) {
        providerCharacterCost += synthesis.characterCost;
        hasProviderCost = true;
      }
    }

    const assemblyStartedAt = Date.now();
    const assembledKey = `${rootKey}/episode.wav`;
    const assembledUrl = await this.upload(assembledKey, pcmToWav(Buffer.concat(assembledPcm)), WAV_CONTENT_TYPE);
    const assemblyLatencyMs = Date.now() - assemblyStartedAt;
    const gaps = manifestTurns.slice(0, -1).map((turn) => turn.pause_after_ms);
    const manifest: TeachingAudioManifest = {
      version: '1.0', episode_id: episodeId, provider: 'elevenlabs',
      format: 'audio/wav; codec=pcm_s16le; rate=44100; channels=1', created_at: new Date().toISOString(), voices,
      turns: manifestTurns,
      assembled_episode: { key: assembledKey, url: assembledUrl, duration_ms: cursorMs, assembly_latency_ms: assemblyLatencyMs },
      metrics: {
        total_tts_latency_ms: totalTtsLatencyMs,
        average_handoff_gap_ms: gaps.length ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) : 0,
        quick_response_count: manifestTurns.filter((turn) => turn.pause_class === 'QUICK_RESPONSE').length,
        reflective_pause_count: manifestTurns.filter((turn) => turn.pause_class === 'REFLECTIVE_PAUSE').length,
        interruption_count: manifestTurns.filter((turn) => turn.pause_class === 'INTERRUPTION').length,
        ...(hasProviderCost ? { provider_character_cost: providerCharacterCost } : {}),
      },
    };
    const manifestKey = `${rootKey}/manifest.json`;
    const manifestUrl = await this.upload(manifestKey, Buffer.from(JSON.stringify(manifest, null, 2)), 'application/json');
    console.info('teaching_audio.rendered', { episode_id: episodeId, turn_count: manifestTurns.length, total_duration_ms: cursorMs, total_tts_latency_ms: totalTtsLatencyMs, assembly_latency_ms: assemblyLatencyMs, elapsed_ms: Date.now() - startedAt });
    return { manifest, manifest_key: manifestKey, manifest_url: manifestUrl };
  }
}

export const teachingAudioRenderer = new TeachingAudioRenderer();
