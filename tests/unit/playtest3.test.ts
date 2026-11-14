import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content';
import { tileAt } from '../../src/content/schema';
import { buildRoadGraph, buildSeaGrid, buildWalkGrid, loadWorld } from '../../src/content/world';
import { PathFinder } from '../../src/iso/path';
import { BOAT, BoatModel } from '../../src/systems/boat';
import { BuildJobModel, TOOL_FOR } from '../../src/systems/buildJob';
import { arrowPlace, GUIDE, ObjectiveGuide } from '../../src/systems/guide';
import { NEED_UPGRADE_LINE } from '../../src/systems/jobs';
import { TH, TrafficHelperModel } from '../../src/systems/minigames';
import { isJobMission, rescueOffer, rescuesOpen } from '../../src/systems/missions';
import { Hearts, heartsFor, levelFor, ROUND, starMeter, Streak } from '../../src/systems/round';
import { CementPourModel, CopyBuildModel } from '../../src/systems/builderMinigames';
import { WindowSplashModel } from '../../src/systems/fireMinigames';

const world = loadWorld();
const content = loadContent();

describe('spec 008 AC1: the boss names the right upgrade', () => {
  it('has a different need line per job, and each line exists', () => {
    expect(NEED_UPGRADE_LINE.fire).toBe('chief-need-ladder');
    expect(NEED_UPGRADE_LINE.builder).toBe('chief-need-drum');
    expect(new Set(Object.values(NEED_UPGRADE_LINE)).size).toBe(3);
    for (const l of Object.values(NEED_UPGRADE_LINE)) expect(content.voice[l], l).toBeTruthy();
    expect(content.voice['chief-need-ladder']).toMatch(/ladder/i);
    expect(content.voice['chief-need-ladder']).not.toMatch(/bike/i);
  });

  it("each job's Pro missions wait on that job's own Shop item", () => {
    for (const job of ['cop', 'fire', 'builder'] as const) {
      const item = content.shop.find((i) => i.job === job && i.tab === 'job')!;
      const pro = content.missions.filter((m) => m.job === job && m.tier === 'pro');
      expect(pro.length).toBe(3);
      for (const m of pro) expect(m.requires).toContain(`owned:${item.id}`);
    }
  });
});

describe('spec 008 AC4: the bigger world', () => {
  it('is at least 45% bigger in tiles than 48 × 32, with roads still two tiles wide', () => {
    expect(world.width * world.height).toBeGreaterThanOrEqual(48 * 32 * 1.45);
    // No road tile has road on both sides across its width three deep (i.e. no 3-wide roads).
    const road = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < world.width && y < world.height && tileAt(world, x, y) === 'road';
    for (let y = 0; y < world.height; y++)
      for (let x = 0; x < world.width; x++) {
        if (!road(x, y)) continue;
        const wide = road(x - 1, y) && road(x + 1, y) && road(x, y - 1) && road(x, y + 1);
        // Only junction cells have road on all four sides; they sit in 2×2 groups.
        if (wide)
          expect(
            road(x - 1, y - 1) || road(x + 1, y + 1) || road(x - 1, y + 1) || road(x + 1, y - 1),
          ).toBe(true);
      }
  });

  it('every job vehicle starts on a road node, and all roads are one network', () => {
    const car = buildRoadGraph(world, 'car');
    const start = car.nearest({
      x: world.markers['police-car']!.gx,
      y: world.markers['police-car']!.gy,
    });
    for (const id of ['police-car', 'fire-truck', 'mixer-truck', 'own-car', 'parade-start']) {
      const m = world.markers[id]!;
      const n = car.nearest({ x: m.gx, y: m.gy });
      expect(Math.hypot(n.x - m.gx, n.y - m.gy), id).toBeLessThan(0.01);
      expect(car.path(start.id, n.id), id).not.toBeNull();
    }
    for (const n of car.nodes.values()) expect(car.path(start.id, n.id), n.id).not.toBeNull();
  });

  it('everyone you talk to and every pad can be walked to from the spawn', () => {
    const grid = buildWalkGrid(world);
    const pf = new PathFinder(grid);
    const ids = [
      'chief',
      'fire-chief',
      'foreman',
      'mayor',
      'lifeguard',
      'shop',
      'job-center',
      'home-door',
      'mission-board',
      'fire-board',
      'builder-board',
      'traffic-helper',
      'who-took-it',
      'window-splash',
      'ladder-rescue',
      'block-stack',
      'copy-the-build',
      'cement-pour',
      'toaster-door',
      'pond',
      'ducks',
      'parade-stand',
    ];
    for (const id of ids) {
      const m = world.markers[id];
      expect(m, id).toBeDefined();
      expect(grid.isWalkable(Math.floor(m!.gx), Math.floor(m!.gy)), id).toBe(true);
      const path = pf.find({ x: world.spawn.gx, y: world.spawn.gy }, { x: m!.gx, y: m!.gy });
      expect(path && path.length > 0, id).toBe(true);
    }
  });

  it('every marker and perch a mission names exists', () => {
    const perches = new Set(world.perches.map((p) => p.id));
    for (const m of content.missions)
      for (const g of m.goals) {
        if (g.type === 'goTo')
          expect(world.markers[g.target], `${m.id}: ${g.target}`).toBeDefined();
        if (g.type === 'checkpoints')
          for (const f of g.flags) expect(world.markers[f], `${m.id}: ${f}`).toBeDefined();
        if (g.type === 'spray')
          for (const f of g.fires) expect(perches.has(f), `${m.id}: ${f}`).toBe(true);
      }
  });

  it('pads moved out to the kerb, away from the people by the doors', () => {
    const pad = world.markers['who-took-it']!;
    const chief = world.markers.chief!;
    expect(Math.hypot(pad.gx - chief.gx, pad.gy - chief.gy)).toBeGreaterThan(2);
  });
});

describe('spec 008 AC5: objective guide', () => {
  const far = (dist: number, key = 'flag-1') => ({ key, dist, urgent: true });

  it('shows after 5 s without getting closer, and stays until the player arrives', () => {
    const g = new ObjectiveGuide();
    for (let t = 0; t < 4.9; t += 0.1) expect(g.update(0.1, far(20))).toBe(false);
    expect(g.update(0.2, far(20))).toBe(true);
    // Getting closer does not hide it...
    expect(g.update(0.1, far(12))).toBe(true);
    expect(g.update(0.1, far(5))).toBe(true);
    // ...arriving does.
    expect(g.update(0.1, far(GUIDE.arriveDist - 0.1))).toBe(false);
  });

  it('never shows while the player keeps making progress', () => {
    const g = new ObjectiveGuide();
    let d = 40;
    for (let t = 0; t < 12; t += 0.1) {
      d -= 0.3;
      expect(g.update(0.1, far(d))).toBe(false);
    }
  });

  it('a new objective starts the clock again; no objective hides it', () => {
    const g = new ObjectiveGuide();
    g.update(6, far(20));
    expect(g.showing).toBe(true);
    expect(g.update(0.1, far(20, 'flag-2'))).toBe(false);
    g.update(6, far(20, 'flag-2'));
    expect(g.showing).toBe(true);
    expect(g.update(0.1, null)).toBe(false);
  });

  it('waits longer when no mission is running', () => {
    const g = new ObjectiveGuide();
    g.update(6, { key: 'chief', dist: 20, urgent: false });
    expect(g.showing).toBe(false);
    g.update(7, { key: 'chief', dist: 20, urgent: false });
    expect(g.showing).toBe(true);
  });

  it('places the arrow on the target on screen, and on the edge pointing at it off screen', () => {
    const m = { left: 70, right: 230, top: 120, bottom: 70 };
    const on = arrowPlace({ x: 500, y: 400 }, 1280, 720, m);
    expect(on).toMatchObject({ x: 500, y: 400, onScreen: true });
    const right = arrowPlace({ x: 3000, y: 360 }, 1280, 720, m);
    expect(right.onScreen).toBe(false);
    expect(right.x).toBeCloseTo(1280 - 230, 5);
    expect(right.angle).toBeCloseTo(0, 5);
    const up = arrowPlace({ x: 640, y: -900 }, 1280, 720, m);
    expect(up.y).toBeCloseTo(120, 5);
    expect(up.angle).toBeCloseTo(-Math.PI / 2, 5);
    const corner = arrowPlace({ x: -2000, y: 3000 }, 1280, 720, m);
    expect(corner.x).toBeGreaterThanOrEqual(70 - 1e-6);
    expect(corner.y).toBeLessThanOrEqual(720 - 70 + 1e-6);
  });
});

describe('spec 008 AC6: the rescue boat', () => {
  const mooring = { x: world.markers['rescue-boat']!.gx, y: world.markers['rescue-boat']!.gy };

  it('moors on open water right beside the dock', () => {
    const sea = buildSeaGrid(world, new Set(['dock']));
    expect(sea.circleFits(mooring.x, mooring.y, BOAT.radius)).toBe(true);
    const dock = world.buildings.find((b) => b.id === 'dock')!;
    const walk = buildWalkGrid(world, new Set(['dock']));
    // A dock tile you can stand on is within hopping distance.
    let best = Infinity;
    for (let y = dock.gy; y < dock.gy + dock.d; y++)
      for (let x = dock.gx; x < dock.gx + dock.w; x++)
        if (walk.isWalkable(x, y))
          best = Math.min(best, Math.hypot(x + 0.5 - mooring.x, y + 0.5 - mooring.y));
    expect(best).toBeLessThan(2.2);
  });

  it('speeds up toward the stick, glides to a stop, and never leaves the water', () => {
    const sea = buildSeaGrid(world, new Set(['dock']));
    const b = new BoatModel(sea, mooring);
    for (let i = 0; i < 120; i++) b.update(1 / 60, { x: 1, y: 0.4 });
    expect(b.speed).toBeGreaterThan(3);
    expect(b.pos.x).toBeGreaterThan(mooring.x + 3);
    for (let i = 0; i < 400; i++) b.update(1 / 60, null);
    expect(b.speed).toBe(0);
    // Push it at the shore from every side for a long time: always on water.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    let stick = { x: -1, y: 0 };
    for (let i = 0; i < 60 * 90; i++) {
      if (i % 80 === 0) stick = { x: rnd(), y: rnd() };
      b.update(1 / 60, stick);
      expect(tileAt(world, Math.floor(b.pos.x), Math.floor(b.pos.y)), JSON.stringify(b.pos)).toBe(
        'water',
      );
      expect(sea.circleFits(b.pos.x, b.pos.y, BOAT.radius - 1e-6)).toBe(true);
    }
  });

  it('cannot sail through the dock once it is built, or onto land', () => {
    const dock = world.buildings.find((b) => b.id === 'dock')!;
    const open = buildSeaGrid(world);
    const built = buildSeaGrid(world, new Set(['dock']));
    expect(open.isWalkable(dock.gx, dock.gy)).toBe(true);
    expect(built.isWalkable(dock.gx, dock.gy)).toBe(false);
    const b = new BoatModel(built, mooring);
    expect(b.goToward({ x: 6.5, y: 6.5 })).toBe(false); // downtown
  });

  it('tap-to-go sails to a point on the water and stops there', () => {
    const sea = buildSeaGrid(world, new Set(['dock']));
    const b = new BoatModel(sea, mooring);
    const to = { x: mooring.x + 4, y: mooring.y + 3 };
    expect(b.goToward(to)).toBe(true);
    for (let i = 0; i < 600 && b.target; i++) b.update(1 / 60, null);
    expect(Math.hypot(b.pos.x - to.x, b.pos.y - to.y)).toBeLessThan(0.6);
  });

  it('every rescue point is on open water the boat can reach from the dock', () => {
    const sea = buildSeaGrid(world, new Set(['dock', 'bridge']));
    const pf = new PathFinder(sea);
    for (const id of ['dock-landing', 'castaway', 'floaty-1', 'floaty-2', 'floaty-3', 'sailboat']) {
      const m = world.markers[id]!;
      expect(sea.circleFits(m.gx, m.gy, BOAT.radius), id).toBe(true);
      expect(pf.find(mooring, { x: m.gx, y: m.gy })?.length, id).toBeGreaterThan(0);
    }
    for (const id of ['barge-fire-1', 'barge-fire-2']) {
      const p = world.perches.find((x) => x.id === id)!;
      // Open water within hose reach of each barge fire.
      let ok = false;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++)
          if (Math.hypot(dx, dy) <= 3 && sea.circleFits(p.gx + dx, p.gy + dy, BOAT.radius))
            ok = true;
      expect(ok, id).toBe(true);
    }
  });
});

describe('spec 008 AC7: lifeguard rescues', () => {
  const dock = { badges: [], owned: ['built:dock'], missionsDone: {} as Record<string, number> };

  it('are extra: not job missions, not needed for the finale', () => {
    const rescues = content.missions.filter((m) => m.tier === 'rescue');
    expect(rescues.map((m) => m.id).sort()).toEqual(
      ['barge-blaze', 'castaway-cat', 'duckling-patrol', 'sailboat-tow'].sort(),
    );
    for (const m of rescues) expect(isJobMission(m)).toBe(false);
    const finale = content.missions.find((m) => m.id === 'finale-tower-fire')!;
    for (const m of rescues) expect(finale.requires).not.toContain(m.id);
    for (const m of rescues) {
      expect(content.voice[m.voiceIntro], m.voiceIntro).toBeTruthy();
      expect(content.voice[m.voiceDone], m.voiceDone).toBeTruthy();
    }
  });

  it('open with the dock; fire and cop get their own; a builder gets none', () => {
    const none = { badges: [], owned: [], missionsDone: {} };
    expect(rescuesOpen(content.missions, none)).toBe(false);
    expect(rescueOffer(content.missions, 'fire', none)).toBeNull();
    expect(rescuesOpen(content.missions, dock)).toBe(true);
    expect(rescueOffer(content.missions, 'fire', dock)?.id).toBe('barge-blaze');
    expect(rescueOffer(content.missions, 'cop', dock)?.id).toBe('duckling-patrol');
    expect(rescueOffer(content.missions, 'builder', dock)).toBeNull();
  });

  it('offers the next one not done, then goes round again', () => {
    const one = { ...dock, missionsDone: { 'barge-blaze': 1 } };
    expect(rescueOffer(content.missions, 'fire', one)?.id).toBe('castaway-cat');
    const both = { ...dock, missionsDone: { 'barge-blaze': 1, 'castaway-cat': 2 } };
    expect(rescueOffer(content.missions, 'fire', both, 0)?.id).toBe('barge-blaze');
    expect(rescueOffer(content.missions, 'fire', both, 1)?.id).toBe('castaway-cat');
  });
});

describe('spec 008 AC8: Build It!', () => {
  it('every build spot has a blueprint, with all three materials used somewhere', () => {
    const sites = world.buildings.filter((b) => b.site).map((b) => b.id);
    for (const id of sites)
      expect(
        content.blueprints.find((b) => b.id === id),
        id,
      ).toBeDefined();
    const mats = new Set(content.blueprints.flatMap((b) => b.pieces.map((p) => p.material)));
    expect([...mats].sort()).toEqual(['brick', 'steel', 'wood']);
  });

  const pieces = content.blueprints.find((b) => b.id === 'dock')!.pieces;
  const centre = (i: number) => ({
    x: pieces[i]!.x + pieces[i]!.w / 2,
    y: pieces[i]!.y + pieces[i]!.h / 2,
  });

  it('a piece only goes into a slot of its material and size, near where it is dropped', () => {
    const m = new BuildJobModel(pieces);
    const steel = pieces.findIndex((p) => p.material === 'steel');
    const wood = pieces.findIndex((p) => p.material === 'wood' && p.w === 2);
    // Far from everything: back to the tray.
    expect(m.drop(steel, 40, 40)).toEqual({ type: 'missed', piece: steel });
    // Right on a wood slot: wrong kind.
    expect(m.drop(steel, centre(wood).x, centre(wood).y - 0.2)?.type).toMatch(/wrongSlot|placed/);
    const m2 = new BuildJobModel(pieces);
    const woodOnly = { x: centre(wood).x, y: centre(wood).y };
    const far = pieces.every(
      (p, i) =>
        p.material !== 'steel' ||
        Math.hypot(centre(i).x - woodOnly.x, centre(i).y - woodOnly.y) > m2.snap,
    );
    if (far)
      expect(m2.drop(steel, woodOnly.x, woodOnly.y)).toEqual({ type: 'wrongSlot', piece: steel });
    // Near its own slot: it snaps in.
    const ev = m2.drop(steel, centre(steel).x + 0.4, centre(steel).y + 0.3);
    expect(ev).toMatchObject({ type: 'placed', piece: steel });
    expect(m2.pending).toBe(steel);
  });

  it('one piece at a time: the next cannot be picked up until this one is fixed', () => {
    const m = new BuildJobModel(pieces);
    m.drop(0, centre(0).x, centre(0).y);
    expect(m.canDrag(1)).toBe(false);
    expect(m.drop(1, centre(1).x, centre(1).y)).toBeNull();
    m.fasten(TOOL_FOR[pieces[0]!.material]);
    expect(m.canDrag(1)).toBe(true);
  });

  it('wrong tools never fix it; after two the right one is pointed out; the right one fixes', () => {
    const m = new BuildJobModel(pieces);
    const wood = pieces.findIndex((p) => p.material === 'wood');
    m.drop(wood, centre(wood).x, centre(wood).y);
    expect(m.toolNeeded).toBe('hammer');
    expect(m.fasten('wrench')).toEqual({ type: 'wrongTool', tool: 'wrench', hint: null });
    expect(m.fasten('trowel')).toEqual({ type: 'wrongTool', tool: 'trowel', hint: 'hammer' });
    expect(m.fixedCount).toBe(0);
    expect(m.fasten('hammer')).toMatchObject({ type: 'fixed', piece: wood, done: false });
    expect(m.fixedCount).toBe(1);
    expect(m.fasten('hammer')).toBeNull(); // nothing waiting
  });

  it('can always be finished, and identical pieces fit one another', () => {
    for (const bp of content.blueprints) {
      const m = new BuildJobModel(bp.pieces);
      let guard = 0;
      while (!m.done && guard++ < 50) {
        expect(m.placeNext(), bp.id).not.toBeNull();
        m.fasten(m.toolNeeded!);
      }
      expect(m.done, bp.id).toBe(true);
      expect(m.progress).toBe(1);
    }
    const m = new BuildJobModel(pieces);
    const planks = pieces
      .map((p, i) => ({ p, i }))
      .filter((x) => x.p.material === 'wood' && x.p.w === 2);
    // Plank A dropped on plank B's slot.
    expect(m.drop(planks[0]!.i, centre(planks[1]!.i).x, centre(planks[1]!.i).y)).toMatchObject({
      type: 'placed',
      slot: planks[1]!.i,
    });
  });

  it('the giant drum snaps from further away', () => {
    expect(new BuildJobModel(pieces, true).snap).toBeGreaterThan(new BuildJobModel(pieces).snap);
  });
});

describe('spec 008 AC2/AC3: rounds, hearts and levels', () => {
  it('every minigame has its round settings; six have hearts', () => {
    expect(content.minigames.filter((m) => m.hearts > 0)).toHaveLength(6);
    expect(content.minigames.find((m) => m.id === 'copy-the-build')!.hearts).toBe(0);
    for (const m of content.minigames) {
      expect(m.levelEvery).toBeGreaterThan(0);
      // Three stars are within reach before the top level.
      expect(levelFor(m.tiers[2], m.levelEvery)).toBeLessThanOrEqual(ROUND.maxLevel);
    }
  });

  it('hearts: lose to none = out; more on each retry; none for a game without them', () => {
    const h = new Hearts(3);
    expect(h.lose()).toBe(false);
    expect(h.lose()).toBe(false);
    expect(h.out).toBe(false);
    expect(h.lose()).toBe(true);
    expect(h.out).toBe(true);
    expect(h.lose()).toBe(false);
    expect(heartsFor(3, 0)).toBe(3);
    expect(heartsFor(3, 1)).toBe(5);
    expect(heartsFor(3, 9)).toBe(3 + ROUND.maxExtraHearts);
    expect(heartsFor(0, 3)).toBe(0);
    const none = new Hearts(0);
    expect(none.lose()).toBe(false);
    expect(none.out).toBe(false);
  });

  it('a streak of five wins a heart back, but never more than the round started with', () => {
    const h = new Hearts(3);
    const s = new Streak();
    h.lose();
    let won = 0;
    for (let i = 0; i < 10; i++) if (s.hit() && h.gain()) won++;
    expect(won).toBe(1);
    expect(h.left).toBe(3);
    s.miss();
    expect(s.n).toBe(0);
  });

  it('levels and the star meter follow the score', () => {
    expect(levelFor(0, 4)).toBe(1);
    expect(levelFor(3, 4)).toBe(1);
    expect(levelFor(4, 4)).toBe(2);
    expect(levelFor(999, 4)).toBe(ROUND.maxLevel);
    expect(starMeter(0, [0, 8, 16])).toEqual({ fill: 0, mark2: 0.5, stars: 1 });
    expect(starMeter(8, [0, 8, 16])).toEqual({ fill: 0.5, mark2: 0.5, stars: 2 });
    expect(starMeter(40, [0, 8, 16])).toEqual({ fill: 1, mark2: 0.5, stars: 3 });
  });
});

describe('spec 008 AC3: Traffic Helper ("Ducks Crossing") failure', () => {
  /** Run until someone is part-way across with the cars held at red. */
  function crossing(t: number): TrafficHelperModel {
    const m = new TrafficHelperModel(120, 0, 0.1, () => 0.3);
    m.toggleLight(); // red
    for (let i = 0; i < 60 * 30; i++) {
      m.update(1 / 60);
      if (m.walkers.some((w) => w.state === 'crossing' && w.t >= t)) return m;
    }
    throw new Error('nobody crossed');
  }

  it('cars wait at red while walkers cross, and walkers score', () => {
    const m = new TrafficHelperModel(120, 0, 0.1, () => 0.3);
    m.toggleLight();
    for (let i = 0; i < 60 * 20; i++) m.update(1 / 60);
    expect(m.score).toBeGreaterThan(2);
    expect(m.scares).toBe(0);
    for (const c of m.cars) expect(c.x).toBeLessThanOrEqual(TH.stopLine + 1e-6);
  });

  it('green while someone is crossing: the car scares them back to the kerb (a heart)', () => {
    const m = crossing(0.5);
    expect(m.cars.length).toBeGreaterThan(0);
    const before = m.score;
    m.toggleLight(); // green too soon
    const events = [];
    for (let i = 0; i < 60 * 2; i++) events.push(...m.update(1 / 60));
    const scare = events.find((e) => e.type === 'scare');
    expect(scare).toMatchObject({ type: 'scare', hurt: true });
    expect(m.scares).toBe(1);
    expect(m.score).toBe(before);
    expect(m.walkers.some((w) => w.state === 'crossing')).toBe(false);
  });

  it('someone who has only just stepped out hops back without a heart', () => {
    const m = crossing(0.01);
    m.toggleLight();
    const events = [];
    for (let i = 0; i < 30; i++) events.push(...m.update(1 / 60));
    const scare = events.find((e) => e.type === 'scare');
    if (scare) expect(scare).toMatchObject({ hurt: false });
    expect(m.scares).toBe(0);
  });

  it('gets busier each level', () => {
    const a = new TrafficHelperModel(120, 0, 0.1);
    const b = new TrafficHelperModel(120, 0, 0.1);
    b.level = 4;
    expect(b.pace).toBeGreaterThan(a.pace);
  });
});

describe('spec 008: other minigames ramp up and report mistakes', () => {
  it('Window Splash counts flames that burn down, and speeds up by level', () => {
    const m = new WindowSplashModel(100, 0, 0.15, () => 0.4);
    for (let i = 0; i < 60 * 6; i++) m.update(1 / 60);
    expect(m.fizzled).toBeGreaterThan(0);
    const base = m.everySec;
    m.level = 5;
    expect(m.everySec).toBeLessThan(base);
    expect(m.maxUp).toBeGreaterThan(new WindowSplashModel(100, 0, 0.15).maxUp);
  });

  it('Cement Pour says when it spilled over the top', () => {
    const m = new CementPourModel(90, 0, () => 0.5);
    m.press();
    for (let i = 0; i < 60 * 4; i++) m.update(1 / 60);
    expect(m.release()).toMatchObject({ type: 'poured', spilled: true });
    const ok = new CementPourModel(90, 0, () => 0.5);
    ok.press();
    for (let i = 0; i < 60; i++) ok.update(1 / 60);
    expect(ok.release()).toMatchObject({ spilled: false });
  });

  it('Copy the Build pictures grow to 3×3 at level 3', () => {
    const m = new CopyBuildModel(110, 0);
    expect(m.size).toBe(2);
    m.level = 3;
    m.newPicture();
    expect(m.size).toBe(3);
    expect(m.grid).toHaveLength(9);
  });
});
