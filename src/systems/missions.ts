import { z } from 'zod';

const JobId = z.enum(['cop', 'fire', 'builder']);
export type JobId = z.infer<typeof JobId>;

/** One robber in a catch goal: who, in what, and where he starts (a map marker). */
export const RobberSpec = z.object({
  id: z.string(),
  vehicle: z.enum(['car', 'scooter', 'heli']).default('car'),
  start: z.string(),
  /** Loot he drops while fleeing (becomes a Return errand), if any. */
  drops: z.string().optional(),
});
export type RobberSpec = z.infer<typeof RobberSpec>;

/** Spec 002 wrote `{ robber: 'pickles' }`; it still loads as one robber in the getaway car. */
const legacyCatch = (raw: unknown) => {
  if (raw && typeof raw === 'object' && 'robber' in raw && !('robbers' in raw)) {
    const { robber, ...rest } = raw as { robber: string };
    return { ...rest, robbers: [{ id: robber, start: 'getaway-start', drops: 'donut' }] };
  }
  return raw;
};

export const Goal = z.discriminatedUnion('type', [
  z.object({ type: z.literal('goTo'), target: z.string() }),
  z.object({
    type: z.literal('catch'),
    robbers: z.array(RobberSpec).min(1),
    bumps: z.number().int().positive().default(3),
  }),
  z.object({ type: z.literal('checkpoints'), flags: z.array(z.string()).min(1) }),
  z.object({ type: z.literal('siren') }),
  z.object({ type: z.literal('escort'), group: z.string(), from: z.string(), to: z.string() }),
  z.object({ type: z.literal('find'), item: z.string(), spots: z.array(z.string()).min(1) }),
  z.object({ type: z.literal('minigame'), id: z.string() }),
  z.object({ type: z.literal('errand'), id: z.string() }),
  z.object({ type: z.literal('build'), spot: z.string() }),
  z.object({ type: z.literal('spray'), fires: z.array(z.string()).min(1) }),
  /** Park the vehicle at `at`; the ladder goes up to the pet at `perch`; it slides down. */
  z.object({ type: z.literal('rescue'), pet: z.string(), at: z.string(), perch: z.string() }),
  /** Walk in through a door (`at`) and do what needs doing inside (a separate room scene). */
  z.object({ type: z.literal('inside'), at: z.string(), room: z.string() }),
]);
export type Goal = z.infer<typeof Goal>;
const GoalIn = z.preprocess(legacyCatch, Goal);

/** Bonus star rules (each satisfied rule adds a star; finishing is always worth 1). */
export const StarBonus = z.discriminatedUnion('type', [
  z.object({ type: z.literal('collect'), item: z.string(), count: z.number().int().positive() }),
  z.object({
    type: z.literal('fastGoal'),
    goal: z.number().int().nonnegative(),
    seconds: z.number(),
  }),
]);
export type StarBonus = z.infer<typeof StarBonus>;

export const Mission = z.object({
  id: z.string(),
  job: JobId,
  tier: z.enum(['rookie', 'pro', 'finale']),
  /** Picture for the chief's bubble and the mission board card. */
  icon: z.string().default('star'),
  voiceIntro: z.string(),
  /** Voice line when the mission is done. */
  voiceDone: z.string().default('mission-done'),
  goals: z.array(GoalIn).min(1),
  reward: z.object({ coins: z.number().int().positive(), unlocks: z.array(z.string()).optional() }),
  /** Mission ids, `badge:<job>` or `owned:<item>`; all must hold before it is offered. */
  requires: z.array(z.string()).optional(),
  bonus: z.array(StarBonus).max(2).default([]),
});
export type Mission = z.infer<typeof Mission>;

export const MissionList = z.array(Mission).superRefine((list, ctx) => {
  const ids = new Set(list.map((m) => m.id));
  for (const m of list) {
    for (const r of m.requires ?? []) {
      if (r.startsWith('badge:') || r.startsWith('owned:')) continue;
      if (!ids.has(r)) ctx.addIssue({ code: 'custom', message: `${m.id} requires unknown ${r}` });
    }
  }
});

/** What the save knows that `requires` can check. */
export interface Progress {
  badges: readonly string[];
  owned: readonly string[];
  missionsDone: Readonly<Record<string, number>>;
}

/** Whether one `requires` entry holds. */
export function requirementMet(req: string, p: Progress): boolean {
  if (req === 'badge:any') return p.badges.length > 0;
  if (req.startsWith('badge:')) return p.badges.includes(req.slice(6));
  if (req.startsWith('owned:')) return p.owned.includes(req.slice(6));
  return (p.missionsDone[req] ?? 0) > 0;
}

export function isUnlocked(m: Mission, p: Progress): boolean {
  return (m.requires ?? []).every((r) => requirementMet(r, p));
}

/** The mission the job's boss offers next: the first unlocked one not done yet (content order). */
export function nextMission(list: readonly Mission[], job: JobId, p: Progress): Mission | null {
  return (
    list.find(
      (m) =>
        m.job === job &&
        m.tier !== 'finale' &&
        !((p.missionsDone[m.id] ?? 0) > 0) &&
        isUnlocked(m, p),
    ) ?? null
  );
}

/** The finale part the mayor offers next (spec 007): the first unlocked one not done yet. */
export function finaleOffer(list: readonly Mission[], p: Progress): Mission | null {
  return (
    list.find(
      (m) => m.tier === 'finale' && !((p.missionsDone[m.id] ?? 0) > 0) && isUnlocked(m, p),
    ) ?? null
  );
}

/**
 * Badges earned by the progress so far: a job's badge once all its Rookie missions are done, plus
 * any `badge:x` in a finished mission's `reward.unlocks`.
 */
export function earnedBadges(list: readonly Mission[], p: Progress): string[] {
  const out = new Set<string>();
  for (const job of JobId.options) {
    const rookies = list.filter((m) => m.job === job && m.tier === 'rookie');
    if (rookies.length > 0 && rookies.every((m) => (p.missionsDone[m.id] ?? 0) > 0)) out.add(job);
  }
  for (const m of list) {
    if (!((p.missionsDone[m.id] ?? 0) > 0)) continue;
    for (const u of m.reward.unlocks ?? []) if (u.startsWith('badge:')) out.add(u.slice(6));
  }
  return [...out];
}

/** Things that happen in the world that can satisfy a goal. */
export type MissionEvent =
  | { type: 'reached'; target: string }
  | { type: 'caught'; robber: string }
  | { type: 'checkpoint'; flag: string }
  | { type: 'siren' }
  | { type: 'escorted'; group: string }
  | { type: 'found'; item: string }
  | { type: 'minigameDone'; id: string }
  | { type: 'errandDone'; id: string }
  | { type: 'built'; spot: string }
  | { type: 'sprayed'; fire: string }
  | { type: 'rescued'; pet: string }
  | { type: 'insideDone'; room: string };

/** The parts of a goal that must all happen (any order), or null for a single-event goal. */
export function goalParts(goal: Goal): string[] | null {
  switch (goal.type) {
    case 'catch':
      return goal.robbers.map((r) => r.id);
    case 'checkpoints':
      return goal.flags;
    case 'spray':
      return goal.fires;
    default:
      return null;
  }
}

/** The part of a goal an event ticks off ('*' for single-event goals), or null if unrelated. */
function partFor(goal: Goal, e: MissionEvent): string | null {
  switch (goal.type) {
    case 'goTo':
      return e.type === 'reached' && e.target === goal.target ? '*' : null;
    case 'catch':
      return e.type === 'caught' && goal.robbers.some((r) => r.id === e.robber) ? e.robber : null;
    case 'checkpoints':
      return e.type === 'checkpoint' && goal.flags.includes(e.flag) ? e.flag : null;
    case 'siren':
      return e.type === 'siren' ? '*' : null;
    case 'escort':
      return e.type === 'escorted' && e.group === goal.group ? '*' : null;
    case 'find':
      return e.type === 'found' && e.item === goal.item ? '*' : null;
    case 'minigame':
      return e.type === 'minigameDone' && e.id === goal.id ? '*' : null;
    case 'errand':
      return e.type === 'errandDone' && e.id === goal.id ? '*' : null;
    case 'build':
      return e.type === 'built' && e.spot === goal.spot ? '*' : null;
    case 'spray':
      return e.type === 'sprayed' && goal.fires.includes(e.fire) ? e.fire : null;
    case 'rescue':
      return e.type === 'rescued' && e.pet === goal.pet ? '*' : null;
    case 'inside':
      return e.type === 'insideDone' && e.room === goal.room ? '*' : null;
  }
}

/**
 * One play-through of a mission: runs the goals in order. There is no fail state — a run only
 * moves forward, and finishing is always a win (1–3 stars).
 */
export class MissionRun {
  goalIndex = 0;
  readonly goalStartedAt: number[] = [];
  readonly goalDoneAt: number[] = [];
  /** Parts of the current goal already done (robbers caught, flags passed, fires out). */
  readonly parts = new Set<string>();
  /** Items collected during this run (for collect bonuses). */
  readonly collected: Record<string, number> = {};
  /** The part the last event ticked off (for effects: which flag turned green). */
  lastPart: string | null = null;

  constructor(
    readonly mission: Mission,
    now: number,
  ) {
    this.goalStartedAt[0] = now;
  }

  get done(): boolean {
    return this.goalIndex >= this.mission.goals.length;
  }

  get goal(): Goal | null {
    return this.mission.goals[this.goalIndex] ?? null;
  }

  /** Whether a part of the current goal (a robber id, a flag, a fire) is already done. */
  partDone(part: string): boolean {
    return this.parts.has(part);
  }

  collect(item: string, n = 1): void {
    this.collected[item] = (this.collected[item] ?? 0) + n;
  }

  /**
   * Feed a world event. Returns 'part' if it ticked off part of a multi-part goal, 'goal' if a goal
   * finished, 'complete' if the mission finished, or null if it didn't matter.
   */
  notify(e: MissionEvent, now: number): 'part' | 'goal' | 'complete' | null {
    const g = this.goal;
    if (!g) return null;
    const part = partFor(g, e);
    if (part === null || this.parts.has(part)) return null;
    this.parts.add(part);
    this.lastPart = part;
    const parts = goalParts(g);
    if (parts && !parts.every((p) => this.parts.has(p))) return 'part';
    this.parts.clear();
    this.goalDoneAt[this.goalIndex] = now;
    this.goalIndex++;
    if (this.done) return 'complete';
    this.goalStartedAt[this.goalIndex] = now;
    return 'goal';
  }

  /** Stars for a finished run: 1 for finishing + 1 per satisfied bonus (max 3). */
  stars(): number {
    let stars = 1;
    for (const b of this.mission.bonus) {
      if (b.type === 'collect' && (this.collected[b.item] ?? 0) >= b.count) stars++;
      if (b.type === 'fastGoal') {
        const start = this.goalStartedAt[b.goal];
        const end = this.goalDoneAt[b.goal];
        if (start !== undefined && end !== undefined && (end - start) / 1000 <= b.seconds) stars++;
      }
    }
    return Math.min(3, stars);
  }
}
