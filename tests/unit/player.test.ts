import { describe, expect, it } from 'vitest';
import plazaRaw from '../../src/content/plaza.json';
import { parseMap } from '../../src/content/schema';
import { buildWalkGrid } from '../../src/content/world';
import { facingForGridDir, Player } from '../../src/entities/Player';
import { WalkGrid } from '../../src/iso/grid';
import { PathFinder } from '../../src/iso/path';
import { gridToScreen } from '../../src/iso/projection';

const DT = 1 / 60;

describe('facingForGridDir', () => {
  it('maps grid axes to screen diagonals', () => {
    expect(facingForGridDir({ x: 1, y: 0 }, 'NW')).toBe('SE');
    expect(facingForGridDir({ x: -1, y: 0 }, 'SE')).toBe('NW');
    expect(facingForGridDir({ x: 0, y: 1 }, 'SE')).toBe('SW');
    expect(facingForGridDir({ x: 0, y: -1 }, 'SE')).toBe('NE');
  });
  it('keeps the previous side for pure vertical/horizontal screen moves', () => {
    expect(facingForGridDir({ x: -1, y: -1 }, 'SE')).toBe('NE'); // straight up, was facing right
    expect(facingForGridDir({ x: -1, y: -1 }, 'SW')).toBe('NW');
  });
});

describe('Player', () => {
  it('up arrow moves the player up the screen', () => {
    const g = new WalkGrid(10, 10);
    const p = new Player(g, { x: 5, y: 5 });
    const before = gridToScreen(p.pos.x, p.pos.y);
    for (let i = 0; i < 30; i++) p.update(DT, { x: 0, y: -1 });
    const after = gridToScreen(p.pos.x, p.pos.y);
    expect(after.y).toBeLessThan(before.y - 20);
    expect(after.x).toBeCloseTo(before.x, 6);
  });

  it('never enters buildings or leaves the map, whatever the input', () => {
    const plaza = parseMap(plazaRaw);
    const grid = buildWalkGrid(plaza);
    const p = new Player(grid, { x: plaza.spawn.gx, y: plaza.spawn.gy });
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    let dir = { x: 1, y: 0 };
    for (let i = 0; i < 20000; i++) {
      if (i % 40 === 0) dir = { x: rnd(), y: rnd() };
      p.update(DT, dir);
      expect(grid.circleFits(p.pos.x, p.pos.y, p.radius - 1e-6)).toBe(true);
    }
  });

  it('follows a path around buildings to the destination', () => {
    const plaza = parseMap(plazaRaw);
    const grid = buildWalkGrid(plaza);
    const pf = new PathFinder(grid);
    const p = new Player(grid, { x: plaza.spawn.gx, y: plaza.spawn.gy });
    p.setPath(pf.find(p.pos, { x: 9, y: 4 })!); // behind the fountain and next to the tower
    for (let i = 0; i < 60 * 15 && p.following; i++) p.update(DT, { x: 0, y: 0 });
    expect(p.following).toBe(false);
    expect(p.pos.x).toBeCloseTo(9.5, 1);
    expect(p.pos.y).toBeCloseTo(4.5, 1);
  });

  it('manual input cancels the path', () => {
    const g = new WalkGrid(10, 10);
    const p = new Player(g, { x: 1.5, y: 1.5 });
    p.setPath([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);
    p.update(DT, { x: 0, y: 0 });
    expect(p.following).toBe(true);
    p.update(DT, { x: 1, y: 0 });
    expect(p.following).toBe(false);
  });
});
