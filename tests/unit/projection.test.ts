import { describe, expect, it } from 'vitest';
import {
  depthOf,
  footprintDepth,
  gridToScreen,
  isInFrontOf,
  resolveDepth,
  screenToGrid,
  tileOf,
} from '../../src/iso/projection';

describe('gridToScreen', () => {
  it('matches the architecture formula', () => {
    expect(gridToScreen(0, 0)).toEqual({ x: 0, y: 0 });
    expect(gridToScreen(1, 0)).toEqual({ x: 32, y: 16 });
    expect(gridToScreen(0, 1)).toEqual({ x: -32, y: 16 });
    expect(gridToScreen(2, 3, 1)).toEqual({ x: -32, y: 80 - 32 });
  });

  it('round-trips with screenToGrid', () => {
    for (let i = 0; i < 200; i++) {
      const gx = Math.random() * 40 - 10;
      const gy = Math.random() * 40 - 10;
      const s = gridToScreen(gx, gy);
      const g = screenToGrid(s.x, s.y);
      expect(g.x).toBeCloseTo(gx, 9);
      expect(g.y).toBeCloseTo(gy, 9);
    }
  });

  it('screenToGrid round-trips back to screen', () => {
    for (const [x, y] of [
      [0, 0],
      [100, 50],
      [-320, 400],
      [17, -3],
    ] as const) {
      const g = screenToGrid(x, y);
      const s = gridToScreen(g.x, g.y);
      expect(s.x).toBeCloseTo(x, 9);
      expect(s.y).toBeCloseTo(y, 9);
    }
  });

  it('tileOf picks the tile under a screen point at a tile centre', () => {
    const c = gridToScreen(3.5, 7.5);
    const g = screenToGrid(c.x, c.y);
    expect(tileOf(g.x, g.y)).toEqual({ x: 3, y: 7 });
  });
});

describe('depth ordering', () => {
  it('things further south (larger gx+gy) draw in front', () => {
    expect(depthOf(2, 2)).toBeGreaterThan(depthOf(1, 2));
    expect(depthOf(2, 2)).toBeGreaterThan(depthOf(2, 1));
    expect(depthOf(5, 0)).toBe(depthOf(0, 5));
  });

  it('height breaks ties within a tile', () => {
    expect(depthOf(1, 1, 2)).toBeGreaterThan(depthOf(1, 1, 0));
    expect(depthOf(1, 1, 99)).toBeLessThan(depthOf(2, 1, 0));
  });

  it('multi-tile footprints sort by their front-most tile', () => {
    expect(footprintDepth({ x: 4, y: 4, w: 3, d: 3 })).toBe(depthOf(6.5, 6.5));
  });

  it('a walker beside a box is in front of it only when past its far edges', () => {
    const box = { x: 4, y: 4, w: 2, d: 2 };
    expect(isInFrontOf(6.5, 4.5, box, 0.3)).toBe(true); // east side
    expect(isInFrontOf(4.5, 6.5, box, 0.3)).toBe(true); // south side
    expect(isInFrontOf(3.5, 5, box, 0.3)).toBe(false); // west side
    expect(isInFrontOf(5, 3.5, box, 0.3)).toBe(false); // north side
  });

  it('resolveDepth satisfies front/behind constraints', () => {
    expect(resolveDepth(500, [800], [1200])).toBeGreaterThan(800);
    expect(resolveDepth(500, [800], [1200])).toBeLessThan(1200);
    expect(resolveDepth(1500, [], [1200])).toBeLessThan(1200);
    expect(resolveDepth(700, [], [])).toBe(700);
  });
});
