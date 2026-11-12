import type { Content } from '../content';
import { Economy } from './economy';
import { ErrandBook, type Inventory } from './errands';
import { coinsForScore } from './minigames';
import {
  earnedBadges,
  isUnlocked,
  MissionRun,
  nextMission,
  type JobId,
  type Mission,
} from './missions';
import { SaveStore } from './save';
import { uniformState } from './jobs';
import { shelf, type ShopItem } from './shop';

type StorageLike = ConstructorParameters<typeof SaveStore>[0];

export interface MissionResult {
  stars: number;
  coins: number;
  /** Badge earned by this run (for the ceremony), if any. */
  badge: string | null;
}

/**
 * Everything the player has and is doing, wired together: coins (economy) are mirrored into the
 * save, and every finished minigame / errand / mission / purchase is recorded. No Phaser in here.
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
    // Errands that are always around (no `after`, not robber loot) are on offer from the start.
    for (const e of this.errands.all)
      if (!e.after && e.kind !== 'return' && !this.save.data.errandsDone.includes(e.id))
        this.errands.offer(e.id);
    // Errands unlocked by missions finished in an earlier session are on offer again.
    for (const e of this.errands.unlockedBy(
      this.save.data.missionsDone,
      this.save.data.errandsDone,
    ))
      this.errands.offer(e.id);
  }

  get job(): JobId {
    return this.save.data.job ?? 'cop';
  }

  get progress() {
    return this.save.data;
  }

  missionDef(id: string): Mission {
    const m = this.content.missions.find((x) => x.id === id);
    if (!m) throw new Error(`no mission ${id}`);
    return m;
  }

  /** What the job's boss offers next (null when every unlocked mission is done). */
  nextMission(job: JobId = this.job): Mission | null {
    return nextMission(this.content.missions, job, this.save.data);
  }

  unlocked(id: string): boolean {
    return isUnlocked(this.missionDef(id), this.save.data);
  }

  stars(id: string): number {
    return this.save.data.missionsDone[id] ?? 0;
  }

  hasBadge(job: string): boolean {
    return this.save.data.badges.includes(job);
  }

  owns(item: string): boolean {
    return this.save.data.owned.includes(item);
  }

  startMission(id: string, now: number): MissionRun {
    this.mission = new MissionRun(this.missionDef(id), now);
    return this.mission;
  }

  /**
   * Record a finished mission run and pay its reward (replays pay in full: spec 003 decision 6).
   * Awards any badge it earned and offers errands that unlock after it.
   */
  completeMission(): MissionResult {
    const run = this.mission;
    if (!run || !run.done) throw new Error('mission not finished');
    const stars = run.stars();
    const id = run.mission.id;
    this.save.update((s) => (s.missionsDone[id] = Math.max(s.missionsDone[id] ?? 0, stars)));
    this.economy.award('mission', run.mission.reward.coins);
    let badge: string | null = null;
    for (const b of earnedBadges(this.content.missions, this.save.data)) {
      if (this.save.data.badges.includes(b)) continue;
      this.save.update((s) => s.badges.push(b));
      badge = b;
    }
    for (const e of this.errands.unlockedBy(
      this.save.data.missionsDone,
      this.save.data.errandsDone,
    ))
      if (this.errands.statusOf(e.id) === 'hidden') this.errands.offer(e.id);
    this.mission = null;
    this.save.flush();
    return { stars, coins: run.mission.reward.coins, badge };
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

  /** Shop items showing right now: unlocked ones for the current job (or for every job). */
  shopShelf(): ShopItem[] {
    return shelf(this.content.shop, this.save.data).filter(
      (i) => i.job === undefined || i.job === this.job,
    );
  }

  /** Items on one Shop tab right now. */
  shopTab(tab: 'job' | 'hats' | 'car' | 'home'): ShopItem[] {
    return this.shopShelf().filter((i) => i.tab === tab);
  }

  /** Put on a uniform with no checks (finale parts, glowing stations, spec 007). */
  forceJob(job: JobId): void {
    this.save.update((s) => (s.job = job));
    this.save.flush();
  }

  /** Put on another uniform (Job Center). False if it isn't allowed yet. */
  switchJob(job: JobId): boolean {
    if (uniformState(job, this.job, this.save.data.badges, this.content.missions) !== 'open')
      return false;
    this.save.update((s) => (s.job = job));
    this.mission = null;
    this.save.flush();
    return true;
  }

  /** Buy a Shop item: false if it's already owned or the player can't afford it yet. */
  buy(itemId: string): boolean {
    const item = this.content.shop.find((i) => i.id === itemId);
    if (!item) throw new Error(`no shop item ${itemId}`);
    if (this.owns(itemId)) return false;
    if (!this.economy.spend(item.price)) return false;
    this.save.update((s) => s.owned.push(itemId));
    this.save.flush();
    return true;
  }

  /** Wear a hat you own (null = your uniform's own hat). */
  wear(hat: string | null): boolean {
    if (hat !== null && !this.owns(hat)) return false;
    this.save.update((s) => (s.hat = hat));
    this.save.flush();
    return true;
  }

  /** Paint your own car with a paint you own (null = plain). */
  applyPaint(paint: string | null): boolean {
    if (paint !== null && !this.owns(paint)) return false;
    this.save.update((s) => (s.paint = paint));
    this.save.flush();
    return true;
  }

  /** Save the apartment layout. */
  saveApartment(layout: { item: string; gx: number; gy: number }[]): void {
    this.save.update((s) => (s.apartment = layout));
    this.save.flush();
  }

  /** Give the player something for free (the cap at First Day). */
  give(itemId: string): void {
    if (this.owns(itemId)) return;
    this.save.update((s) => s.owned.push(itemId));
  }
}
