import { z } from 'zod';

const JobId = z.enum(['cop', 'fire', 'builder']);

export const Goal = z.discriminatedUnion('type', [
  z.object({ type: z.literal('goTo'), target: z.string() }),
  z.object({ type: z.literal('catch'), robber: z.string(), bumps: z.number().int().positive() }),
  z.object({ type: z.literal('minigame'), id: z.string() }),
  z.object({ type: z.literal('errand'), id: z.string() }),
  z.object({ type: z.literal('build'), spot: z.string() }),
  z.object({ type: z.literal('spray'), fires: z.array(z.string()) }),
]);
export type Goal = z.infer<typeof Goal>;

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
  voiceIntro: z.string(),
  goals: z.array(Goal).min(1),
  reward: z.object({ coins: z.number().int().positive(), unlocks: z.array(z.string()).optional() }),
  requires: z.array(z.string()).optional(),
  bonus: z.array(StarBonus).max(2).default([]),
});
export type Mission = z.infer<typeof Mission>;

export const MissionList = z.array(Mission);

/** Things that happen in the world that can satisfy a goal. */
export type MissionEvent =
  | { type: 'reached'; target: string }
  | { type: 'caught'; robber: string }
  | { type: 'minigameDone'; id: string }
  | { type: 'errandDone'; id: string }
  | { type: 'built'; spot: string }
  | { type: 'sprayed'; fire: string };

function satisfies(goal: Goal, e: MissionEvent): boolean {
  switch (goal.type) {
    case 'goTo':
      return e.type === 'reached' && e.target === goal.target;
    case 'catch':
      return e.type === 'caught' && e.robber === goal.robber;
    case 'minigame':
      return e.type === 'minigameDone' && e.id === goal.id;
    case 'errand':
      return e.type === 'errandDone' && e.id === goal.id;
    case 'build':
      return e.type === 'built' && e.spot === goal.spot;
    case 'spray':
      return e.type === 'sprayed' && goal.fires.includes(e.fire);
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
  private sprayed = new Set<string>();
  /** Items collected during this run (for collect bonuses). */
  readonly collected: Record<string, number> = {};

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

  collect(item: string, n = 1): void {
    this.collected[item] = (this.collected[item] ?? 0) + n;
  }

  /** Feed a world event. Returns 'goal' if a goal finished, 'complete' if the mission finished. */
  notify(e: MissionEvent, now: number): 'goal' | 'complete' | null {
    const g = this.goal;
    if (!g || !satisfies(g, e)) return null;
    if (g.type === 'spray' && e.type === 'sprayed') {
      this.sprayed.add(e.fire);
      if (!g.fires.every((f) => this.sprayed.has(f))) return null;
    }
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
