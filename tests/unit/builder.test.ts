import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content';
import { buildRoadGraph, buildWalkGrid, loadWorld } from '../../src/content/world';
import { PathFinder } from '../../src/iso/path';
import { blocksFor, BUILD, pickSite, SiteState } from '../../src/systems/build';
import {
  BlockStackModel,
  BS,
  CementPourModel,
  CopyBuildModel,
} from '../../src/systems/builderMinigames';
import { uniformState } from '../../src/systems/jobs';
import { earnedBadges, isUnlocked, type Progress } from '../../src/systems/missions';

const content = loadContent();
const world = loadWorld();
const builder = content.missions.filter((m) => m.job === 'builder' && m.tier !== 'finale' && m.tier !== 'rescue');
const progress = (p: Partial<Progress> = {}): Progress => ({
  badges: [],
  owned: [],
  missionsDone: {},
  ...p,
});

describe('Harbor map (AC1, AC6)', () => {
  it('is joined by road to the Plaza and to Skyscraper Heights', () => {
    const car = buildRoadGraph(world, 'car');
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
    const mixer = world.markers['mixer-truck']!;
    expect(seen.has(`${mixer.gx},${mixer.gy}`)).toBe(true);
    const links = [...car.nodes.values()].filter((n) => n.x === 42);
    expect(links.filter((n) => n.y < 21).length).toBeGreaterThanOrEqual(2);
    expect(links.filter((n) => n.y > 21).length).toBeGreaterThanOrEqual(2);
  });

  it('has five build spots, and the island can only be walked to once the bridge is built', () => {
    const sites = world.buildings.filter((b) => b.site && b.id !== 'golden-tower').map((b) => b.id);
    expect(sites.sort()).toEqual(['boat-shop', 'bridge', 'dock', 'lighthouse', 'practice-wall']);
    const island = world.markers.island!;
    const s = world.spawn;
    const before = new PathFinder(buildWalkGrid(world));
    expect(before.find({ x: s.gx, y: s.gy }, { x: island.gx, y: island.gy })).toBeNull();
    const after = new PathFinder(buildWalkGrid(world, new Set(['bridge'])));
    expect(after.find({ x: s.gx, y: s.gy }, { x: island.gx, y: island.gy })).not.toBeNull();
  });

  it('a built boat shop blocks its footprint; an unbuilt one does not', () => {
    const b = world.buildings.find((x) => x.id === 'boat-shop')!;
    expect(buildWalkGrid(world).isWalkable(b.gx, b.gy)).toBe(true);
    expect(buildWalkGrid(world, new Set(['boat-shop'])).isWalkable(b.gx, b.gy)).toBe(false);
  });

  it('the foreman, pads and every parking place can be reached', () => {
    const pf = new PathFinder(buildWalkGrid(world));
    const s = world.spawn;
    for (const id of [
      'foreman',
      'builder-board',
      'block-stack',
      'copy-the-build',
      'cement-pour',
      'keeper',
      'boat-owner',
      'wrench-spot',
    ]) {
      const m = world.markers[id]!;
      expect(pf.find({ x: s.gx, y: s.gy }, { x: m.gx, y: m.gy }), id).not.toBeNull();
    }
  });
});

describe('Block blaster (AC3)', () => {
  it('each press adds blocks until it is built; never more than needed', () => {
    const s = new SiteState(6);
    for (let i = 0; i < 5; i++) expect(s.add(1)).toBe(false);
    expect(s.progress).toBeCloseTo(5 / 6);
    expect(s.add(2)).toBe(true);
    expect(s.added).toBe(6);
    expect(s.add(1)).toBe(false);
  });

  it('spots need 6–10 blocks; the giant drum adds 2 per press', () => {
    for (const b of world.buildings.filter((x) => x.site)) {
      const n = blocksFor(b);
      expect(n, b.id).toBeGreaterThanOrEqual(6);
      expect(n, b.id).toBeLessThanOrEqual(10);
    }
    expect(BUILD.giantPerPress).toBe(2);
  });

  it('reaches 6 tiles from the truck, 3 on foot; every spot can be reached from its parking place', () => {
    const site = { id: 's', x: 0, y: 0 };
    expect(pickSite({ x: 5, y: 0 }, 'truck', [site])).toBe('s');
    expect(pickSite({ x: 5, y: 0 }, 'foot', [site])).toBeNull();
    for (const b of world.buildings.filter((x) => x.site)) {
      const at = world.markers[`${b.id}-at`]!;
      const c = { id: b.id, x: b.gx + b.w / 2, y: b.gy + b.d / 2 };
      expect(pickSite({ x: at.gx, y: at.gy }, 'truck', [c]), b.id).toBe(b.id);
    }
  });
});

describe('Builder missions content (AC4, AC5, AC9, AC10)', () => {
  it('3 Rookie then 3 Pro; Pro needs the Builder badge and the giant drum', () => {
    expect(builder.map((m) => m.id)).toEqual([
      'hard-hat-day',
      'dock-it',
      'mixer-mayhem',
      'lighthouse-lights',
      'boat-shop',
      'bridge-to-the-island',
    ]);
    const lh = builder.find((m) => m.id === 'lighthouse-lights')!;
    expect(isUnlocked(lh, progress({ badges: ['builder'] }))).toBe(false);
    expect(isUnlocked(lh, progress({ badges: ['builder'], owned: ['giant-drum'] }))).toBe(true);
    expect(
      earnedBadges(
        content.missions,
        progress({ missionsDone: { 'hard-hat-day': 1, 'dock-it': 1, 'mixer-mayhem': 1 } }),
      ),
    ).toContain('builder');
  });

  it('every goal points at something on the map', () => {
    const markers = new Set(Object.keys(world.markers));
    const sites = new Set(world.buildings.filter((b) => b.site).map((b) => b.id));
    for (const m of builder)
      for (const g of m.goals) {
        if (g.type === 'build') {
          expect(sites.has(g.spot), g.spot).toBe(true);
          expect(markers.has(`${g.spot}-at`), `${g.spot}-at`).toBe(true);
        }
        if (g.type === 'goTo') expect(markers.has(g.target), g.target).toBe(true);
        if (g.type === 'checkpoints') for (const f of g.flags) expect(markers.has(f), f).toBe(true);
        if (g.type === 'minigame') expect(markers.has(g.id), g.id).toBe(true);
      }
  });

  it('2 new Builder errands, each after a Builder mission; the Builder uniform opens with a badge', () => {
    const be = content.errands.filter((e) => e.job === 'builder');
    expect(be.map((e) => e.kind).sort()).toEqual(['deliver', 'find']);
    for (const e of be) expect(builder.map((m) => m.id)).toContain(e.after);
    expect(uniformState('builder', 'cop', ['cop'], content.missions)).toBe('open');
    expect(content.shop.find((i) => i.id === 'giant-drum')?.price).toBe(90);
  });
});

describe('Builder minigames (AC7)', () => {
  it('Block Stack: drop near the top to stack, far away bounces off; slows after 3 misses', () => {
    const m = new BlockStackModel(100, 0, 0.15);
    // phase 0: block straight above the stack.
    expect(m.drop()).toMatchObject({ type: 'stacked', height: 1 });
    for (let i = 0; i < 3; i++) {
      m.update(BS.dropSec + 0.01);
      m.phase = Math.PI / 2; // far right
      expect(m.drop()).toMatchObject({ type: 'bounced' });
    }
    expect(m.easier).toBe(true);
    expect(new BlockStackModel(100, 5, 0.15).speed).toBeGreaterThan(m.speed);
    let done = false;
    for (let t = 0; t < 120 && !done; t++) done = m.update(1).some((e) => e.type === 'finished');
    expect(done).toBe(true);
  });

  it('Copy the Build: matching the picture scores and brings a new one; bigger on replay', () => {
    let k = 0;
    const seq = [0.9, 0.1, 0.5, 0.3, 0.2, 0.7, 0.4, 0.6, 0.8];
    const m = new CopyBuildModel(100, 0, () => seq[k++ % seq.length]!);
    expect(m.size).toBe(2);
    const target = [...m.target];
    let matched = false;
    target.forEach((c, i) => {
      for (let n = 0; n < c; n++) if (m.tap(i)?.type === 'matched') matched = true;
    });
    expect(matched).toBe(true);
    expect(m.score).toBe(1);
    expect(new CopyBuildModel(100, 3).size).toBe(3);
  });

  it('Cement Pour: every pour scores 1–3 by how close; replays drift the line', () => {
    const m = new CementPourModel(90, 0, () => 0.5); // line at 0.6
    m.update(0.01);
    m.press();
    while (m.level < m.line) m.update(0.01);
    expect(m.release()).toMatchObject({ type: 'poured', points: 3 });
    for (let i = 0; i < 100; i++) m.update(0.01);
    m.press();
    m.update(0.05);
    expect(m.release()).toMatchObject({ points: 1 });
    expect(m.score).toBe(4);
    expect(new CementPourModel(90, 2).drift).toBeGreaterThan(0);
  });
});
