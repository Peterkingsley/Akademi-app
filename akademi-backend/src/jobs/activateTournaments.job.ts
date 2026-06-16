import { CompetitionsService } from '../modules/competitions/competitions.service';

const competitionsService = new CompetitionsService();

export async function activateTournamentsJob() {
  await competitionsService.activateDueTournaments();
}
