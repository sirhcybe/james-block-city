import type { JobId } from './missions';

/** Everything that differs per job (GDD §2). */
export interface JobInfo {
  id: JobId;
  /** Townsperson / map marker of the boss who offers missions. */
  boss: string;
  /** The job's vehicle (its parking marker has the same id). */
  vehicle: 'police-car' | 'fire-truck' | 'mixer-truck';
  /** What the Action button does with a target in reach. */
  tool: 'net' | 'hose' | 'blaster';
  /** Player look (character id) when wearing this uniform. */
  outfit: string;
  /** The thing the boss gives you on the first Rookie mission. */
  gift: string;
  /** Mission board marker for this job. */
  board: string;
}

export const JOBS: Record<JobId, JobInfo> = {
  cop: {
    id: 'cop',
    boss: 'chief',
    vehicle: 'police-car',
    tool: 'net',
    outfit: 'player',
    gift: 'cap-cop',
    board: 'mission-board',
  },
  fire: {
    id: 'fire',
    boss: 'fire-chief',
    vehicle: 'fire-truck',
    tool: 'hose',
    outfit: 'playerFire',
    gift: 'helmet-fire',
    board: 'fire-board',
  },
  builder: {
    id: 'builder',
    boss: 'foreman',
    vehicle: 'mixer-truck',
    tool: 'blaster',
    outfit: 'playerBuilder',
    gift: 'hardhat-builder',
    board: 'builder-board',
  },
};

export const JOB_ORDER: JobId[] = ['cop', 'fire', 'builder'];

/** A job can be picked once it has missions in the content (later specs add them). */
export function jobAvailable(job: JobId, missions: readonly { job: string }[]): boolean {
  return missions.some((m) => m.job === job);
}

/** The Job Center opens after the first badge (GDD "Picking and switching jobs" #3). */
export function canSwitch(badges: readonly string[]): boolean {
  return badges.length > 0;
}

/** What the uniform card for a job shows right now. */
export function uniformState(
  job: JobId,
  current: JobId,
  badges: readonly string[],
  missions: readonly { job: string }[],
): 'current' | 'open' | 'locked' {
  if (job === current) return 'current';
  if (!jobAvailable(job, missions) || !canSwitch(badges)) return 'locked';
  return 'open';
}

/** The outfit to draw: the job's uniform, but the Cop's plain clothes until First Day's cap. */
export function outfitFor(job: JobId, owned: readonly string[]): string {
  if (job === 'cop') return owned.includes('cap-cop') ? 'player' : 'playerPlain';
  return JOBS[job].outfit;
}
