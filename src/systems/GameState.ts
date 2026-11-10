import type { Content } from '../content';
import { Economy } from './economy';
import { ErrandBook, type Inventory } from './errands';
import { coinsForScore } from './minigames';
import { MissionRun } from './missions';
import { SaveStore } from './save';

type StorageLike = ConstructorParameters<typeof SaveStore>[0];

/**
 * Everything the player has and is doing, wired together: coins (economy) are mirrored into the
 * save, and every finished minigame / errand / mission is recorded. No Phaser in here.
 */
export class GameState {
  readonly economy: Economy;
  readonly save: SaveStore;
  readonly errands: ErrandBook;
  readonly inventory: Inventory = {};
  mission: MissionRun | null = null;

  constructor(
    readonly content: Content,
    storage: StorageLike,
  ) {
    this.save = new SaveStore(storage);
    this.economy = new Economy(this.save.data.coins);
    this.economy.onChange((c) => this.save.update((s) => (s.coins = c.coins)));
    this.errands = new ErrandBook(content.errands);
    if (this.save.data.job === null) this.save.update((s) => (s.job = 'cop'));
  }

  startMission(id: string, now: number): MissionRun {
    const m = this.content.missions.find((x) => x.id === id);
    if (!m) throw new Error(`no mission ${id}`);
    this.mission = new MissionRun(m, now);
    return this.mission;
  }

  /** Record a finished mission run and pay its reward. Returns the stars. */
  completeMission(): { stars: number; coins: number } {
    const run = this.mission;
    if (!run || !run.done) throw new Error('mission not finished');
    const stars = run.stars();
    const id = run.mission.id;
    this.save.update((s) => (s.missionsDone[id] = Math.max(s.missionsDone[id] ?? 0, stars)));
    this.economy.award('mission', run.mission.reward.coins);
    this.save.flush();
    return { stars, coins: run.mission.reward.coins };
  }

  /** Pay for a finished minigame by score tier and count the play. Returns the coins paid. */
  finishMinigame(id: string, score: number): number {
    const def = this.content.minigames.find((m) => m.id === id);
    if (!def) throw new Error(`no minigame ${id}`);
    const coins = coinsForScore(score, def.tiers);
    this.save.update((s) => (s.minigamePlays[id] = (s.minigamePlays[id] ?? 0) + 1));
    this.economy.award('minigame', coins);
    this.save.flush();
    return coins;
  }

  plays(id: string): number {
    return this.save.data.minigamePlays[id] ?? 0;
  }

  /** Try to complete an errand with what the player carries. Returns coins paid or null. */
  completeErrand(id: string): number | null {
    const r = this.errands.complete(id, this.inventory);
    if (!r) return null;
    this.save.update((s) => {
      if (!s.errandsDone.includes(id)) s.errandsDone.push(id);
    });
    this.economy.award('errand', r.reward);
    this.save.flush();
    return r.reward;
  }

  pickUp(item: string): number {
    this.inventory[item] = (this.inventory[item] ?? 0) + 1;
    this.mission?.collect(item);
    return this.inventory[item]!;
  }
}
