import { describe, expect, it } from 'vitest';
import { tileAt } from '../../src/content/schema';
import { loadWorld } from '../../src/content/world';
import { buildLaneGraph, chooseBranch, rightOf } from '../../src/iso/roads';

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

describe('chooseBranch (road assist)', () => {
  it('goes straight with no input, follows bends, waits at a T with no straight', () => {
    expect(chooseBranch(null, E, [E, W, S])).toBe(0);
    expect(chooseBranch(null, E, [W, S])).toBe(1); // bend
    expect(chooseBranch(null, E, [W, N, S])).toBe(-1); // T: ask the driver
  });

  it('picks the branch closest to the stick', () => {
    expect(chooseBranch(S, E, [E, W, S, N])).toBe(2);
    expect(chooseBranch({ x: 0.9, y: 0.4 }, E, [E, W, S, N])).toBe(0);
    expect(chooseBranch({ x: 0.3, y: -0.9 }, E, [E, W, S, N])).toBe(3);
  });

  it('only U-turns when the stick clearly points back', () => {
    expect(chooseBranch(W, E, [E, W, S, N])).toBe(1);
    expect(chooseBranch({ x: -0.6, y: 0.8 }, E, [E, W, S, N])).toBe(2); // back-ish but S is closer
    expect(chooseBranch(W, E, [W])).toBe(0); // dead end
  });

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
