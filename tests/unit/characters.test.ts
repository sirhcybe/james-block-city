import { describe, expect, it } from 'vitest';
import {
  CHAR_FOOT_Y,
  CHAR_H,
  faceLayout,
  HEAD_R,
  WALK_STEP_SEC,
  walkFrame,
} from '../../src/art/characters';

/** Spec 009: face parts fit on the face, and walking uses both legs. */
describe('character art layout', () => {
  const inHead = (x: number, y: number, r: number) => Math.hypot(x, y) + r <= HEAD_R;

  for (const side of [1, -1] as const) {
    for (const masked of [false, true]) {
      it(`AC1 every face part is inside the head (side ${side}, mask ${masked})`, () => {
        const f = faceLayout(side, masked);
        for (const [x, y, r] of [...f.eyes, ...f.cheeks]) expect(inHead(x, y, r)).toBe(true);
        // The smile: both ends and the lowest point of the arc.
        const s = f.smile;
        for (const a of [s.a0, (s.a0 + s.a1) / 2, s.a1])
          expect(inHead(s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r, 1)).toBe(true);
        // The mask covers the eyes and stays between the hairline and the smile.
        expect(f.mask.y0).toBeGreaterThan(-HEAD_R);
        expect(f.mask.y1).toBeLessThan(HEAD_R);
        if (masked) {
          for (const [, y, r] of f.eyes) {
            expect(y - r).toBeGreaterThanOrEqual(f.mask.y0);
            expect(y + r).toBeLessThanOrEqual(f.mask.y1);
          }
        }
      });
    }
  }

  it('AC1 cheeks sit beside the smile, not on it, and below the eyes', () => {
    const f = faceLayout(1);
    const smileHalf = Math.cos(f.smile.a0) * f.smile.r;
    for (const [x, y, r] of f.cheeks) {
      expect(Math.abs(x - f.smile.x) - r).toBeGreaterThan(smileHalf);
      expect(y).toBeGreaterThan(f.eyes[0]![1]);
    }
  });

  it('AC3 the walk cycle steps with one leg, then the other', () => {
    const frames = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => walkFrame((i + 0.5) * WALK_STEP_SEC));
    expect(frames).toEqual([1, 0, 2, 0, 1, 0, 2, 0]);
    expect(walkFrame(0)).toBe(1); // a walk starts on a step, so even one tap shows a step
    expect(walkFrame(-1)).toBe(1);
  });

  it('the frame has head room for hats and keeps the feet near the bottom', () => {
    expect(CHAR_FOOT_Y).toBeLessThan(CHAR_H);
    // Head top is 52 px above the feet; the tallest hat (the chef's) adds about 24 more.
    expect(CHAR_FOOT_Y - 52 - 24).toBeGreaterThanOrEqual(4);
  });
});
