import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadContent } from '../../src/content';
import { ChaseState, DEFAULT_CHASE } from '../../src/systems/chase';
import { Economy, type CoinSource } from '../../src/systems/economy';
import { ErrandBook } from '../../src/systems/errands';
import { IdleHints } from '../../src/systems/hints';
import { coinsForScore, TH, TrafficHelperModel } from '../../src/systems/minigames';
import { MissionRun } from '../../src/systems/missions';
import { defaultSave, migrate, SAVE_KEY, SaveStore } from '../../src/systems/save';

const content = loadContent();

describe('content', () => {
  it('validates and has the slice content', () => {
    expect(content.missions.map((m) => m.id)).toContain('donut-dash');
    expect(content.errands.map((e) => e.id)).toContain('return-donuts');
    expect(content.minigames.map((m) => m.id)).toContain('traffic-helper');
    expect(Object.keys(content.voice).length).toBeGreaterThanOrEqual(10);
    const dd = content.missions.find((m) => m.id === 'donut-dash')!;
    expect(dd.reward.coins).toBe(20);
    expect(dd.goals.map((g) => g.type)).toEqual(['goTo', 'catch']);
    expect(content.errands.find((e) => e.id === 'return-donuts')!.reward).toBe(10);
  });

  it('every voice line referenced by missions exists', () => {
    for (const m of content.missions)
      expect(content.voice[m.voiceIntro], m.voiceIntro).toBeTruthy();
  });
});

describe('economy', () => {
  it('only awards from minigames, errands and missions', () => {
    const e = new Economy();
    const seen: number[] = [];
    e.onChange((c) => seen.push(c.coins));
    e.award('minigame', 15);
    e.award('errand', 10);
    e.award('mission', 20);
    expect(e.coins).toBe(45);
    expect(seen).toEqual([15, 25, 45]);
    expect(() => e.award('bump' as CoinSource, 1)).toThrow();
    expect(() => e.award('minigame', -5)).toThrow();
    expect(() => e.award('minigame', 1.5)).toThrow();
    expect(e.coins).toBe(45);
  });

  it('has no other way to add coins', () => {
    const methods = Object.getOwnPropertyNames(Economy.prototype).filter(
      (m) => m !== 'constructor',
    );
    // spend() only ever takes coins away (Shop purchases).
    expect(methods.sort()).toEqual(['award', 'coins', 'onChange', 'spend']);
  });
});

describe('save', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const fakeStorage = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      m,
    };
  };

  it('round-trips through storage with a debounced write', () => {
    const st = fakeStorage();
    const a = new SaveStore(st, 100);
    a.update((s) => {
      s.coins = 30;
      s.missionsDone['donut-dash'] = 2;
      s.errandsDone.push('return-donuts');
      s.minigamePlays['traffic-helper'] = 1;
    });
    expect(st.m.has(SAVE_KEY)).toBe(false);
    vi.advanceTimersByTime(150);
    const b = new SaveStore(st);
    expect(b.data.coins).toBe(30);
    expect(b.data.missionsDone['donut-dash']).toBe(2);
    expect(b.data.errandsDone).toEqual(['return-donuts']);
    expect(b.data.minigamePlays['traffic-helper']).toBe(1);
  });

  it('migrates: corrupt or unknown data starts fresh; partial v1 is filled in', () => {
    expect(migrate(null)).toEqual(defaultSave());
    expect(migrate('nope')).toEqual(defaultSave());
    expect(migrate({ version: 99, coins: 5 })).toEqual(defaultSave());
    expect(migrate({ version: 1, coins: -3 })).toEqual(defaultSave());
    const partial = migrate({ version: 1, coins: 12 });
    expect(partial.coins).toBe(12);
    expect(partial.badges).toEqual([]);
    const st = fakeStorage();
    st.setItem(SAVE_KEY, '{not json');
    expect(new SaveStore(st).data).toEqual(defaultSave());
  });

  it('works with no storage at all', () => {
    const s = new SaveStore(null);
    s.update((d) => (d.coins = 1));
    vi.advanceTimersByTime(1000);
    expect(s.data.coins).toBe(1);
  });
});

describe('missions', () => {
  const dd = content.missions.find((m) => m.id === 'donut-dash')!;

  it('runs goals in order and ignores out-of-order events', () => {
    const r = new MissionRun(dd, 0);
    expect(r.notify({ type: 'caught', robber: 'pickles' }, 1000)).toBeNull();
    expect(r.notify({ type: 'reached', target: 'police-car' }, 2000)).toBe('goal');
    expect(r.goal).toMatchObject({ type: 'catch', robbers: [{ id: 'pickles' }], bumps: 3 });
    expect(r.notify({ type: 'caught', robber: 'someone-else' }, 3000)).toBeNull();
    expect(r.notify({ type: 'caught', robber: 'pickles' }, 4000)).toBe('complete');
    expect(r.done).toBe(true);
  });

  it('gives 1–3 stars and never fails', () => {
    const slow = new MissionRun(dd, 0);
    slow.notify({ type: 'reached', target: 'police-car' }, 0);
    slow.notify({ type: 'caught', robber: 'pickles' }, 500_000);
    expect(slow.stars()).toBe(1);

    const great = new MissionRun(dd, 0);
    great.notify({ type: 'reached', target: 'police-car' }, 0);
    great.collect('donut', 5);
    great.notify({ type: 'caught', robber: 'pickles' }, 60_000);
    expect(great.stars()).toBe(3);
  });
});

describe('errands', () => {
  it('return errand: offered -> complete with the items -> done', () => {
    const book = new ErrandBook(content.errands);
    const inv: Record<string, number> = {};
    expect(book.statusOf('return-donuts')).toBe('hidden');
    book.offer('return-donuts');
    expect(book.canComplete('return-donuts', inv)).toBe(false);
    inv.donut = 3;
    expect(book.offeredBy('donut-owner').map((e) => e.id)).toEqual(['return-donuts']);
    expect(book.complete('return-donuts', inv)).toEqual({ reward: 10, handedOver: 3 });
    expect(inv.donut).toBe(0);
    expect(book.statusOf('return-donuts')).toBe('done');
    expect(book.complete('return-donuts', { donut: 1 })).toBeNull();
  });
});

describe('chase', () => {
  it('3 bumps catches the robber (with a cooldown between bumps)', () => {
    const c = new ChaseState();
    expect(c.bump()).toBe('bump');
    expect(c.bump()).toBeNull(); // too soon
    c.update(1.1, 1);
    expect(c.bump()).toBe('bump');
    c.update(1.1, 1);
    expect(c.bump()).toBe('caught');
    expect(c.caught).toBe(true);
  });

  it('drops 5 donuts over time, then stops', () => {
    const c = new ChaseState();
    let drops = 0;
    for (let i = 0; i < 60 * 30; i++)
      drops += c.update(1 / 60, 3).filter((e) => e === 'drop').length;
    expect(drops).toBe(DEFAULT_CHASE.drops);
  });

  it('runs out of gas after 3 missed attempts', () => {
    const c = new ChaseState();
    for (let i = 0; i < 3; i++) {
      c.update(0.1, 1.5); // close
      expect(c.outOfGas).toBe(false);
      c.update(0.1, 8); // got away
    }
    expect(c.misses).toBe(3);
    expect(c.outOfGas).toBe(true);
    expect(c.speedFactor(3)).toBe(0);
  });

  it('runs out of gas eventually even without attempts', () => {
    const c = new ChaseState();
    for (let i = 0; i < 80; i++) c.update(1, 20);
    expect(c.outOfGas).toBe(true);
  });

  it('robber is never faster than 80% of the police car and waits up when far ahead', () => {
    const c = new ChaseState();
    expect(c.speedFactor(1)).toBeLessThanOrEqual(0.8);
    expect(c.speedFactor(12)).toBeLessThan(c.speedFactor(1));
  });
});

describe('idle hints', () => {
  it('fires after 20 s idle, repeats, and resets on input', () => {
    const h = new IdleHints(20, 15);
    let fired = 0;
    for (let i = 0; i < 19; i++) fired += h.update(1, false) ? 1 : 0;
    expect(fired).toBe(0);
    expect(h.update(1, false)).toBe(true);
    expect(h.showing).toBe(true);
    for (let i = 0; i < 15; i++) fired += h.update(1, false) ? 1 : 0;
    expect(fired).toBe(1);
    h.update(0.016, true);
    expect(h.showing).toBe(false);
  });
});

describe('minigame scoring tiers', () => {
  it('pays 5 / 15 / 30 and never less than 5', () => {
    const tiers = [0, 8, 16] as const;
    expect(coinsForScore(0, tiers)).toBe(5);
    expect(coinsForScore(7, tiers)).toBe(5);
    expect(coinsForScore(8, tiers)).toBe(15);
    expect(coinsForScore(15, tiers)).toBe(15);
    expect(coinsForScore(16, tiers)).toBe(30);
    expect(coinsForScore(99, tiers)).toBe(30);
  });
});

describe('Traffic Helper model', () => {
  const seq = () => {
    let s = 1;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  };
  const run = (m: TrafficHelperModel, seconds: number, each?: () => void) => {
    for (let i = 0; i < seconds * 60; i++) {
      m.update(1 / 60);
      each?.();
    }
  };

  it('cars stop at the line on red; nobody crosses on green', () => {
    const m = new TrafficHelperModel(120, 0, 0.1, seq());
    run(m, 10);
    expect(m.score).toBe(0); // light was green the whole time
    m.toggleLight();
    run(m, 3, () => {
      for (const c of m.cars) {
        // No car front is ever inside the crosswalk while someone is crossing.
        if (m.walkers.some((w) => w.state === 'crossing')) {
          expect(c.x <= TH.stopLine + 1 || c.x - TH.carLength >= TH.crossRight).toBe(true);
        }
      }
    });
    run(m, 10);
    expect(m.score).toBeGreaterThan(0);
  });

  it('is never failed: finishes after the duration with a score', () => {
    const m = new TrafficHelperModel(30, 0, 0.1, seq());
    run(m, 40); // never touches the light
    expect(m.finished).toBe(true);
    expect(coinsForScore(m.score, [0, 8, 16])).toBe(5);
  });

  it('misses slow the game down; replays speed it up', () => {
    const fresh = new TrafficHelperModel(120, 0, 0.1);
    const replay = new TrafficHelperModel(120, 3, 0.1);
    expect(replay.pace).toBeGreaterThan(fresh.pace);
    const m = new TrafficHelperModel(120, 0, 0.1, seq());
    run(m, 30); // ducks wait, misses pile up
    expect(m.misses).toBeGreaterThan(0);
    expect(m.pace).toBeLessThan(1);
    expect(m.pace).toBeGreaterThanOrEqual(0.5);
  });
});

describe('GameState', () => {
  const storage = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  };

  it('pays minigames by tier, errands and missions, and it all survives a reload', async () => {
    const { GameState } = await import('../../src/systems/GameState');
    const st = storage();
    const a = new GameState(content, st);
    expect(a.save.data.job).toBe('cop');
    expect(a.finishMinigame('traffic-helper', 9)).toBe(15);
    expect(a.plays('traffic-helper')).toBe(1);

    a.errands.offer('return-donuts');
    expect(a.completeErrand('return-donuts')).toBeNull(); // no donuts yet
    a.startMission('donut-dash', 0);
    a.pickUp('donut');
    a.pickUp('donut');
    expect(a.completeErrand('return-donuts')).toBe(10);
    expect(a.inventory.donut).toBe(0);

    a.mission!.notify({ type: 'reached', target: 'police-car' }, 0);
    a.mission!.notify({ type: 'caught', robber: 'pickles' }, 30_000);
    expect(a.completeMission()).toEqual({ stars: 2, coins: 20, badge: null });
    expect(a.economy.coins).toBe(45);

    const b = new GameState(content, st); // "reload the page"
    expect(b.economy.coins).toBe(45);
    expect(b.save.data.missionsDone['donut-dash']).toBe(2);
    expect(b.save.data.errandsDone).toEqual(['return-donuts']);
    expect(b.save.data.minigamePlays['traffic-helper']).toBe(1);
  });
});
