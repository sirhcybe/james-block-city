/**
 * What every minigame round shares (spec 008, pure): hearts (the small failure state), levels
 * inside a round, streaks, and the star meter. The scenes' shared top bar draws these.
 */
export const ROUND = {
  /** Right answers in a row that give a heart back. */
  streakForHeart: 5,
  /** Extra hearts on each retry after an Oops, and the most extra a game ever gives. */
  heartsPerRetry: 2,
  maxExtraHearts: 4,
  maxLevel: 9,
};

/** Hearts to start a round with: more after each Oops, so nobody stays stuck. 0 = no hearts. */
export function heartsFor(base: number, fails: number): number {
  if (base <= 0) return 0;
  return base + Math.min(ROUND.maxExtraHearts, ROUND.heartsPerRetry * Math.max(0, fails));
}

/** The level inside a round: 1, then one more every `every` points. */
export function levelFor(score: number, every: number): number {
  if (every <= 0) return 1;
  return Math.min(ROUND.maxLevel, 1 + Math.floor(Math.max(0, score) / every));
}

export class Hearts {
  left: number;
  constructor(readonly max: number) {
    this.left = max;
  }

  /** A game with no hearts can't be lost. */
  get enabled(): boolean {
    return this.max > 0;
  }

  get out(): boolean {
    return this.enabled && this.left <= 0;
  }

  /** Lose one. Returns true when that was the last. */
  lose(): boolean {
    if (!this.enabled || this.left <= 0) return false;
    this.left--;
    return this.left === 0;
  }

  /** Win one back (never more than the round started with). Returns whether one was added. */
  gain(): boolean {
    if (!this.enabled || this.left >= this.max || this.left <= 0) return false;
    this.left++;
    return true;
  }
}

/** Right answers in a row. Every `streakForHeart`th one is worth a heart. */
export class Streak {
  n = 0;
  /** Count a right answer. Returns true when this one earns a heart. */
  hit(): boolean {
    this.n++;
    return this.n % ROUND.streakForHeart === 0;
  }

  miss(): void {
    this.n = 0;
  }
}

/**
 * The star meter: how full the bar is (0..1, full at the 3-star score), where the 2-star mark
 * sits on it, and how many stars the score is worth now (finishing is always worth one).
 */
export function starMeter(
  score: number,
  tiers: readonly [number, number, number],
): { fill: number; mark2: number; stars: 1 | 2 | 3 } {
  const top = Math.max(1, tiers[2]);
  return {
    fill: Math.max(0, Math.min(1, score / top)),
    mark2: Math.max(0, Math.min(1, tiers[1] / top)),
    stars: score >= tiers[2] ? 3 : score >= tiers[1] ? 2 : 1,
  };
}
