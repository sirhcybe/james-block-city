import { describe, expect, it } from 'vitest';
import { tileAt } from '../../src/content/schema';
import { loadWorld } from '../../src/content/world';
import { LaneDriver } from '../../src/entities/LaneDriver';
import { screenDirToGrid } from '../../src/input/direction';
import { buildLaneGraph } from '../../src/iso/roads';

const world = loadWorld();
const graph = buildLaneGraph((x, y) => tileAt(world, x, y) === 'road', world.width, world.height);
const isRoadAt = (p: { x: number; y: number }) =>
  tileAt(world, Math.floor(p.x), Math.floor(p.y)) === 'road';
const DT = 1 / 60;

describe('LaneDriver road assist', () => {
  it('never leaves the road whatever the stick does', () => {
    const car = new LaneDriver(graph, graph.get(5, 8)!, { x: 1, y: 0 });
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    let stick = { x: 1, y: 0 };
    for (let i = 0; i < 60 * 120; i++) {
      if (i % 90 === 0) stick = screenDirToGrid({ x: rnd(), y: rnd() });
      car.update(DT, { stick });
      expect(isRoadAt(car.pos), JSON.stringify(car.pos)).toBe(true);
    }
  });

  it('drives on the right-hand lane', () => {
    const car = new LaneDriver(graph, graph.get(4, 8)!, { x: 1, y: 0 });
    for (let i = 0; i < 30; i++) car.update(DT, { stick: { x: 1, y: 0 } });
    expect(car.pos.y).toBeCloseTo(8.5, 1); // heading +gx: lane is +gy of the centre line
  });

  it('turns at the intersection toward the stick', () => {
    const car = new LaneDriver(graph, graph.get(5, 8)!, { x: 1, y: 0 });
    const south = { x: 0, y: 1 };
    for (let i = 0; i < 90; i++) car.update(DT, { stick: south });
    // Came along y=8 eastwards, turned south at the (8,8) crossing.
    expect(car.centre.x).toBeCloseTo(8, 5);
    expect(car.centre.y).toBeGreaterThan(9);
  });

  it('stops without input and turns around when the stick points back', () => {
    const car = new LaneDriver(graph, graph.get(4, 8)!, { x: 1, y: 0 });
    for (let i = 0; i < 60; i++) car.update(DT, { stick: { x: 1, y: 0 } });
    for (let i = 0; i < 60; i++) car.update(DT, { stick: null });
    expect(car.speed).toBe(0);
    car.update(DT, { stick: { x: -1, y: 0 } });
    expect(car.dir).toEqual({ x: -1, y: 0 });
  });

  it('tap-to-go follows the roads to the nearest node and stops there', () => {
    const car = new LaneDriver(graph, graph.get(5, 8)!, { x: 1, y: 0 });
    expect(car.goToward({ x: 24, y: 14 })).toBe(true);
    for (let i = 0; i < 60 * 20 && (car.path.length > 0 || car.speed > 0); i++) {
      car.update(DT, { stick: null });
      expect(isRoadAt(car.pos)).toBe(true);
    }
    expect(Math.round(car.centre.x)).toBe(24);
    expect(Math.round(car.centre.y)).toBe(14);
  });
});
