import { describe, expect, it } from 'vitest';
import plazaRaw from '../../src/content/plaza.json';
import { parseMap, tileAt } from '../../src/content/schema';
import { buildWalkGrid } from '../../src/content/world';
import { WalkGrid } from '../../src/iso/grid';
import { PathFinder } from '../../src/iso/path';

describe('plaza content', () => {
  const plaza = parseMap(plazaRaw);

  it('is valid and has the required landmarks', () => {
    expect(plaza.width).toBe(16);
    const kinds = plaza.buildings.map((b) => b.kind);
    expect(kinds.filter((k) => k === 'cityhall')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'tower')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'house')).toHaveLength(3);
    expect(kinds.filter((k) => k === 'fountain')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'tree').length).toBeGreaterThan(3);
    expect(tileAt(plaza, 1, 1)).toBe('road');
  });

  it('spawn is walkable and every walkable tile is reachable from it', () => {
    const grid = buildWalkGrid(plaza);
    const pf = new PathFinder(grid);
    const s = plaza.spawn;
    expect(grid.isWalkable(Math.floor(s.gx), Math.floor(s.gy))).toBe(true);
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (!grid.isWalkable(x, y)) continue;
        expect(pf.find({ x: s.gx, y: s.gy }, { x, y }), `tile ${x},${y}`).not.toBeNull();
      }
    }
  });

  it('rejects malformed maps', () => {
    const bad = structuredClone(plazaRaw) as { tiles: string[] };
    bad.tiles[3] = 'gg';
    expect(() => parseMap(bad)).toThrow(/row 3/);
  });
});

describe('WalkGrid collision', () => {
  const g = new WalkGrid(6, 6);
  g.blockRect(2, 2, 2, 2);

  it('circles cannot overlap blocked tiles or leave the map', () => {
    expect(g.circleFits(1.5, 1.5, 0.3)).toBe(true);
    expect(g.circleFits(1.8, 2.5, 0.3)).toBe(false);
    expect(g.circleFits(0.1, 3, 0.3)).toBe(false);
    expect(g.circleFits(5.9, 3, 0.3)).toBe(false);
  });

  it('slide stops at walls but keeps the free axis', () => {
    const p = g.slide({ x: 1.5, y: 2.5 }, { x: 0.5, y: 0.2 }, 0.3);
    expect(p.x).toBeCloseTo(1.5);
    expect(p.y).toBeCloseTo(2.7);
  });

  it('nearestWalkable finds an adjacent tile for a blocked one', () => {
    const t = g.nearestWalkable(2, 2)!;
    expect(g.isWalkable(t.x, t.y)).toBe(true);
    expect(Math.abs(t.x - 2) + Math.abs(t.y - 2)).toBeLessThanOrEqual(1);
  });
});

describe('PathFinder', () => {
  const g = new WalkGrid(8, 8);
  g.blockRect(3, 0, 1, 7); // a wall with a gap at the bottom
  const pf = new PathFinder(g);

  it('routes around buildings', () => {
    const path = pf.find({ x: 1.5, y: 1.5 }, { x: 6, y: 1 })!;
    expect(path).not.toBeNull();
    expect(path.at(-1)).toEqual({ x: 6, y: 1 });
    for (const t of path) expect(g.isWalkable(t.x, t.y)).toBe(true);
    expect(path.some((t) => t.y === 7)).toBe(true); // went through the gap
  });

  it('returns [] when already there', () => {
    expect(pf.find({ x: 1.2, y: 1.7 }, { x: 1, y: 1 })).toEqual([]);
  });

  it('retargets a blocked destination to the nearest walkable tile', () => {
    const path = pf.find({ x: 1.5, y: 1.5 }, { x: 3.5, y: 2.5 })!;
    const end = path.at(-1)!;
    expect(g.isWalkable(end.x, end.y)).toBe(true);
    expect(end).toEqual({ x: 2, y: 2 });
  });

  it('returns null for unreachable targets', () => {
    const sealed = new WalkGrid(5, 5);
    sealed.blockRect(2, 0, 1, 5);
    expect(new PathFinder(sealed).find({ x: 0.5, y: 0.5 }, { x: 4, y: 4 })).toBeNull();
  });
});
