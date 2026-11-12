import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content';
import { loadWorld, buildRoadGraph, buildWalkGrid } from '../../src/content/world';
import { tileAt } from '../../src/content/schema';
import { Economy } from '../../src/systems/economy';
import { ErrandBook } from '../../src/systems/errands';
import { EscortState, ESCORT } from '../../src/systems/escort';
import { FindState, FIND } from '../../src/systems/find';
import { GameState } from '../../src/systems/GameState';
import {
  earnedBadges,
  isUnlocked,
  Mission,
  MissionRun,
  nextMission,
  type Progress,
} from '../../src/systems/missions';
import { netTarget, NetShot, NET } from '../../src/systems/net';
import { minigamesShort, shelf } from '../../src/systems/shop';
import { WhoTookItModel } from '../../src/systems/whoTookIt';

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
const cop = content.missions.filter((m) => m.job === 'cop');

describe('Cop missions content (spec 003)', () => {
  it('has the 6 Cop missions in order: 3 Rookie then 3 Pro', () => {
    expect(cop.map((m) => m.id)).toEqual([
      'first-day',
      'donut-dash',
      'duck-crossing',
      'rooftop-run',
      'lost-puppy',
      'double-trouble',
    ]);
    expect(cop.map((m) => m.tier)).toEqual(['rookie', 'rookie', 'rookie', 'pro', 'pro', 'pro']);
  });

  it('every voice line used by missions, errands and goals exists', () => {
    for (const m of content.missions) {
      expect(content.voice[m.voiceIntro], m.voiceIntro).toBeTruthy();
      expect(content.voice[m.voiceDone], m.voiceDone).toBeTruthy();
    }
  });

  it('AC18: every goal points at something on the map (so the hint arrow has a target)', () => {
    const markers = new Set(Object.keys(world.markers));
    const things = (g: Mission['goals'][number]): string[] => {
      switch (g.type) {
        case 'goTo':
          return [g.target];
        case 'catch':
          return g.robbers.map((r) => r.start);
        case 'checkpoints':
          return g.flags;
        case 'escort':
          return [g.from, g.to];
        case 'find':
          return g.spots;
        case 'minigame':
          return [g.id];
        default:
          return [];
      }
    };
    for (const m of cop)
      for (const g of m.goals)
        for (const t of things(g)) expect(markers.has(t), `${m.id}: ${g.type} → ${t}`).toBe(true);
    // Siren goals point at the car (you must be driving): it's a marker too.
    expect(markers.has('police-car')).toBe(true);
  });

  it('still loads the spec 002 form { robber } as one robber', () => {
    const m = Mission.parse({
      id: 'x',
      job: 'cop',
      tier: 'rookie',
      voiceIntro: 'a',
      goals: [{ type: 'catch', robber: 'pickles', bumps: 3 }],
      reward: { coins: 1 },
    });
    expect(m.goals[0]).toMatchObject({ robbers: [{ id: 'pickles', start: 'getaway-start' }] });
  });
});

describe('requires, next mission and the Cop badge (AC7, AC8)', () => {
  it('offers missions in order, one after another', () => {
    const p = progress();
    expect(nextMission(content.missions, 'cop', p)?.id).toBe('first-day');
    p.missionsDone = { 'first-day': 1 };
    expect(nextMission(content.missions, 'cop', p)?.id).toBe('donut-dash');
    p.missionsDone = { 'first-day': 1, 'donut-dash': 2 };
    expect(nextMission(content.missions, 'cop', p)?.id).toBe('duck-crossing');
  });

  it('Pro missions stay locked until the player has BOTH the badge and the police bike', () => {
    const rookieDone = { 'first-day': 1, 'donut-dash': 1, 'duck-crossing': 1 };
    const rr = cop.find((m) => m.id === 'rooftop-run')!;
    expect(isUnlocked(rr, progress({ missionsDone: rookieDone }))).toBe(false);
    expect(isUnlocked(rr, progress({ missionsDone: rookieDone, badges: ['cop'] }))).toBe(false);
    expect(isUnlocked(rr, progress({ owned: ['police-bike'] }))).toBe(false);
    expect(
      isUnlocked(
        rr,
        progress({ missionsDone: rookieDone, badges: ['cop'], owned: ['police-bike'] }),
      ),
    ).toBe(true);
    // Badge but no bike: the chief has nothing to offer (padlocks on the board).
    expect(
      nextMission(content.missions, 'cop', progress({ missionsDone: rookieDone, badges: ['cop'] })),
    ).toBeNull();
  });

  it('the Cop badge is earned by finishing all 3 Rookie missions', () => {
    expect(earnedBadges(content.missions, progress({ missionsDone: { 'first-day': 1 } }))).toEqual(
      [],
    );
    expect(
      earnedBadges(
        content.missions,
        progress({ missionsDone: { 'first-day': 1, 'donut-dash': 1, 'duck-crossing': 3 } }),
      ),
    ).toEqual(['cop']);
  });

  it('GameState awards the badge once, saves it, and replays pay the full reward', () => {
    const st = storage();
    const g = new GameState(content, st);
    const finish = (id: string) => {
      const run = g.startMission(id, 0);
      let n = 0;
      while (!run.done && n++ < 50) {
        const goal = run.goal!;
        const parts =
          goal.type === 'catch'
            ? goal.robbers.map((r) => ({ type: 'caught' as const, robber: r.id }))
            : goal.type === 'checkpoints'
              ? goal.flags.map((f) => ({ type: 'checkpoint' as const, flag: f }))
              : goal.type === 'goTo'
                ? [{ type: 'reached' as const, target: goal.target }]
                : goal.type === 'siren'
                  ? [{ type: 'siren' as const }]
                  : goal.type === 'escort'
                    ? [{ type: 'escorted' as const, group: goal.group }]
                    : goal.type === 'minigame'
                      ? [{ type: 'minigameDone' as const, id: goal.id }]
                      : goal.type === 'find'
                        ? [{ type: 'found' as const, item: goal.item }]
                        : [];
        for (const e of parts) run.notify(e, 1000);
      }
      return g.completeMission();
    };
    expect(finish('first-day').badge).toBeNull();
    expect(finish('donut-dash').badge).toBeNull();
    expect(finish('duck-crossing')).toMatchObject({ badge: 'cop', coins: 20 });
    expect(g.hasBadge('cop')).toBe(true);
    const coins = g.economy.coins;
    expect(finish('donut-dash')).toMatchObject({ badge: null, coins: 20 });
    expect(g.economy.coins).toBe(coins + 20);
    expect(new GameState(content, st).save.data.badges).toEqual(['cop']);
  });

  it('catch with two robbers needs both, in any order', () => {
    const dt = cop.find((m) => m.id === 'double-trouble')!;
    const r = new MissionRun(dt, 0);
    r.notify({ type: 'reached', target: 'police-car' }, 0);
    expect(r.notify({ type: 'caught', robber: 'smudge' }, 1)).toBe('part');
    expect(r.notify({ type: 'caught', robber: 'smudge' }, 2)).toBeNull();
    expect(r.notify({ type: 'caught', robber: 'pickles' }, 3)).toBe('goal');
    expect(r.goal).toEqual({ type: 'minigame', id: 'who-took-it' });
  });

  it('checkpoints: three flags in any order', () => {
    const fd = cop.find((m) => m.id === 'first-day')!;
    const r = new MissionRun(fd, 0);
    r.notify({ type: 'reached', target: 'police-car' }, 0);
    expect(r.notify({ type: 'checkpoint', flag: 'flag-3' }, 1)).toBe('part');
    expect(r.partDone('flag-3')).toBe(true);
    r.notify({ type: 'checkpoint', flag: 'flag-1' }, 2);
    expect(r.notify({ type: 'checkpoint', flag: 'flag-2' }, 3)).toBe('goal');
    expect(r.goal?.type).toBe('siren');
  });
});

describe('Economy.spend and the Shop (AC9)', () => {
  it('spend never goes below zero and changes nothing when short', () => {
    const e = new Economy(50);
    expect(e.spend(90)).toBe(false);
    expect(e.coins).toBe(50);
    expect(e.spend(50)).toBe(true);
    expect(e.coins).toBe(0);
    expect(() => e.spend(0)).toThrow();
    expect(() => e.spend(-5)).toThrow();
  });

  it('buying the police bike costs 90, saves it, and can only happen once', () => {
    const st = storage();
    const g = new GameState(content, st);
    expect(g.shopTab('job').map((i) => i.id)).toEqual(['police-bike']);
    expect(g.content.shop[0]!.price).toBe(90);
    g.finishMinigame('traffic-helper', 99); // 30
    expect(g.buy('police-bike')).toBe(false);
    expect(g.economy.coins).toBe(30);
    expect(minigamesShort(90, 30)).toBe(4);
    g.finishMinigame('traffic-helper', 99);
    g.finishMinigame('traffic-helper', 99);
    expect(g.buy('police-bike')).toBe(true);
    expect(g.economy.coins).toBe(0);
    expect(g.buy('police-bike')).toBe(false);
    expect(new GameState(content, st).owns('police-bike')).toBe(true);
  });

  it('shelf hides items whose requirements are not met', () => {
    const items = [
      { id: 'a', icon: 'bike', price: 1, tab: 'job' as const, requires: [] },
      { id: 'b', icon: 'ladder', price: 1, tab: 'job' as const, requires: ['badge:fire'] },
    ];
    expect(shelf(items, progress()).map((i) => i.id)).toEqual(['a']);
    expect(shelf(items, progress({ badges: ['fire'] })).map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('Errands after missions (AC16)', () => {
  it('3 new Cop errands, each offered once its mission is done', () => {
    const book = new ErrandBook(content.errands);
    const after = content.errands.filter((e) => e.after && e.job === 'cop');
    expect(after.map((e) => e.kind).sort()).toEqual(['deliver', 'find', 'return']);
    expect(book.unlockedBy({}, [])).toEqual([]);
    expect(book.unlockedBy({ 'rooftop-run': 1 }, []).map((e) => e.id)).toEqual([
      'find-rubber-duck',
    ]);
    expect(book.unlockedBy({ 'rooftop-run': 1 }, ['find-rubber-duck'])).toEqual([]);
  });

  it('deliver: you bring the item to the destination, not back to the giver', () => {
    const book = new ErrandBook(content.errands);
    book.offer('deliver-balloon');
    expect(book.receiver('deliver-balloon')).toBe('chief');
    expect(book.receiver('find-rubber-duck')).toBe('mayor');
    const inv = { balloon: 1 };
    expect(book.complete('deliver-balloon', inv)).toEqual({ reward: 10, handedOver: 1 });
  });

  it('coins still only come from minigames, errands and missions', () => {
    const e = new Economy();
    for (const bad of ['bump', 'pickup', 'shop', 'net']) {
      expect(() => e.award(bad as never, 5)).toThrow();
    }
  });
});

describe('Net launcher aim help (AC11)', () => {
  const me = { x: 0, y: 0 };
  const east = { x: 1, y: 0 };

  it('picks a robber ahead within the cone and range', () => {
    expect(netTarget(me, east, [{ id: 'p', pos: { x: 3, y: 1 } }])).toBe('p');
    expect(netTarget(me, east, [{ id: 'p', pos: { x: 3, y: 3 } }])).toBeNull(); // 45° off
    expect(netTarget(me, east, [{ id: 'p', pos: { x: -2, y: 0 } }])).toBeNull(); // behind
    expect(netTarget(me, east, [{ id: 'p', pos: { x: NET.range + 0.5, y: 0 } }])).toBeNull();
    expect(netTarget(me, east, [{ id: 'p', pos: { x: 0.2, y: 0.2 } }])).toBe('p'); // bumper to bumper
  });

  it('prefers the one nearest the centre line', () => {
    expect(
      netTarget(me, east, [
        { id: 'side', pos: { x: 2, y: 1.2 } },
        { id: 'ahead', pos: { x: 4, y: 0.1 } },
      ]),
    ).toBe('ahead');
  });

  it('a fired net homes in on a fleeing robber and hits him; no target = a free miss', () => {
    const shot = new NetShot(me, 'p');
    const robber = { x: 3, y: 0 };
    let state = shot.state;
    for (let i = 0; i < 60 && state === 'flying'; i++) {
      robber.x += 4.4 / 60; // robber at full getaway speed, swerving
      robber.y = Math.sin(i / 5) * 0.5;
      state = shot.step(1 / 60, robber);
    }
    expect(state).toBe('hit');
    const miss = new NetShot(me, 'gone');
    expect(miss.step(1 / 60, null)).toBe('missed');
  });
});

describe('Escort (Duck Crossing, AC14)', () => {
  const walk = (
    s: EscortState,
    path: { x: number; y: number }[],
    road = () => false,
    traffic = false,
  ) => {
    for (const p of path) s.update(1 / 30, p, road(), traffic);
  };
  const line = (a: { x: number; y: number }, b: { x: number; y: number }, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      x: a.x + ((b.x - a.x) * i) / (n - 1),
      y: a.y + ((b.y - a.y) * i) / (n - 1),
    }));

  it('ducks wait until you reach them, then follow in a line and get delivered', () => {
    const s = new EscortState({ x: 0, y: 0 }, 4, { x: 6, y: 0 });
    s.update(1 / 30, { x: 5, y: 5 }, false, false);
    expect(s.phase).toBe('lost');
    walk(s, line({ x: 0.5, y: 0 }, { x: 8, y: 0 }, 140));
    for (let i = 0; i < 90; i++) s.update(1 / 30, { x: 8, y: 0 }, false, false);
    expect(s.phase).toBe('delivered');
    // In a line: each duck behind the one in front.
    for (let i = 1; i < s.ducks.length; i++)
      expect(s.ducks[i]!.x).toBeLessThanOrEqual(s.ducks[i - 1]!.x + 1e-6);
  });

  it('they stop when you run too far ahead, and walking back picks them up', () => {
    const s = new EscortState({ x: 0, y: 0 }, 3, { x: 30, y: 0 });
    s.update(1 / 30, { x: 0.5, y: 0 }, false, false);
    s.update(1 / 30, { x: ESCORT.tooFar + 3, y: 0 }, false, false);
    expect(s.phase).toBe('waiting');
    walk(s, line({ x: ESCORT.tooFar + 3, y: 0 }, { x: 0.3, y: 0 }, 30));
    expect(s.phase).toBe('following');
  });

  it('they wait at the kerb when traffic is coming, and after 3 stops they hurry and stop waiting', () => {
    const s = new EscortState({ x: 0, y: 0 }, 3, { x: 30, y: 0 });
    s.update(1 / 30, { x: 0.5, y: 0 }, false, false);
    expect(s.update(1 / 30, { x: 1, y: 0 }, true, true)).toBe('kerb');
    expect(s.update(1 / 30, { x: 1.1, y: 0 }, true, false)).toBe('following');
    s.update(1 / 30, { x: 1.2, y: 0 }, true, true);
    s.update(1 / 30, { x: 1.3, y: 0 }, true, false);
    s.update(1 / 30, { x: 1.4, y: 0 }, true, true);
    expect(s.stops).toBe(3);
    expect(s.easier).toBe(true);
    expect(s.update(1 / 30, { x: 1.5, y: 0 }, true, true)).toBe('following');
  });
});

describe('Find (Lost Puppy, AC14)', () => {
  const spots = [
    { x: 2, y: 2 },
    { x: 10, y: 2 },
    { x: 10, y: 10 },
  ];

  it('barks get louder closer to the current spot', () => {
    const f = new FindState(spots);
    expect(f.volumeAt({ x: 2.5, y: 2 })).toBeGreaterThan(f.volumeAt({ x: 9, y: 9 }));
    expect(f.volumeAt({ x: 40, y: 40 })).toBeCloseTo(FIND.minVolume);
  });

  it('the first spots are empty, the puppy is in the last one', () => {
    const f = new FindState(spots);
    expect(f.update(0.1, spots[0]!)).toContainEqual({ type: 'empty', spot: 0 });
    expect(f.update(0.1, spots[1]!)).toContainEqual({ type: 'empty', spot: 1 });
    expect(f.update(0.1, spots[2]!)).toContainEqual({ type: 'found' });
    expect(f.found).toBe(true);
  });

  it('gets easier after a while: barks at full volume from anywhere', () => {
    const f = new FindState(spots);
    for (let t = 0; t < FIND.louderAfterSec + 1; t += 1) f.update(1, { x: 40, y: 40 });
    expect(f.easier).toBe(true);
    expect(f.volumeAt({ x: 40, y: 40 })).toBe(1);
  });
});

describe('Who Took It? (AC13)', () => {
  const seq = (vals: number[]) => {
    let i = 0;
    return () => vals[i++ % vals.length]!;
  };

  it('a right tap scores, a wrong tap is just a shrug (no score lost)', () => {
    const m = new WhoTookItModel(110, 0, 0.15, seq([0.1, 0.3, 0.5, 0.7, 0.9, 0.2, 0.6]));
    m.update(0.1);
    const r = m.round!;
    const wrongIdx = (r.culprit + 1) % 5;
    expect(m.tap(wrongIdx)).toEqual({ type: 'wrong', suspect: wrongIdx });
    expect(m.score).toBe(0);
    expect(m.tap(r.culprit)).toEqual({ type: 'right', suspect: r.culprit });
    expect(m.score).toBe(1);
    expect(r.looks).toHaveLength(5);
    expect(new Set(r.looks).size).toBe(5);
  });

  it('pays 5/15/30 by tiers and gets harder on replay (smaller clue, shuffling)', () => {
    const def = content.minigames.find((g) => g.id === 'who-took-it')!;
    expect(def.tiers).toEqual([0, 6, 11]);
    const first = new WhoTookItModel(110, 0, def.difficultyStepPerReplay);
    const later = new WhoTookItModel(110, 4, def.difficultyStepPerReplay);
    expect(later.clueScale).toBeLessThan(first.clueScale);
    expect(first.shuffleAfter).toBe(0);
    expect(later.shuffleAfter).toBeGreaterThan(0);
  });

  it('always finishes (time runs out), never fails', () => {
    const m = new WhoTookItModel(5, 0, 0.15);
    let finished = false;
    for (let t = 0; t < 30 && !finished; t += 0.1)
      finished = m.update(0.1).some((e) => e.type === 'finished');
    expect(finished).toBe(true);
  });
});

describe('Downtown map (AC10)', () => {
  const car = buildRoadGraph(world, 'car');
  const bike = buildRoadGraph(world, 'bike');

  it('the bike can use park paths; the car cannot', () => {
    const onPath = [...bike.nodes.values()].filter((n) => {
      const around = [
        [n.x - 1, n.y - 1],
        [n.x, n.y - 1],
        [n.x - 1, n.y],
        [n.x, n.y],
      ];
      return around.some(([x, y]) => tileAt(world, x!, y!) === 'path');
    });
    expect(onPath.length).toBeGreaterThan(10);
    for (const n of onPath) expect(car.get(n.x, n.y)).toBeUndefined();
    // Every car node is a bike node too.
    for (const n of car.nodes.values()) expect(bike.get(n.x, n.y)).toBeDefined();
  });

  it('water is not walkable; the duck pond and Time-Out Tower are there', () => {
    const grid = buildWalkGrid(world);
    const pond = world.markers.pond!;
    expect(tileAt(world, 10, 26)).toBe('water');
    expect(grid.isWalkable(10, 26)).toBe(false);
    expect(grid.isWalkable(Math.floor(pond.gx), Math.floor(pond.gy))).toBe(true);
    expect(world.buildings.some((b) => b.kind === 'timeout')).toBe(true);
    expect(world.buildings.some((b) => b.kind === 'shop')).toBe(true);
    expect(world.props.filter((p) => p.kind === 'trafficLight').length).toBeGreaterThanOrEqual(2);
  });

  it('every walkable tile can be reached from the spawn (nobody gets stranded)', async () => {
    const { PathFinder } = await import('../../src/iso/path');
    const grid = buildWalkGrid(world);
    const pf = new PathFinder(grid);
    const s = world.spawn;
    for (const id of ['chief', 'pond', 'ducks', 'spot-3', 'puppy-owner', 'mayor', 'shop']) {
      const m = world.markers[id]!;
      expect(pf.find({ x: s.gx, y: s.gy }, { x: m.gx, y: m.gy }), id).not.toBeNull();
    }
  });
});

describe('Saves from spec 002 still load (AC17)', () => {
  it('a 002 save (donut-dash done, coins, no cap) migrates and offers First Day', async () => {
    const { migrate, SAVE_KEY } = await import('../../src/systems/save');
    const old = {
      version: 1,
      coins: 45,
      job: 'cop',
      badges: [],
      missionsDone: { 'donut-dash': 2 },
      errandsDone: ['return-donuts'],
      owned: [],
      minigamePlays: { 'traffic-helper': 1 },
      apartment: [],
    };
    expect(migrate(old)).toEqual({ ...old, version: 2, hat: null, paint: null });
    const st = storage();
    st.setItem(SAVE_KEY, JSON.stringify(old));
    const g = new GameState(content, st);
    expect(g.economy.coins).toBe(45);
    expect(g.stars('donut-dash')).toBe(2);
    expect(g.nextMission()?.id).toBe('first-day');
    expect(g.owns('cap-cop')).toBe(false);
  });
});
