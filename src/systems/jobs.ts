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

/**
 * What the boss says when the job's next missions only wait for its Shop upgrade (playtest
 * 2026-11-12: the fire chief asked for a police bike, so buying the ladder never felt like the
 * objective).
 */
export const NEED_UPGRADE_LINE: Record<JobId, string> = {
  cop: 'chief-need-bike',
  fire: 'chief-need-ladder',
  builder: 'chief-need-drum',
};

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

/** Shop hats (spec 006) → the hat drawn on the character. */
export const HATS: Record<string, 'chef' | 'pirate' | 'duck'> = {
  'hat-chef': 'chef',
  'hat-pirate': 'pirate',
  'hat-duck': 'duck',
};

/**
 * The look to draw: the job's outfit, with a worn Shop hat on top (a composite look name such as
 * `playerFire+pirate`, baked on demand).
 */
export function lookFor(job: JobId, owned: readonly string[], hat: string | null): string {
  const base = outfitFor(job, owned);
  const h = hat ? HATS[hat] : undefined;
  return h ? `${base}+${h}` : base;
}

/** The outfit to draw: the job's uniform, but the Cop's plain clothes until First Day's cap. */
export function outfitFor(job: JobId, owned: readonly string[]): string {
  if (job === 'cop') return owned.includes('cap-cop') ? 'player' : 'playerPlain';
  return JOBS[job].outfit;
}
