import fs from 'fs/promises';
import os from 'os';
import path from 'path';

jest.mock('../src/config/env', () => ({
  config: {
    elevenLabsApiKey: 'test-elevenlabs-key',
    elevenLabsModelId: 'eleven_flash_v2_5',
    teachingHost1VoiceId: 'host-1',
    teachingHost2VoiceId: 'host-2',
  },
}));

jest.mock('../src/shared/storage/r2.service', () => ({ uploadFile: jest.fn() }));

import {
  TeachingAudioRenderError,
  TeachingAudioRenderer,
  cleanupTemporaryAudioDirectory,
  pauseClassForTurn,
  pcmToWav,
  resolveTeachingAudioVoices,
  voiceForSpeaker,
} from '../src/modules/teaching-engine/teaching-audio.service';
import type { ProductionDialogueScript } from '../src/modules/teaching-engine/types';

const dialogue = (): ProductionDialogueScript => ({
  schema_version: '0.1', generation_metadata: { dialogue_prompt_version: 'test' },
  turns: [
    { turn_id: 'T1', speaker: 'HOST_1', intent: 'EXPLAIN', core_epistemic_payload: 'One.', concept_ids: [], invariant_ids: [], misconception_ids: [], evidence_ids: [], spoken_text: 'Exact first line.' },
    { turn_id: 'T2', speaker: 'HOST_2', intent: 'DEDUCE', core_epistemic_payload: 'Two.', concept_ids: [], invariant_ids: [], misconception_ids: [], evidence_ids: [], spoken_text: 'Exact second line.' },
  ],
});

function pcmResponse(bytes: Buffer, characterCost = '9') {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    headers: { get: (name: string) => name === 'character-cost' ? characterCost : null },
  } as unknown as Response;
}

describe('TeachingAudioRenderer', () => {
  const upload = jest.fn<Promise<string>, [string, Buffer, string]>(async (key: string) => `https://audio.example/${key}`);

  beforeEach(() => jest.clearAllMocks());

  it('maps each host to a distinct configured voice and rejects missing/duplicate voice configuration', () => {
    const voices = resolveTeachingAudioVoices({ host1VoiceId: 'voice-a', host2VoiceId: 'voice-b', modelId: 'model' });
    expect(voiceForSpeaker('HOST_1', voices)).toBe('voice-a');
    expect(voiceForSpeaker('HOST_2', voices)).toBe('voice-b');
    expect(() => resolveTeachingAudioVoices({ host1VoiceId: 'voice-a', host2VoiceId: '', modelId: 'model' })).toThrow('TEACHING_HOST1_VOICE_ID');
    expect(() => resolveTeachingAudioVoices({ host1VoiceId: 'voice-a', host2VoiceId: 'voice-a', modelId: 'model' })).toThrow('distinct');
  });

  it('assigns quick and reflective timing without touching teaching text', () => {
    expect(pauseClassForTurn({ ...dialogue().turns[1] })).toBe('QUICK_RESPONSE');
    expect(pauseClassForTurn({ ...dialogue().turns[0], intent: 'SYNTHESIZE' })).toBe('REFLECTIVE_PAUSE');
    expect(pauseClassForTurn({ ...dialogue().turns[0] })).toBe('NORMAL_HANDOFF');
  });

  it('renders ordered immutable turn segments, a timed manifest, then an assembled episode', async () => {
    const firstPcm = Buffer.alloc(882, 1);
    const secondPcm = Buffer.alloc(1_764, 2);
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(pcmResponse(firstPcm))
      .mockResolvedValueOnce(pcmResponse(secondPcm));
    const renderer = new TeachingAudioRenderer(upload, fetchMock as unknown as typeof fetch, { host1VoiceId: 'voice-a', host2VoiceId: 'voice-b', modelId: 'model' });
    const source = dialogue();
    const original = JSON.stringify(source);

    const result = await renderer.renderFinalDialogue('episode-1', source);

    expect(JSON.stringify(source)).toBe(original);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toBe('Exact first line.');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).text).toBe('Exact second line.');
    expect(result.manifest.turns.map((turn) => turn.turn_id)).toEqual(['T1', 'T2']);
    expect(result.manifest.turns.map((turn) => turn.voice_id)).toEqual(['voice-a', 'voice-b']);
    expect(result.manifest.turns[0].pause_class).toBe('NORMAL_HANDOFF');
    expect(result.manifest.turns[0].pause_after_ms).toBe(350);
    expect(result.manifest.turns[1].pause_after_ms).toBe(0);
    expect(upload.mock.calls.map(([key]) => key)).toEqual([
      'teaching-audio/episode-1/turns/T1.wav',
      'teaching-audio/episode-1/turns/T2.wav',
      'teaching-audio/episode-1/episode.wav',
      'teaching-audio/episode-1/manifest.json',
    ]);
    const assembled = upload.mock.calls[2][1] as Buffer;
    expect(assembled.subarray(44, 44 + firstPcm.length)).toEqual(firstPcm);
    expect(assembled.length).toBeGreaterThan(pcmToWav(Buffer.concat([firstPcm, secondPcm])).length);
  });

  it('retries only the failed turn and preserves earlier stored segments when retries are exhausted', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 503, headers: { get: () => null } });
    const renderer = new TeachingAudioRenderer(upload, fetchMock as unknown as typeof fetch, { host1VoiceId: 'voice-a', host2VoiceId: 'voice-b', modelId: 'model' });
    await expect(renderer.renderFinalDialogue('episode-fail', dialogue())).rejects.toMatchObject({ turnId: 'T1', attempts: 2 } as Partial<TeachingAudioRenderError>);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(upload).not.toHaveBeenCalled();
  });

  it('cleans only a declared temporary audio directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'akademi-audio-test-'));
    const child = path.join(root, 'segments');
    await fs.mkdir(child);
    await cleanupTemporaryAudioDirectory(root, child);
    await expect(fs.access(child)).rejects.toThrow();
    await expect(cleanupTemporaryAudioDirectory(root, path.dirname(root))).rejects.toThrow('Refusing to clean');
    await fs.rm(root, { recursive: true, force: true });
  });
});
