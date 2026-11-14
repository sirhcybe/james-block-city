import { describe, expect, it } from 'vitest';
import { tileAt } from '../../src/content/schema';
import { loadWorld } from '../../src/content/world';
import { LaneDriver } from '../../src/entities/LaneDriver';
import { buildLaneGraph, dirBetween } from '../../src/iso/roads';
import type { LaneNode } from '../../src/iso/roads';
import { stickDiff, toScreen } from '../../src/iso/steer';

type Vec = { x: number; y: number };
const same = (a: Vec, b: Vec) => a.x === b.x && a.y === b.y;

const world = loadWorld();
const graph = buildLaneGraph((x, y) => tileAt(world, x, y) === 'road', world.width, world.height);
const isRoadAt = (p: { x: number; y: number }) =>
  tileAt(world, Math.floor(p.x), Math.floor(p.y)) === 'road';
const DT = 1 / 60;
/** Screen-space stick pointing along a grid direction. */
const along = (gx: number, gy: number) => {
  const v = toScreen({ x: gx, y: gy });
  const l = Math.hypot(v.x, v.y);
  return { x: v.x / l, y: v.y / l };
};
const KEYS: Record<string, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  upLeft: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
  upRight: { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  downLeft: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  downRight: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
};

describe('LaneDriver road assist', () => {
  it('never leaves the road whatever the stick does (curves and spins included)', () => {
    const car = new LaneDriver(graph, graph.get(7, 10)!, { x: 1, y: 0 });
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    let stick = { x: 1, y: 0 };
    for (let i = 0; i < 60 * 120; i++) {
      if (i % 90 === 0) stick = { x: rnd(), y: rnd() };
      car.update(DT, { stick });
      expect(isRoadAt(car.pos), JSON.stringify(car.pos)).toBe(true);
    }
  });

  it('drives on the right-hand lane', () => {
    const car = new LaneDriver(graph, graph.get(6, 10)!, { x: 1, y: 0 });
    for (let i = 0; i < 30; i++) car.update(DT, { stick: along(1, 0) });
    expect(car.pos.y).toBeCloseTo(10.5, 1); // heading +gx: lane is +gy of the centre line
  });

  it('turns at the intersection toward the stick, on a curve', () => {
    const car = new LaneDriver(graph, graph.get(9, 10)!, { x: 1, y: 0 });
    const south = along(0, 1);
    let curved = false;
    for (let i = 0; i < 50; i++) {
      car.update(DT, { stick: south });
      const a = car.headingAngle;
      if (a > 0.2 && a < Math.PI / 2 - 0.2) curved = true; // between east and south
    }
    // Came along y=10 eastwards, turned south at the (10,10) crossing.
    expect(car.centre.x).toBeCloseTo(10, 5);
    expect(car.centre.y).toBeGreaterThan(11);
    expect(curved).toBe(true);
  });

  it('stops without input and spins round when the stick points back', () => {
    const car = new LaneDriver(graph, graph.get(6, 10)!, { x: 1, y: 0 });
    for (let i = 0; i < 60; i++) car.update(DT, { stick: along(1, 0) });
    for (let i = 0; i < 60; i++) car.update(DT, { stick: null });
    expect(car.speed).toBe(0);
    car.update(DT, { stick: along(-1, 0) });
    expect(car.spin).not.toBeNull();
    expect(car.dir).toEqual({ x: -1, y: 0 });
    for (let i = 0; i < 30; i++) car.update(DT, { stick: along(-1, 0) });
    expect(car.spin).toBeNull();
    expect(car.dir8).toBe(4); // facing -gx
  });

  it('tap-to-go follows the roads to the nearest node and stops there', () => {
    const car = new LaneDriver(graph, graph.get(7, 10)!, { x: 1, y: 0 });
    expect(car.goToward({ x: 31, y: 18 })).toBe(true);
    for (let i = 0; i < 60 * 20 && (car.following || car.speed > 0); i++) {
      car.update(DT, { stick: null });
      expect(isRoadAt(car.pos)).toBe(true);
    }
    expect(Math.round(car.centre.x)).toBe(31);
    expect(Math.round(car.centre.y)).toBe(18);
  });

  it('AC2: at a crossing an arrow key between two roads keeps going straight', () => {
    // Heading +gx (down-right on screen) into the (10,10) crossing, holding Right: the options
    // down-right (straight) and up-right are equally close to Right on screen. Straight wins.
    const car = new LaneDriver(graph, graph.get(8, 10)!, { x: 1, y: 0 });
    for (let i = 0; i < 90; i++) car.update(DT, { stick: KEYS.right! });
    expect(car.from.x).toBeGreaterThanOrEqual(10);
    expect(car.dir).toEqual({ x: 1, y: 0 });
  });
});

describe('AC1: holding one direction never makes the car flip back and forth', () => {
  const starts = [...graph.nodes.values()].filter((_, i) => i % 5 === 0);
  const sticks: { name: string; v: { x: number; y: number } }[] = Object.entries(KEYS).map(
    ([name, v]) => ({ name, v }),
  );
  for (let deg = 0; deg < 360; deg += 15) {
    const r = (deg * Math.PI) / 180;
    sticks.push({ name: `${deg}°`, v: { x: Math.cos(r), y: Math.sin(r) } });
  }

  it(`${sticks.length} directions × ${starts.length} starts × 30 s`, () => {
    for (const start of starts) {
      for (const heading of start.links.map((id) => dirBetween(start, graph.node(id)))) {
        for (const { name, v } of sticks) {
          const car = new LaneDriver(graph, start, heading);
          let uturns = 0;
          const changes: { at: string; time: number }[] = [];
          let lastDir = car.dir;
          let wasSpinning = false;
          for (let i = 0; i < 60 * 30; i++) {
            car.update(DT, { stick: v });
            const spinning = car.spin !== null;
            if (spinning && !wasSpinning) uturns++;
            wasSpinning = spinning;
            const d = car.dir;
            if (d.x !== lastDir.x || d.y !== lastDir.y) {
              changes.push({ at: car.from.id, time: i * DT });
              lastDir = d;
            }
            if (!isRoadAt(car.pos)) throw new Error(`off road ${name} ${JSON.stringify(car.pos)}`);
          }
          const label = `${name} from ${start.id} heading ${JSON.stringify(heading)}`;
          expect(uturns, label).toBeLessThanOrEqual(1);
          // Never more than 2 direction changes on one node within 1 s.
          for (let k = 2; k < changes.length; k++) {
            const a = changes[k - 2]!;
            const b = changes[k]!;
            const sameNode = a.at === b.at && changes[k - 1]!.at === b.at;
            expect(sameNode && b.time - a.time < 1, label).toBe(false);
          }
        }
      }
    }
  }, 60_000);
});

describe('Downtown ↔ Plaza (playtest 2026-11-10: "hard to travel between the two blocks")', () => {
  const PLAZA_X = 16;
  const run = (
    start: { x: number; y: number },
    heading: { x: number; y: number },
    stick: { x: number; y: number },
  ) => {
    const car = new LaneDriver(graph, graph.get(start.x, start.y)!, heading);
    for (let i = 0; i < 60 * 25; i++) {
      car.update(DT, { stick });
      if (stick.x > 0 ? car.centre.x > PLAZA_X + 1 : car.centre.x < PLAZA_X - 1) return true;
    }
    return false;
  };
  for (const [key, toward] of [
    ['right', 'plaza'],
    ['downRight', 'plaza'],
    ['left', 'downtown'],
    ['upLeft', 'downtown'],
  ] as const) {
    it(`holding ${key} from anywhere in the other block reaches ${toward}`, () => {
      const nodes = [...graph.nodes.values()].filter((n) =>
        toward === 'plaza' ? n.x < PLAZA_X - 1 : n.x > PLAZA_X + 1,
      );
      for (const n of nodes) {
        for (const id of n.links) {
          const heading = dirBetween(n, graph.node(id));
          expect(run(n, heading, KEYS[key]!), `${key} from ${n.id}`).toBe(true);
        }
      }
    }, 30_000);
  }
});

describe('turning with one arrow key (playtest 2026-11-11: "very hard to turn corners")', () => {
  /**
   * Drive at a junction holding the road's own direction, then switch to a key nearer a side road
   * than straight on (or tied with it) when `dist` tiles from the junction. Turned = took that road.
   */
  const trial = (J: LaneNode, h: Vec, B: LaneNode, key: Vec, dist: number) => {
    const car = new LaneDriver(graph, graph.get(J.x - 4 * h.x, J.y - 4 * h.y)!, h);
    let switched = false;
    for (let i = 0; i < 60 * 6; i++) {
      const left = (J.x - car.centre.x) * h.x + (J.y - car.centre.y) * h.y;
      if (!switched && same(car.dir, h) && left <= dist) switched = true;
      car.update(DT, { stick: switched ? key : along(h.x, h.y) });
      if (car.from.id === J.id && car.to.id === B.id) return true;
    }
    return false;
  };
  const cases: { J: LaneNode; h: Vec; B: LaneNode; key: Vec; name: string }[] = [];
  for (const J of graph.intersections()) {
    for (const pid of J.links) {
      const h = dirBetween(graph.node(pid), J);
      if (![1, 2, 3, 4].every((k) => graph.get(J.x - k * h.x, J.y - k * h.y))) continue;
      for (const bid of J.links) {
        const B = graph.node(bid);
        const b = dirBetween(J, B);
        if (same(b, h) || same(b, { x: -h.x, y: -h.y })) continue;
        for (const [name, key] of Object.entries(KEYS)) {
          // Keys a child would press for that road: within 64° of it and no nearer straight on.
          if (stickDiff(key, b) <= 64 && stickDiff(key, b) <= stickDiff(key, h) + 1)
            cases.push({ J, h, B, key, name });
        }
      }
    }
  }

  it('pressed 1.5 tiles ahead, every such key turns', () => {
    expect(cases.length).toBeGreaterThan(100);
    for (const c of cases)
      expect(trial(c.J, c.h, c.B, c.key, 1.5), `${c.name} at ${c.J.id}`).toBe(true);
  }, 60_000);

  it('pressed late (half a tile ahead), at least 90% still turn', () => {
    const ok = cases.filter((c) => trial(c.J, c.h, c.B, c.key, 0.6)).length;
    expect(ok / cases.length).toBeGreaterThanOrEqual(0.9);
  }, 60_000);
});
