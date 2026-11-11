import type { Vec2 } from '../iso/projection';

/**
 * Friendly cartoon fires and the hose (spec 004, pure). Fires have grumpy faces and go "pfft";
 * nobody is ever in danger. The hose auto-aims at the nearest fire in reach: a 6-year-old just
 * presses the button.
 */
export const FIRE = {
  /** One press of Action sprays for this long (s). */
  burstSec: 0.7,
  /** hp (0..1) put out per second of spraying. */
  rate: 0.8,
  /** After this many bursts on one fire it gets easier... */
  easierAfterBursts: 3,
  /** ...spraying works this much harder, and it stops growing back. */
  easierRate: 2,
  /** hp a fire grows back per second while nobody sprays it (until easier). */
  regrow: 0.05,
  /** Reach on foot: tiles across, and only fires on the ground. */
  footReach: 3,
  footMaxZ: 1.5,
  /** Reach from the fire truck: tiles across, and how high its ladder goes (block units). */
  truckReach: 3.5,
  ladderZ: { standard: 10, long: 14 },
};
export type FireTuning = typeof FIRE;

export type Ladder = keyof FireTuning['ladderZ'];
export interface FireSpot extends Vec2 {
  id: string;
  /** Height above the ground (block units; a floor is one block). */
  z: number;
}

export class FireState {
  hp = 1;
  bursts = 0;
  constructor(private readonly t: FireTuning = FIRE) {}

  get out(): boolean {
    return this.hp <= 0;
  }

  get easier(): boolean {
    return this.bursts >= this.t.easierAfterBursts;
  }

  /** A new burst of water starts hitting this fire. */
  startBurst(): void {
    this.bursts++;
  }

  /** Advance: spraying (or not) for dt seconds. Returns true on the frame it goes out. */
  update(dt: number, spraying: boolean): boolean {
    if (this.out) return false;
    if (spraying) this.hp -= this.t.rate * (this.easier ? this.t.easierRate : 1) * dt;
    else if (!this.easier) this.hp = Math.min(1, this.hp + this.t.regrow * dt);
    if (this.hp <= 0) {
      this.hp = 0;
      return true;
    }
    return false;
  }
}

/** Can the hose reach a fire from here? 'far' = get closer; 'high' = needs a longer ladder. */
export function reach(
  from: Vec2,
  mode: 'foot' | 'truck',
  ladder: Ladder,
  fire: FireSpot,
  t: FireTuning = FIRE,
): 'ok' | 'far' | 'high' {
  const d = Math.hypot(fire.x - from.x, fire.y - from.y);
  const across = mode === 'foot' ? t.footReach : t.truckReach;
  const maxZ = mode === 'foot' ? t.footMaxZ : t.ladderZ[ladder];
  if (d > across + fire.z * 0.15) return 'far';
  if (fire.z > maxZ) return 'high';
  return 'ok';
}

/** The fire the hose would spray: the nearest one in reach (or null). */
export function pickFire(
  from: Vec2,
  mode: 'foot' | 'truck',
  ladder: Ladder,
  fires: readonly FireSpot[],
  t: FireTuning = FIRE,
): string | null {
  let best: { id: string; d: number } | null = null;
  for (const f of fires) {
    if (reach(from, mode, ladder, f, t) !== 'ok') continue;
    const d = Math.hypot(f.x - from.x, f.y - from.y);
    if (!best || d < best.d) best = { id: f.id, d };
  }
  return best?.id ?? null;
}

/** A fire you are next to but can't reach because it's too high (for the "longer ladder" hint). */
export function tooHigh(
  from: Vec2,
  mode: 'foot' | 'truck',
  ladder: Ladder,
  fires: readonly FireSpot[],
  t: FireTuning = FIRE,
): string | null {
  return fires.find((f) => reach(from, mode, ladder, f, t) === 'high')?.id ?? null;
}
