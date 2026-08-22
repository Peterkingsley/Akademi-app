/*
 * Audio-only baseline: loads an already publishable TeachingEpisode and renders
 * its stored final dialogue verbatim. It intentionally imports no generator,
 * prompt, fidelity, or repair code.
 */
import dotenv from 'dotenv';
import type { ProductionDialogueScript } from '../modules/teaching-engine/types';

dotenv.config();

async function main() {
  const [{ default: prisma }, { teachingAudioRenderer }] = await Promise.all([
    import('../config/db'),
    import('../modules/teaching-engine/teaching-audio.service'),
  ]);
  const episodeId = process.env.TEACHING_AUDIO_EPISODE_ID?.trim();
  try {
    const episode = await prisma.teachingEpisode.findFirst({
      where: episodeId ? { id: episodeId, status: 'READY_FOR_TTS' } : { status: 'READY_FOR_TTS' },
      orderBy: { created_at: 'desc' },
      select: { id: true, dialogue: true },
    });
    if (!episode) throw new Error(episodeId ? 'No publishable TeachingEpisode exists for TEACHING_AUDIO_EPISODE_ID.' : 'No publishable TeachingEpisode is available for audio rendering.');
    const dialogue = episode.dialogue as unknown as ProductionDialogueScript;
    if (!Array.isArray(dialogue?.turns) || !dialogue.turns.length) throw new Error(`TeachingEpisode ${episode.id} has no stored final dialogue.`);

    const rendered = await teachingAudioRenderer.renderFinalDialogue(episode.id, dialogue);
    console.log('TEACHING_AUDIO_ONLY_RENDER_COMPLETE', JSON.stringify({
      episode_id: episode.id,
      synthesis_status: 'SUCCESS',
      segment_count: rendered.manifest.turns.length,
      audio_duration_ms: rendered.manifest.assembled_episode.duration_ms,
      retried_turns: rendered.manifest.turns.filter((turn) => turn.retry_count > 0).map((turn) => turn.turn_id),
      audio_reference: rendered.manifest.assembled_episode.url,
      manifest_reference: rendered.manifest_url,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`Teaching audio-only render stopped: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
