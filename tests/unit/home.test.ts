import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content';
import { buildWalkGrid, loadWorld } from '../../src/content/world';
import { PathFinder } from '../../src/iso/path';
import { ApartmentLayout, ROOM } from '../../src/systems/apartment';
import { Economy } from '../../src/systems/economy';
import { GameState } from '../../src/systems/GameState';
import { lookFor } from '../../src/systems/jobs';
import { defaultSave, migrate, SAVE_KEY } from '../../src/systems/save';

const content = loadContent();
const world = loadWorld();
const storage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

describe('Apartment layout (AC2)', () => {
  const owned = ['home-bed', 'home-lamp', 'home-tv'];
  const furniture = content.shop.filter((i) => i.tab === 'home').map((i) => i.id);

  it('places owned furniture on free squares only, one per square', () => {
    const a = new ApartmentLayout([], owned);
    expect(a.tray(furniture)).toEqual(['home-lamp', 'home-bed', 'home-tv']);
    expect(a.place('home-bed', 0, 0)).toBe(true);
    expect(a.place('home-lamp', 0, 0)).toBe(false); // taken
    expect(a.place('home-lamp', ROOM.cols, 0)).toBe(false); // outside
    expect(a.place('home-computer', 1, 1)).toBe(false); // not owned
    expect(a.place('home-lamp', 5, 3)).toBe(true);
    expect(a.tray(furniture)).toEqual(['home-tv']);
  });

  it('moves and puts away; the saved layout comes back the same', () => {
    const a = new ApartmentLayout([], owned);
    a.place('home-bed', 0, 0);
    a.place('home-bed', 2, 1); // move
    expect(a.at(0, 0)).toBeUndefined();
    a.place('home-tv', 3, 3);
    a.remove('home-tv');
    const saved = a.toSave();
    expect(saved).toEqual([{ item: 'home-bed', gx: 2, gy: 1 }]);
    expect(new ApartmentLayout(saved, owned).toSave()).toEqual(saved);
  });

  it('cleans a bad save: not owned, off the grid, doubled up', () => {
    const a = new ApartmentLayout(
      [
        { item: 'home-bed', gx: 0, gy: 0 },
        { item: 'home-lamp', gx: 0, gy: 0 },
        { item: 'home-tv', gx: 9, gy: 9 },
        { item: 'home-computer', gx: 1, gy: 1 },
      ],
      owned,
    );
    expect(a.toSave()).toEqual([{ item: 'home-bed', gx: 0, gy: 0 }]);
  });

  it('GameState saves the layout and it survives a reload', () => {
    const st = storage();
    const g = new GameState(content, st);
    g.saveApartment([{ item: 'home-bed', gx: 1, gy: 2 }]);
    expect(new GameState(content, st).progress.apartment).toEqual([
      { item: 'home-bed', gx: 1, gy: 2 },
    ]);
  });
});

describe('Shop, hats and paint (AC3, AC4, AC5)', () => {
  it('four tabs; every item costs at most 90 (about 3 minigames)', () => {
    const tabs = new Set(content.shop.map((i) => i.tab));
    expect([...tabs].sort()).toEqual(['car', 'hats', 'home', 'job']);
    for (const i of content.shop) expect(i.price, i.id).toBeLessThanOrEqual(90);
    expect(content.shop.filter((i) => i.tab === 'home')).toHaveLength(8);
    expect(content.shop.filter((i) => i.tab === 'hats')).toHaveLength(3);
  });

  it('the own car needs a badge; paint needs the car', () => {
    const st = storage();
    const g = new GameState(content, st);
    expect(g.shopTab('car')).toEqual([]);
    g.save.update((s) => s.badges.push('cop'));
    expect(g.shopTab('car').map((i) => i.id)).toEqual(['own-car']);
    g.economy.award('minigame', 90);
    expect(g.buy('own-car')).toBe(true);
    expect(g.shopTab('car').map((i) => i.id)).toContain('paint-pink');
    expect(g.buy('paint-pink')).toBe(true);
    expect(g.applyPaint('paint-pink')).toBe(true);
    expect(g.applyPaint('paint-red')).toBe(false); // not owned
    expect(g.economy.coins).toBe(90 - 60 - 15);
    expect(new GameState(content, st).progress.paint).toBe('paint-pink');
  });

  it('a worn hat goes on every outfit, and is saved', () => {
    expect(lookFor('cop', ['cap-cop'], 'hat-pirate')).toBe('player+pirate');
    expect(lookFor('fire', [], 'hat-duck')).toBe('playerFire+duck');
    expect(lookFor('builder', [], null)).toBe('playerBuilder');
    const st = storage();
    const g = new GameState(content, st);
    expect(g.wear('hat-chef')).toBe(false);
    g.economy.award('minigame', 30);
    g.buy('hat-chef');
    expect(g.wear('hat-chef')).toBe(true);
    expect(new GameState(content, st).progress.hat).toBe('hat-chef');
    expect(g.wear(null)).toBe(true);
  });

  it('spending never goes below zero', () => {
    const e = new Economy(10);
    expect(e.spend(15)).toBe(false);
    expect(e.coins).toBe(10);
  });
});

describe('Errands around town (AC6)', () => {
  it('there are at least 19 errands, and at least 3 are on offer from the start', () => {
    expect(content.errands.length).toBeGreaterThanOrEqual(19);
    const g = new GameState(content, storage());
    const offered = g.errands.all.filter((e) => g.errands.statusOf(e.id) === 'offered');
    expect(offered.length).toBeGreaterThanOrEqual(3);
    // The rest wait for a mission (or are robber loot).
    for (const e of content.errands)
      if (!offered.includes(e)) expect(e.after ?? e.kind, e.id).not.toBeUndefined();
  });

  it('every giver, receiver and find spot is on the map, and every "after" is a mission', () => {
    const missions = new Set(content.missions.map((m) => m.id));
    const pf = new PathFinder(buildWalkGrid(world, new Set(['bridge'])));
    const s = world.spawn;
    for (const e of content.errands) {
      const places = [e.giver, e.destination, e.spot].filter((x): x is string => !!x);
      for (const id of places) {
        const m = world.markers[id];
        expect(m, `${e.id}: ${id}`).toBeDefined();
        expect(
          pf.find({ x: s.gx, y: s.gy }, { x: m!.gx, y: m!.gy }),
          `${e.id}: ${id}`,
        ).not.toBeNull();
      }
      if (e.after) expect(missions.has(e.after), e.after).toBe(true);
      expect(content.voice[e.voice ?? 'errand-offer'], e.id).toBeTruthy();
    }
  });
});

describe('SaveV2 (AC7)', () => {
  it('a v1 save (specs 002–005) loads with nothing lost, plus no hat and no paint', () => {
    const v1 = {
      version: 1,
      coins: 77,
      job: 'fire',
      badges: ['cop', 'fire'],
      missionsDone: { 'first-day': 3, 'siren-school': 1 },
      errandsDone: ['return-donuts'],
      owned: ['police-bike', 'built:dock'],
      minigamePlays: { 'who-took-it': 2 },
      apartment: [],
    };
    expect(migrate(v1)).toEqual({ ...v1, version: 2, hat: null, paint: null });
    const st = storage();
    st.setItem(SAVE_KEY, JSON.stringify(v1));
    const g = new GameState(content, st);
    expect(g.job).toBe('fire');
    expect(g.owns('built:dock')).toBe(true);
    expect(defaultSave().version).toBe(2);
  });
});

describe('Golden Block Heist finale (spec 007 AC1)', () => {
  it('locked until all 18 job missions are done; then the parts come one after another', async () => {
    const { finaleOffer, nextMission } = await import('../../src/systems/missions');
    const jobMissions = content.missions.filter((m) => m.tier !== 'finale');
    expect(jobMissions).toHaveLength(18);
    const done: Record<string, number> = {};
    const p = { badges: ['cop', 'fire', 'builder'], owned: [], missionsDone: done };
    for (const m of jobMissions.slice(0, 17)) done[m.id] = 1;
    expect(finaleOffer(content.missions, p)).toBeNull();
    done[jobMissions[17]!.id] = 1;
    expect(finaleOffer(content.missions, p)?.id).toBe('finale-tower-fire');
    done['finale-tower-fire'] = 1;
    expect(finaleOffer(content.missions, p)?.id).toBe('finale-helicopter');
    done['finale-helicopter'] = 1;
    expect(finaleOffer(content.missions, p)?.id).toBe('finale-rebuild');
    done['finale-rebuild'] = 2;
    expect(finaleOffer(content.missions, p)).toBeNull();
    // Job bosses never offer finale parts.
    expect(nextMission(content.missions, 'fire', p)).toBeNull();
  });

  it('every finale goal points at the map: fires on perches, the heli start, the golden tower spot', () => {
    const fin = content.missions.filter((m) => m.tier === 'finale');
    expect(fin.map((m) => m.job)).toEqual(['fire', 'cop', 'builder']);
    const perches = new Set(world.perches.map((x) => x.id));
    for (const m of fin)
      for (const g of m.goals) {
        if (g.type === 'spray') for (const f of g.fires) expect(perches.has(f), f).toBe(true);
        if (g.type === 'catch')
          for (const r of g.robbers) expect(world.markers[r.start], r.start).toBeDefined();
        if (g.type === 'build') {
          expect(world.buildings.find((b) => b.id === g.spot)?.site).toBe(true);
          expect(world.markers[`${g.spot}-at`]).toBeDefined();
        }
        if (g.type === 'goTo') expect(world.markers[g.target], g.target).toBeDefined();
      }
  });
});

describe('Grown-up settings (spec 007 AC6)', () => {
  it('load defaults, keep valid levels, ignore junk; saved apart from the game save', async () => {
    const { loadSettings, saveSettings, SETTINGS_KEY, DEFAULT_SETTINGS, unlockEverything } =
      await import('../../src/systems/settings');
    const st = storage();
    expect(loadSettings(st)).toEqual(DEFAULT_SETTINGS);
    saveSettings(st, { sound: 0, voice: 0.5 });
    expect(loadSettings(st)).toEqual({ sound: 0, voice: 0.5 });
    st.setItem(SETTINGS_KEY, '{"sound": 7, "voice": "x"}');
    expect(loadSettings(st)).toEqual({ sound: 1, voice: 1 });
    st.setItem(SETTINGS_KEY, 'not json');
    expect(loadSettings(st)).toEqual(DEFAULT_SETTINGS);
    expect(SETTINGS_KEY).not.toBe(SAVE_KEY);
    const u = unlockEverything(['a', 'b']);
    expect(u.badges).toEqual(['cop', 'fire', 'builder']);
    expect(u.owned).toEqual(expect.arrayContaining(['police-bike', 'long-ladder', 'giant-drum']));
    expect(u.done).toEqual(['a', 'b']);
  });

  it('the manifest is valid for installing: name, landscape, 192/512/maskable icons', async () => {
    const fs = await import('node:fs');
    const m = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8')) as {
      name: string;
      orientation: string;
      start_url: string;
      display: string;
      icons: { src: string; sizes: string; purpose?: string }[];
    };
    expect(m.name).toBeTruthy();
    expect(m.orientation).toBe('landscape');
    expect(['standalone', 'fullscreen']).toContain(m.display);
    expect(m.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const i of m.icons) expect(fs.existsSync(`public/${i.src}`), i.src).toBe(true);
  });
});
