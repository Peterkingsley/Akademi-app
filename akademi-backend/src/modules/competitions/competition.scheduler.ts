import { JOB_NAMES, systemQueue } from '../../config/queue';
import { config } from '../../config/env';

let activationTimer: NodeJS.Timeout | null = null;
let activationInFlight = false;

export function startCompetitionScheduler() {
  if (activationTimer || config.nodeEnv === 'test') return;

  const run = async () => {
    if (activationInFlight) return;
    activationInFlight = true;
    try {
      await systemQueue.add(JOB_NAMES.ACTIVATE_TOURNAMENTS, {});
    } catch (error) {
      console.error('Tournament activation cycle failed:', error);
    } finally {
      activationInFlight = false;
    }
  };

  run().catch(console.error);
  activationTimer = setInterval(() => {
    run().catch(console.error);
  }, Math.max(config.tournamentActivationIntervalMs, 5000));
}

export function stopCompetitionScheduler() {
  if (activationTimer) {
    clearInterval(activationTimer);
    activationTimer = null;
  }
}
