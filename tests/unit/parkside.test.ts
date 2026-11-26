import { describe, expect, it } from 'vitest';
import downtownRaw from '../../src/content/downtown.json';
import harborRaw from '../../src/content/harbor.json';
import heightsRaw from '../../src/content/heights.json';
import parksideRaw from '../../src/content/parkside.json';
import plazaRaw from '../../src/content/plaza.json';
import { loadContent } from '../../src/content';
import { mergeMaps, parseMap, tileAt, type MapDef } from '../../src/content/schema';
import { buildRoadGraph, buildSeaGrid, buildWalkGrid, loadWorld } from '../../src/content/world';
import { PathFinder } from '../../src/iso/path';

/** Spec 010: Parkside, the new neighborhood along the south coast. */
const world = loadWorld();
const content = loadContent();
const parkside = parseMap(parksideRaw);
const OY = 39;

const oldPieces = [
  { map: parseMap(downtownRaw), ox: 0, oy: 0 },
  { map: parseMap(plazaRaw), ox: 21, oy: 0 },
  { map: parseMap(heightsRaw), ox: 21, oy: 21 },
  { map: parseMap(harborRaw), ox: 42, oy: 0 },
];
const land = (m: MapDef) => {
  let n = 0;
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) if (tileAt(m, x, y) !== 'water') n++;
  return n;
};
const inParkside = (p: { gx: number; gy: number }) =>
  p.gx < parkside.width && p.gy >= OY && p.gy < OY + parkside.height;
const parksideIds = new Set(parkside.buildings.map((b) => b.id));
const road = (x: number, y: number) =>
  x >= 0 && y >= 0 && x < world.width && y < world.height && tileAt(world, x, y) === 'road';

describe('spec 010 Parkside', () => {
  it('AC1 the city has at least 50% more land than without Parkside', () => {
    const before = land(mergeMaps('before', oldPieces));
    const after = land(mergeMaps('after', [...oldPieces, { map: parkside, ox: 0, oy: OY }]));
    expect(after / before).toBeGreaterThanOrEqual(1.5);
    // Past the beach, open sea all along the new coast.
    for (let x = 0; x < world.width; x++) expect(tileAt(world, x, 62), `x ${x}`).not.toBe('grass');
  });

  it('AC2 Parkside streets carry on from the old streets in at least four places', () => {
    // A join: a two-tile road crossing the old south road's edge (row 38 into row 39).
    const joins: number[] = [];
    for (let x = 0; x < world.width - 1; x++)
      if (road(x, 38) && road(x, 39) && road(x + 1, 39) && !road(x - 1, 39)) joins.push(x);
    expect(joins.length).toBeGreaterThanOrEqual(4);
    for (const x of joins) expect(road(x + 2, 39), `join at ${x} is two wide`).toBe(false);
  });

  it('AC2 every Parkside road node can be driven to from the police car', () => {
    const car = buildRoadGraph(world, 'car');
    const pc = world.markers['police-car']!;
    const start = car.nearest({ x: pc.gx, y: pc.gy });
    let parksideNodes = 0;
    for (const n of car.nodes.values()) {
      if (n.y < OY) continue;
      parksideNodes++;
      expect(car.path(start.id, n.id), n.id).not.toBeNull();
    }
    expect(parksideNodes).toBeGreaterThan(50);
    for (const id of ['traffic-7', 'traffic-8']) {
      const m = world.markers[id]!;
      const n = car.nearest({ x: m.gx, y: m.gy });
      expect(Math.hypot(n.x - m.gx, n.y - m.gy), id).toBeLessThan(0.01);
      expect(inParkside(m), id).toBe(true);
    }
  });

  it('AC3 every Parkside person and errand spot can be walked to from the spawn', () => {
    const grid = buildWalkGrid(world);
    const pf = new PathFinder(grid);
    for (const id of ['school-kid', 'kite-kid', 'gardener', 'pet-shop', 'ball-spot', 'kite-spot']) {
      const m = world.markers[id];
      expect(m, id).toBeDefined();
      expect(inParkside(m!), id).toBe(true);
      expect(grid.isWalkable(Math.floor(m!.gx), Math.floor(m!.gy)), id).toBe(true);
      const path = pf.find({ x: world.spawn.gx, y: world.spawn.gy }, { x: m!.gx, y: m!.gy });
      expect(path && path.length > 0, id).toBe(true);
    }
  });

  it('AC3 strollers keep to walkable ground and never walk through a building', () => {
    const grid = buildWalkGrid(world);
    const mine = world.walkers.filter((w) => w.id.startsWith('ps-'));
    expect(mine.length).toBeGreaterThanOrEqual(5);
    for (const w of mine) {
      for (let k = 0; k <= 40; k++) {
        const x = w.from.gx + ((w.to.gx - w.from.gx) * k) / 40;
        const y = w.from.gy + ((w.to.gy - w.from.gy) * k) / 40;
        expect(grid.isWalkable(Math.floor(x), Math.floor(y)), `${w.id} @${x},${y}`).toBe(true);
        expect(tileAt(world, Math.floor(x), Math.floor(y)), `${w.id} @${x},${y}`).not.toBe('road');
      }
    }
  });

  it('AC4 the landmarks are there, on land and off the roads', () => {
    const kinds = new Set(parkside.buildings.map((b) => b.kind));
    for (const k of ['home', 'school', 'playground', 'icecream', 'petshop', 'library', 'garden'])
      expect(kinds.has(k as never), k).toBe(true);
    expect(parkside.buildings.filter((b) => b.kind === 'home').length).toBeGreaterThanOrEqual(8);
    for (const b of world.buildings.filter((x) => parksideIds.has(x.id))) {
      for (let y = b.gy; y < b.gy + b.d; y++)
        for (let x = b.gx; x < b.gx + b.w; x++) {
          const t = tileAt(world, x, y);
          expect(t === 'road' || t === 'water', `${b.id} on ${t} at ${x},${y}`).toBe(false);
        }
    }
    // Nothing from the old districts or the sea is left standing on Parkside's ground.
    for (const b of world.buildings.filter((x) => !parksideIds.has(x.id)))
      expect(inParkside(b) || inParkside({ gx: b.gx, gy: b.gy + b.d - 1 }), b.id).toBe(false);
    for (const p of world.props.filter((x) => !x.id.startsWith('ps-')))
      expect(inParkside(p), p.id).toBe(false);
  });

  it('AC5 the three errands are valid, with pictures, voice lines, people and spots', () => {
    const ids = ['find-ball', 'find-kite', 'deliver-carrots'];
    for (const id of ids) {
      const e = content.errands.find((x) => x.id === id);
      expect(e, id).toBeDefined();
      expect(content.voice[e!.voice!], id).toBeTruthy();
      expect(inParkside(world.markers[e!.giver]!), e!.giver).toBe(true);
      if (e!.spot) expect(inParkside(world.markers[e!.spot]!), e!.spot).toBe(true);
      if (e!.destination)
        expect(inParkside(world.markers[e!.destination]!), e!.destination).toBe(true);
      // Offered from the start, so the new neighborhood has a reason to visit straight away.
      expect(e!.after, id).toBeUndefined();
      expect(e!.job, id).toBeUndefined();
    }
    // No other errand uses the same item (handing over gives away every one you carry).
    const items = content.errands.map((e) => e.item);
    for (const item of ['ball', 'kite', 'carrot'])
      expect(
        items.filter((i) => i === item),
        item,
      ).toHaveLength(1);
  });

  it('AC6 the boat can reach every rescue and sail round to the new south coast', () => {
    const sea = buildSeaGrid(world, new Set(['dock']));
    const pf = new PathFinder(sea);
    const from = world.markers['rescue-boat']!;
    const to = [
      ...['floaty-1', 'floaty-2', 'floaty-3', 'sailboat', 'castaway', 'barge'].map(
        (id) => world.markers[id]!,
      ),
      { gx: 30.5, gy: 64.5 }, // off Parkside's beach road
      { gx: 3.5, gy: 66.5 }, // the far south-west corner
    ];
    for (const m of to) {
      const path = pf.find({ x: from.gx, y: from.gy }, { x: m.gx, y: m.gy });
      expect(path, `${m.gx},${m.gy}`).not.toBeNull();
    }
    // The islands that used to sit where Parkside is now lie off its coast.
    for (const id of ['palm-4', 'rock-2']) {
      const b = world.buildings.find((x) => x.id === id)!;
      expect(b.gy, id).toBeGreaterThan(60);
      expect(tileAt(world, b.gx, b.gy), id).toBe('sand');
    }
  });
});
