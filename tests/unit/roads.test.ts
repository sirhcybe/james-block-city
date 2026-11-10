import { describe, expect, it } from 'vitest';
import { tileAt } from '../../src/content/schema';
import { loadWorld } from '../../src/content/world';
import { buildLaneGraph, rightOf } from '../../src/iso/roads';
import { pickBranch, stickDiff, toScreen, wantsUTurn } from '../../src/iso/steer';

const E = { x: 1, y: 0 };
const W = { x: -1, y: 0 };
const S = { x: 0, y: 1 };
const N = { x: 0, y: -1 };

describe('buildLaneGraph', () => {
  // A plus-shaped pair of two-wide roads in a 10×10 map.
  const rows = [
    '....rr....',
    '....rr....',
    '....rr....',
    '....rr....',
    'rrrrrrrrrr',
    'rrrrrrrrrr',
    '....rr....',
    '....rr....',
    '....rr....',
    '....rr....',
  ];
  const g = buildLaneGraph((x, y) => rows[y]![x] === 'r', 10, 10);

  it('puts nodes on the centre line only', () => {
    expect(g.get(5, 5)).toBeDefined(); // the crossing
    expect(g.get(3, 5)).toBeDefined();
    expect(g.get(5, 2)).toBeDefined();
    expect(g.get(4, 5)).toBeDefined();
    expect(g.get(3, 4)).toBeUndefined();
    expect(g.get(4, 4)).toBeUndefined();
  });

  it('flags the 4-way crossing as an intersection', () => {
    expect(g.intersections().map((n) => n.id)).toEqual(['5,5']);
    expect(g.get(5, 5)!.links).toHaveLength(4);
  });

  it('finds shortest paths', () => {
    expect(g.path('1,5', '5,9')).toEqual([
      '1,5',
      '2,5',
      '3,5',
      '4,5',
      '5,5',
      '5,6',
      '5,7',
      '5,8',
      '5,9',
    ]);
  });
});

describe('the city lane graph', () => {
  const world = loadWorld();
  const g = buildLaneGraph((x, y) => tileAt(world, x, y) === 'road', world.width, world.height);

  it('connects downtown and the plaza into one network', () => {
    const start = g.get(5, 8)!; // police car spot
    for (const n of g.nodes.values()) expect(g.path(start.id, n.id), n.id).not.toBeNull();
  });

  it('has the traffic-light crossing and T-junctions', () => {
    expect(g.get(8, 8)!.links).toHaveLength(4);
    expect(g.get(14, 8)!.links.length).toBeGreaterThanOrEqual(3);
    expect(g.get(18, 8)!.links.length).toBeGreaterThanOrEqual(3);
  });

  it('markers for vehicles sit on lane nodes', () => {
    for (const k of ['police-car', 'getaway-start', 'police-van']) {
      const m = world.markers[k]!;
      expect(g.get(m.gx, m.gy), k).toBeDefined();
    }
  });
});

describe('pickBranch (screen-space road assist, ADR-004)', () => {
  // Grid directions: E = +gx (down-right on screen), S = +gy (down-left), W = -gx (up-left),
  // N = -gy (up-right). Sticks are screen-space (up = -y).
  const UP = { x: 0, y: -1 };
  const RIGHT = { x: 1, y: 0 };
  const DOWN = { x: 0, y: 1 };
  const scr = (d: { x: number; y: number }) => toScreen(d);

  it('goes straight with no input, follows bends, waits at a T with no straight', () => {
    expect(pickBranch(null, E, [E, W, S])).toBe(0);
    expect(pickBranch(null, E, [W, S])).toBe(1); // bend
    expect(pickBranch(null, E, [W, N, S])).toBe(-1); // T: ask the driver
  });

  it('picks the branch closest to the stick as seen on screen', () => {
    expect(pickBranch(scr(S), E, [E, W, S, N])).toBe(2);
    expect(pickBranch(scr(N), E, [E, W, S, N])).toBe(3);
    expect(pickBranch(DOWN, N, [N, S, E, W])).toBe(2); // up-right road, push down: E (down-right)
  });

  it('breaks ties toward straight on (arrow keys sit between two roads)', () => {
    // Right is 26.6° from both E (down-right) and N (up-right).
    expect(stickDiff(RIGHT, E)).toBeCloseTo(stickDiff(RIGHT, N), 6);
    expect(pickBranch(RIGHT, E, [E, W, S, N])).toBe(0);
    expect(pickBranch(RIGHT, N, [E, W, S, N])).toBe(3);
    // Up is 63.4° from both N and W: heading W keeps W.
    expect(pickBranch(UP, W, [E, W, S, N])).toBe(1);
  });

  it('stops instead of taking a branch far from the stick', () => {
    // Heading N (up-right) into a bend that only goes E (down-right); stick up: not that way.
    expect(pickBranch(UP, N, [S, E])).toBe(-1);
  });

  it('only goes back when the stick is clearly behind, and only when stopped', () => {
    expect(pickBranch(scr(W), E, [E, W, S, N])).not.toBe(1); // moving: never back
    expect(pickBranch(scr(W), E, [E, W, S, N], true)).toBe(1); // stopped: back is fine
    // Sideways-ish (86° from going back): stay put rather than bounce between corners.
    expect(pickBranch({ x: 0.5, y: 0.87 }, S, [N], true)).toBe(-1);
  });

  it('wantsUTurn needs the stick > 110° from the heading and a short cooldown', () => {
    expect(wantsUTurn(UP, E, 5)).toBe(true); // up vs down-right: 116.6°
    expect(wantsUTurn(RIGHT, E, 5)).toBe(false);
    expect(wantsUTurn(UP, E, 0.1)).toBe(false); // just turned
    expect(wantsUTurn(null, E, 5)).toBe(false);
  });
});

describe('lanes', () => {
  it('keeps vehicles on the right-hand lane', () => {
    expect(rightOf(E)).toEqual({ x: -0, y: 1 });
    expect(rightOf(S)).toEqual({ x: -1, y: 0 });
  });
});

describe('pedestrians are never in the road (AC11)', () => {
  const world = loadWorld();
  it('every walker route stays on sidewalk / plaza / grass tiles', () => {
    expect(world.walkers.length).toBeGreaterThanOrEqual(3);
    for (const w of world.walkers) {
      for (let k = 0; k <= 20; k++) {
        const x = w.from.gx + ((w.to.gx - w.from.gx) * k) / 20;
        const y = w.from.gy + ((w.to.gy - w.from.gy) * k) / 20;
        // Include the hop radius around the walker.
        for (const [dx, dy] of [
          [0, 0],
          [0.25, 0],
          [-0.25, 0],
          [0, 0.25],
          [0, -0.25],
        ] as const) {
          expect(
            tileAt(world, Math.floor(x + dx), Math.floor(y + dy)),
            `${w.id} @${x},${y}`,
          ).not.toBe('road');
        }
      }
    }
  });
});
