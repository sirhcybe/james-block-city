import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content';
import { tileAt } from '../../src/content/schema';
import { buildRoadGraph, buildWalkGrid, loadWorld } from '../../src/content/world';
import { PathFinder } from '../../src/iso/path';
import { FIRE, FireState, pickFire, reach, tooHigh } from '../../src/systems/fire';
import { LadderRescueModel, LR, WindowSplashModel } from '../../src/systems/fireMinigames';
import { GameState } from '../../src/systems/GameState';
import { canSwitch, jobAvailable, outfitFor, uniformState } from '../../src/systems/jobs';
import { earnedBadges, isUnlocked, nextMission, type Progress } from '../../src/systems/missions';

const content = loadContent();
const world = loadWorld();
const storage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};
const progress = (p: Partial<Progress> = {}): Progress => ({
  badges: [],
  owned: [],
  missionsDone: {},
  ...p,
});
const fire = content.missions.filter((m) => m.job === 'fire' && m.tier !== 'finale');

describe('Job Center rules (AC1)', () => {
  it('no switching before the first badge; jobs without missions stay locked', () => {
    expect(canSwitch([])).toBe(false);
    expect(canSwitch(['cop'])).toBe(true);
    expect(jobAvailable('fire', content.missions)).toBe(true);
    expect(uniformState('fire', 'cop', [], content.missions)).toBe('locked');
    expect(uniformState('fire', 'cop', ['cop'], content.missions)).toBe('open');
    expect(uniformState('cop', 'cop', ['cop'], content.missions)).toBe('current');
    expect(uniformState('builder', 'cop', ['cop'], [{ job: 'cop' }])).toBe('locked');
  });

  it('the outfit follows the job (plain clothes until the cop cap)', () => {
    expect(outfitFor('cop', [])).toBe('playerPlain');
    expect(outfitFor('cop', ['cap-cop'])).toBe('player');
    expect(outfitFor('fire', [])).toBe('playerFire');
  });

  it('GameState.switchJob saves the job, and the shop shows that job’s upgrade (AC2)', () => {
    const st = storage();
    const g = new GameState(content, st);
    expect(g.switchJob('fire')).toBe(false);
    g.save.update((s) => s.badges.push('cop'));
    expect(g.shopTab('job').map((i) => i.id)).toEqual(['police-bike']);
    expect(g.switchJob('fire')).toBe(true);
    expect(g.job).toBe('fire');
    expect(g.shopTab('job').map((i) => i.id)).toEqual(['long-ladder']);
    expect(g.nextMission()?.id).toBe('siren-school');
    expect(new GameState(content, st).job).toBe('fire');
  });
});

describe('Fire missions content (AC6–AC8, AC12)', () => {
  it('has 3 Rookie then 3 Pro Fire missions in order', () => {
    expect(fire.map((m) => m.id)).toEqual([
      'siren-school',
      'kitty-floor-10',
      'toaster-trouble',
      'barbecue-blaze',
      'fireworks-fiasco',
      'tallest-tower',
    ]);
    expect(fire.map((m) => m.tier)).toEqual(['rookie', 'rookie', 'rookie', 'pro', 'pro', 'pro']);
  });

  it('every goal points at something on the map', () => {
    const markers = new Set(Object.keys(world.markers));
    const perches = new Set(world.perches.map((p) => p.id));
    for (const m of fire) {
      for (const g of m.goals) {
        if (g.type === 'spray')
          for (const f of g.fires) expect(perches.has(f), `${m.id} fire ${f}`).toBe(true);
        if (g.type === 'rescue') {
          expect(markers.has(g.at), `${m.id} ${g.at}`).toBe(true);
          expect(perches.has(g.perch), `${m.id} ${g.perch}`).toBe(true);
        }
        if (g.type === 'inside') expect(markers.has(g.at), `${m.id} ${g.at}`).toBe(true);
        if (g.type === 'checkpoints')
          for (const f of g.flags) expect(markers.has(f), `${m.id} ${f}`).toBe(true);
        if (g.type === 'goTo') expect(markers.has(g.target), `${m.id} ${g.target}`).toBe(true);
        if (g.type === 'minigame') expect(markers.has(g.id), `${m.id} ${g.id}`).toBe(true);
      }
    }
    for (const id of ['fire-chief', 'fire-truck', 'fire-board', 'window-splash', 'ladder-rescue'])
      expect(markers.has(id), id).toBe(true);
  });

  it('Pro Fire missions need the Fire badge AND the extra-long ladder; the badge needs 3 Rookies', () => {
    const rookies = { 'siren-school': 1, 'kitty-floor-10': 1, 'toaster-trouble': 1 };
    const bb = fire.find((m) => m.id === 'barbecue-blaze')!;
    expect(isUnlocked(bb, progress({ missionsDone: rookies, badges: ['fire'] }))).toBe(false);
    expect(isUnlocked(bb, progress({ badges: ['fire'], owned: ['long-ladder'] }))).toBe(true);
    expect(earnedBadges(content.missions, progress({ missionsDone: rookies }))).toContain('fire');
    expect(
      nextMission(content.missions, 'fire', progress({ missionsDone: { 'siren-school': 1 } }))?.id,
    ).toBe('kitty-floor-10');
  });

  it('2 new Fire errands, each after a Fire mission (AC11)', () => {
    const fe = content.errands.filter((e) => e.job === 'fire');
    expect(fe.map((e) => e.id).sort()).toEqual(['deliver-cake', 'find-balloon']);
    for (const e of fe) expect(fire.map((m) => m.id)).toContain(e.after);
  });
});

describe('Fire and hose (AC5)', () => {
  it('a burst puts a fire out bit by bit; left alone it grows back a little', () => {
    const f = new FireState();
    f.startBurst();
    expect(f.update(0.5, true)).toBe(false);
    expect(f.hp).toBeCloseTo(1 - FIRE.rate * 0.5);
    const hp = f.hp;
    f.update(2, false);
    expect(f.hp).toBeGreaterThan(hp);
    let out = false;
    for (let i = 0; i < 60 && !out; i++) out = f.update(0.1, true);
    expect(out).toBe(true);
    expect(f.out).toBe(true);
  });

  it('after 3 bursts it gets easier: sprays twice as hard and stops growing back', () => {
    const f = new FireState();
    for (let i = 0; i < 3; i++) f.startBurst();
    expect(f.easier).toBe(true);
    f.update(0.25, true);
    expect(f.hp).toBeCloseTo(1 - FIRE.rate * FIRE.easierRate * 0.25);
    const hp = f.hp;
    f.update(5, false);
    expect(f.hp).toBe(hp);
  });

  it('reach depends on distance, height and the ladder', () => {
    const ground = { id: 'g', x: 2, y: 0, z: 0 };
    const high = { id: 'h', x: 1, y: 0, z: 12 };
    const me = { x: 0, y: 0 };
    expect(reach(me, 'foot', 'standard', ground)).toBe('ok');
    expect(reach({ x: -5, y: 0 }, 'foot', 'standard', ground)).toBe('far');
    expect(reach(me, 'foot', 'standard', { ...ground, z: 4 })).toBe('high');
    expect(reach(me, 'truck', 'standard', high)).toBe('high');
    expect(reach(me, 'truck', 'long', high)).toBe('ok');
    expect(pickFire(me, 'truck', 'standard', [high, ground])).toBe('g');
    expect(tooHigh(me, 'truck', 'standard', [high])).toBe('h');
  });

  it('every Rookie fire and pet is in reach of the standard ladder; the tallest needs the long one', () => {
    const z = (id: string) => world.perches.find((p) => p.id === id)!.z;
    for (const id of ['practice-fire', 'kitty-perch', 'fw-1', 'fw-2', 'fw-3', 'fw-4', 'bbq-1'])
      expect(z(id), id).toBeLessThanOrEqual(FIRE.ladderZ.standard);
    expect(z('tallest-fire')).toBeGreaterThan(FIRE.ladderZ.standard);
    expect(z('tallest-fire')).toBeLessThanOrEqual(FIRE.ladderZ.long);
  });
});

describe('Window Splash (AC10)', () => {
  it('tap a flame to splash it; missed flames fizzle by themselves; always finishes', () => {
    const m = new WindowSplashModel(10, 0, 0.15, () => 0.4);
    let popped = -1;
    let fizzled = false;
    let finished = false;
    for (let t = 0; t < 12 && !finished; t += 0.1) {
      for (const e of m.update(0.1)) {
        if (e.type === 'pop' && popped < 0) {
          popped = e.window;
          expect(m.tap(e.window)).toEqual({ type: 'splash', window: e.window });
        }
        if (e.type === 'fizzle') fizzled = true;
        if (e.type === 'finished') finished = true;
      }
    }
    expect(m.score).toBe(1);
    expect(fizzled).toBe(true);
    expect(finished).toBe(true);
    expect(m.tap(0)).toBeNull();
  });

  it('gets harder on replay: shorter flames, more at once', () => {
    const a = new WindowSplashModel(100, 0, 0.15);
    const b = new WindowSplashModel(100, 5, 0.15);
    expect(b.upSec).toBeLessThan(a.upSec);
    expect(b.maxUp).toBeGreaterThan(a.maxUp);
  });
});

describe('Ladder Rescue (AC10)', () => {
  const raiseTo = (m: LadderRescueModel, floors: number) => {
    m.press();
    let t = 0;
    while (m.height < floors && t < 20) {
      m.update(0.01);
      t += 0.01;
    }
    return m.release();
  };

  it('let go at the cat’s floor: saved; too low: a miss, and the same cat waits', () => {
    const m = new LadderRescueModel(100, 0, 0.1, () => 0.5); // cat on floor 5
    m.update(0.01);
    expect(m.cat).toBe(5);
    expect(raiseTo(m, 2)).toMatchObject({ type: 'miss' });
    for (let i = 0; i < 100; i++) m.update(0.01);
    expect(m.cat).toBe(5);
    expect(raiseTo(m, 5)).toEqual({ type: 'saved', floor: 5 });
    expect(m.score).toBe(1);
  });

  it('a quick tap starts the ladder rising; the next tap stops it there (playtest 2026-11-11)', () => {
    const m = new LadderRescueModel(100, 0, 0.1, () => 0.5); // cat on floor 5
    m.update(0.01);
    m.press();
    m.update(0.05);
    expect(m.release()).toBeNull(); // a tap, not a miss
    let t = 0;
    while (m.height < 5 && t < 10) {
      m.update(0.01);
      t += 0.01;
    }
    expect(m.rising).toBe(true);
    expect(m.press()).toEqual({ type: 'saved', floor: 5 });
  });

  it('a press while the ladder is still coming down is kept, not dropped', () => {
    const m = new LadderRescueModel(100, 0, 0.1, () => 0.5);
    m.update(0.01);
    raiseTo(m, 1); // miss: the ladder drops back for a moment
    m.press();
    for (let i = 0; i < 150; i++) m.update(0.01); // 0.8 s coming down, then rising
    expect(m.height).toBeGreaterThan(1);
  });

  it('left rising after a tap, it stops at the top by itself', () => {
    const m = new LadderRescueModel(100, 0, 0.1, () => 0.5);
    m.update(0.01);
    m.press();
    m.release();
    const events = [];
    for (let i = 0; i < 600; i++) events.push(...m.update(0.01));
    expect(events.some((e) => e.type === 'miss')).toBe(true);
    expect(m.rising).toBe(false);
  });

  it('after 3 misses "close enough" gets wider; replays raise faster', () => {
    const m = new LadderRescueModel(100, 0, 0.1, () => 0.5);
    m.update(0.01);
    for (let k = 0; k < 3; k++) {
      raiseTo(m, 1);
      for (let i = 0; i < 100; i++) m.update(0.01);
    }
    expect(m.tolerance).toBe(LR.easyTolerance);
    expect(new LadderRescueModel(100, 5, 0.1).speed).toBeGreaterThan(m.speed);
  });
});

describe('Skyscraper Heights map (AC3)', () => {
  it('is joined to the Plaza and to Downtown by road', () => {
    const car = buildRoadGraph(world, 'car');
    // Breadth-first from the police car's spot reaches the fire truck's spot and the Plaza.
    const start = car.get(6, 10)!;
    const seen = new Set([start.id]);
    const q = [start];
    while (q.length) {
      const n = q.shift()!;
      for (const id of n.links)
        if (!seen.has(id)) {
          seen.add(id);
          q.push(car.node(id));
        }
    }
    const truck = world.markers['fire-truck']!;
    expect(seen.has(`${truck.gx},${truck.gy}`)).toBe(true);
    // At least two separate road links each way: Plaza↔Heights at y=16, Downtown↔Heights at x=16.
    const plazaLinks = [...car.nodes.values()].filter((n) => n.y === 16 && n.x > 16).length;
    const dtLinks = [...car.nodes.values()].filter((n) => n.x === 16 && n.y > 16).length;
    expect(plazaLinks).toBeGreaterThanOrEqual(2);
    expect(dtLinks).toBeGreaterThanOrEqual(2);
    expect(tileAt(world, 22, 20)).toBe('road');
  });

  it('the fire chief, pads and the kitchen door can be walked to from the spawn', () => {
    const pf = new PathFinder(buildWalkGrid(world));
    const s = world.spawn;
    for (const id of [
      'fire-chief',
      'fire-board',
      'window-splash',
      'ladder-rescue',
      'toaster-door',
      'job-center',
      'kitty-owner',
      'kid-heights',
    ]) {
      const m = world.markers[id]!;
      expect(pf.find({ x: s.gx, y: s.gy }, { x: m.gx, y: m.gy }), id).not.toBeNull();
    }
  });
});
