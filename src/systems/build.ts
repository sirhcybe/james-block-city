import type { Vec2 } from '../iso/projection';

/**
 * Builder build spots (spec 005, pure). The block blaster adds blocks to a spot in reach; when
 * enough blocks are in, it's built. Nothing can go wrong: every press adds, nothing ever falls off.
 */
export const BUILD = {
  /** Reach across (tiles) from the mixer truck, and on foot. */
  truckReach: 6.5,
  footReach: 3,
  /** Blocks per press, and with the giant mixer drum (the Pro upgrade). */
  perPress: 1,
  giantPerPress: 2,
  /** Seconds between presses counting (so a held/bashed button doesn't skip the animation). */
  cooldownSec: 0.25,
};
export type BuildTuning = typeof BUILD;

/** Blocks a spot needs, by its footprint (small wall 6 … big boat shop 10). */
export function blocksFor(site: { w: number; d: number; h: number }): number {
  return Math.max(6, Math.min(10, Math.round(4 + site.w * site.d + site.h)));
}

export class SiteState {
  added = 0;
  constructor(readonly needed: number) {}

  get built(): boolean {
    return this.added >= this.needed;
  }

  /** 0..1 how much is built. */
  get progress(): number {
    return Math.min(1, this.added / this.needed);
  }

  /** Add blocks; returns true on the press that finishes it. */
  add(n: number): boolean {
    if (this.built) return false;
    this.added = Math.min(this.needed, this.added + n);
    return this.built;
  }
}

export interface SiteSpot extends Vec2 {
  id: string;
}

/** The site the blaster would build on: the nearest active one in reach (or null). */
export function pickSite(
  from: Vec2,
  mode: 'foot' | 'truck',
  sites: readonly SiteSpot[],
  t: BuildTuning = BUILD,
): string | null {
  const reach = mode === 'truck' ? t.truckReach : t.footReach;
  let best: { id: string; d: number } | null = null;
  for (const s of sites) {
    const d = Math.hypot(s.x - from.x, s.y - from.y);
    if (d > reach) continue;
    if (!best || d < best.d) best = { id: s.id, d };
  }
  return best?.id ?? null;
}
