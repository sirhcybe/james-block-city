import type Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { addBakedImage, getBaked } from '../art/blocks';
import { boatFrameKey, SAILBOAT, SEA } from '../art/boats';
import { MPROP } from '../art/missionProps';
import { DuckLine } from '../entities/DuckLine';
import type { RobberChase } from '../entities/RobberChase';
import { depthOf, gridToScreen, type Vec2 } from '../iso/projection';
import { EscortState } from '../systems/escort';
import { FindState } from '../systems/find';
import type { Goal, MissionEvent } from '../systems/missions';
import { DRIVE_REACH, type MissionWorld, type VehicleId } from './world';

export interface Hint {
  at: Vec2;
  line: string;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/** Context a handler gets: the world, a way to report events, and the mission's main vehicle. */
export interface HandlerCtx {
  w: MissionWorld;
  notify(e: MissionEvent): void;
  /** The vehicle this mission is played in (car by default, the bike for bike missions). */
  vehicle: VehicleId;
  /** Hand a found pet/thing to the director so it keeps following the player between goals. */
  setCompanion(img: Phaser.GameObjects.Image | null): void;
}

/** One goal's behaviour in the world: set-up, per-frame checks, hint target, clean-up. */
export abstract class GoalHandler {
  constructor(protected readonly c: HandlerCtx) {}
  start(): void {}
  update(_dt: number): void {}
  /** Part of a multi-part goal got done (a flag, one of two robbers). */
  onPart(_part: string): void {}
  onSiren(): void {}
  abstract hint(): Hint | null;
  end(): void {}

  protected get w(): MissionWorld {
    return this.c.w;
  }

  /** "Hop in your car" hint when the goal needs driving and the player is walking. */
  protected vehicleHint(): Hint | null {
    // Driving something counts, except on a boat mission: only the boat gets you there.
    const r = this.w.riding();
    if (r && (r.id === this.c.vehicle || this.c.vehicle !== 'rescue-boat')) return null;
    const v = this.w.vehicle(this.c.vehicle);
    if (!v) return null;
    return { at: v.pos, line: GOTO_LINES[this.c.vehicle] ?? 'hint-car' };
  }
}

const VEHICLE_IDS: VehicleId[] = [
  'police-car',
  'police-bike',
  'fire-truck',
  'mixer-truck',
  'rescue-boat',
];
const GOTO_LINES: Record<string, string> = {
  'police-car': 'hint-car',
  'police-bike': 'hint-bike',
  'fire-truck': 'hint-truck',
  'mixer-truck': 'hint-mixer',
  'rescue-boat': 'hint-boat',
  'dock-landing': 'hint-dock',
  castaway: 'hint-castaway',
  sailboat: 'hint-sailboat',
  mayor: 'hint-mayor',
  island: 'hint-island',
  'puppy-owner': 'hint-owner',
};

/** Go somewhere: hop into a vehicle (CityScene reports it), or reach a person/place. */
export class GoToHandler extends GoalHandler {
  /** Whatever waits at the target to be fetched (a kitten, a sailboat), until it's picked up. */
  private waiting: Phaser.GameObjects.Image | null = null;

  constructor(
    c: HandlerCtx,
    private readonly target: string,
    private readonly carry?: 'kitten' | 'sailboat',
  ) {
    super(c);
  }

  private get isVehicle(): boolean {
    return (VEHICLE_IDS as string[]).includes(this.target);
  }

  override start(): void {
    const r = this.w.riding();
    if (this.isVehicle && r?.id === this.target)
      this.c.notify({ type: 'reached', target: this.target });
    if (!this.carry) return;
    const perch = `${this.target}-perch`;
    const at = this.w.marker(this.w.hasMarker(perch) ? perch : this.target);
    const s = gridToScreen(at.x, at.y);
    const key = this.carry === 'kitten' ? MPROP.kitten : boatFrameKey(SAILBOAT.name, 1, 0);
    const img = addBakedImage(this.w.stage, getBaked(key), s.x, s.y).setDepth(
      depthOf(at.x, at.y) + 45,
    );
    this.w.stage.tweens.add({
      targets: img,
      y: s.y - 5,
      angle: this.carry === 'sailboat' ? { from: -4, to: 4 } : 0,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.waiting = img;
  }

  override update(): void {
    if (this.isVehicle) return;
    // A boat mission is only done from the boat (you can't walk a kitten home across the sea).
    if (this.c.vehicle === 'rescue-boat' && this.w.riding()?.id !== 'rescue-boat') return;
    const reach = 1.7 + (this.w.moveMode() === 'car' ? DRIVE_REACH : 0);
    if (dist(this.w.focus(), this.w.marker(this.target)) < reach) {
      if (this.waiting) {
        // It hops aboard (or is tied on) and follows from here.
        const img = this.waiting;
        this.waiting = null;
        this.w.stage.tweens.killTweensOf(img);
        img.setAngle(0);
        sfx.play('pop', 1.3);
        voice.say(this.carry === 'kitten' ? 'castaway-got' : 'sailboat-got', { interrupt: true });
        this.c.setCompanion(img);
      }
      this.c.notify({ type: 'reached', target: this.target });
    }
  }

  hint(): Hint | null {
    if (this.isVehicle) {
      const v = this.w.vehicle(this.target as VehicleId);
      return v ? { at: v.pos, line: GOTO_LINES[this.target] ?? 'hint-car' } : null;
    }
    if (this.c.vehicle === 'rescue-boat') {
      const v = this.vehicleHint();
      if (v) return v;
    }
    return { at: this.w.marker(this.target), line: GOTO_LINES[this.target] ?? 'hint-errand' };
  }

  override end(): void {
    this.waiting?.destroy();
    this.waiting = null;
  }
}

/** Catch one or more Bandit Brothers (any order). They sneak out of Time-Out Tower first. */
export class CatchHandler extends GoalHandler {
  private robbers: RobberChase[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];

  constructor(
    c: HandlerCtx,
    private readonly goal: Extract<Goal, { type: 'catch' }>,
  ) {
    super(c);
  }

  override start(): void {
    const sneak = this.w.tower.sneakOut();
    if (sneak > 0) voice.say('tower-sneak', { interrupt: true });
    this.robbers = this.goal.robbers.map((spec) =>
      this.w.spawnRobber(spec, this.goal.bumps, (name) => {
        this.w.tower.addInmate(name);
        this.c.notify({ type: 'caught', robber: name });
      }),
    );
    const line =
      this.robbers.length > 1
        ? 'chase-both'
        : this.robbers[0]!.name === 'smudge'
          ? 'chase-smudge'
          : 'chase-start';
    this.timers.push(
      this.w.stage.time.delayedCall(sneak + 900, () => {
        voice.say(line, { interrupt: sneak === 0 });
        for (const r of this.robbers) r.start();
      }),
    );
  }

  override onPart(): void {
    voice.say('one-more');
  }

  hint(): Hint | null {
    const v = this.vehicleHint();
    if (v) return v;
    const f = this.w.focus();
    const fleeing = this.robbers.filter((r) => r.phase === 'fleeing' || r.phase === 'parked');
    fleeing.sort((a, b) => dist(a.pos, f) - dist(b.pos, f));
    return fleeing[0] ? { at: fleeing[0].pos, line: 'hint-chase' } : null;
  }

  override end(): void {
    for (const t of this.timers) t.remove();
    for (const r of this.robbers) this.w.removeRobber(r);
    this.robbers = [];
  }
}

/**
 * Drive through checkpoint flags (First Day), or fetch ducklings on floaties with the boat
 * (Duckling Patrol). Every point gets a tall beam of light so it shows from far away.
 */
export class CheckpointsHandler extends GoalHandler {
  private flags = new Map<string, Phaser.GameObjects.Image>();
  private beams = new Map<string, Phaser.GameObjects.Image>();
  private done = new Set<string>();

  constructor(
    c: HandlerCtx,
    private readonly ids: string[],
    private readonly look: 'flag' | 'floaty' = 'flag',
  ) {
    super(c);
  }

  private get floaty(): boolean {
    return this.look === 'floaty';
  }

  override start(): void {
    for (const id of this.ids) {
      const m = this.w.marker(id);
      const s = gridToScreen(m.x, m.y);
      const beam = addBakedImage(this.w.stage, getBaked(SEA.beam), s.x, s.y - 30)
        .setDepth(depthOf(m.x, m.y) + 34)
        .setAlpha(0);
      this.w.stage.tweens.add({
        targets: beam,
        alpha: { from: 0.35, to: 0.9 },
        duration: 700,
        yoyo: true,
        repeat: -1,
      });
      this.beams.set(id, beam);
      const img = addBakedImage(
        this.w.stage,
        getBaked(this.floaty ? SEA.floaty : MPROP.flag),
        s.x,
        s.y,
      ).setDepth(depthOf(m.x, m.y) + 35);
      const full = img.scaleX;
      img.setScale(0);
      this.w.stage.tweens.add({ targets: img, scale: full, duration: 300, ease: 'Back.easeOut' });
      if (this.floaty)
        this.w.stage.tweens.add({
          targets: img,
          y: s.y - 4,
          angle: { from: -6, to: 6 },
          duration: 900,
          delay: 300,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      this.flags.set(id, img);
    }
    if (this.floaty) voice.say('floaties-now');
  }

  override update(): void {
    const r = this.w.riding();
    if (!r) return;
    if (this.floaty && r.id !== 'rescue-boat') return;
    for (const id of this.ids) {
      if (dist(r.vehicle.pos, this.w.marker(id)) < 1.4)
        this.c.notify({ type: 'checkpoint', flag: id });
    }
  }

  override onPart(part: string): void {
    const img = this.flags.get(part);
    if (!img) return;
    this.done.add(part);
    this.dropBeam(part);
    sfx.play('sparkle');
    if (this.floaty) {
      // The duckling hops into the boat; its floaty drifts off.
      img.setTexture(SEA.floatyEmpty);
      const f = this.w.focus();
      const to = gridToScreen(f.x, f.y);
      const duck = addBakedImage(
        this.w.stage,
        getBaked(MPROP.duckling),
        img.x,
        img.y - 12,
      ).setDepth(img.depth + 60);
      this.w.stage.tweens.add({
        targets: duck,
        x: to.x,
        y: to.y - 30,
        scale: duck.scaleX * 0.5,
        duration: 450,
        ease: 'Quad.easeOut',
        onComplete: () => duck.destroy(),
      });
      sfx.play('quack', 1.3);
      voice.say('floaty-got', { interrupt: true });
      this.w.stage.tweens.add({ targets: img, alpha: 0, delay: 500, duration: 900 });
      return;
    }
    img.setTexture(MPROP.flagDone);
    voice.say('flag', { interrupt: true });
    this.w.stage.tweens.add({ targets: img, y: img.y - 16, duration: 140, yoyo: true });
  }

  private dropBeam(id: string): void {
    const beam = this.beams.get(id);
    if (!beam) return;
    this.beams.delete(id);
    this.w.stage.tweens.killTweensOf(beam);
    this.w.stage.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 300,
      onComplete: () => beam.destroy(),
    });
  }

  hint(): Hint | null {
    const v = this.vehicleHint();
    if (v) return v;
    const f = this.w.focus();
    const left = this.ids.filter((id) => !this.done.has(id));
    left.sort((a, b) => dist(this.w.marker(a), f) - dist(this.w.marker(b), f));
    return left[0]
      ? { at: this.w.marker(left[0]), line: this.floaty ? 'hint-floaties' : 'hint-flags' }
      : null;
  }

  override end(): void {
    for (const id of [...this.beams.keys()]) this.dropBeam(id);
    for (const img of this.flags.values()) {
      if (!this.floaty) img.setTexture(MPROP.flagDone);
      this.w.stage.tweens.killTweensOf(img);
      this.w.stage.tweens.add({
        targets: img,
        alpha: 0,
        delay: 600,
        duration: 500,
        onComplete: () => img.destroy(),
      });
    }
    this.flags.clear();
  }
}

/** Press the siren once while driving. */
export class SirenHandler extends GoalHandler {
  override start(): void {
    voice.say('siren-now');
  }

  override onSiren(): void {
    if (this.w.riding()) this.c.notify({ type: 'siren' });
  }

  hint(): Hint {
    return this.vehicleHint() ?? { at: this.w.focus(), line: 'hint-siren' };
  }
}

const MINIGAME_LINES: Record<string, string> = {
  'traffic-helper': 'traffic-now',
  'who-took-it': 'who-took-it-now',
};

/** Play a minigame (walk onto its pad). CityScene reports when it's done. */
export class MinigameHandler extends GoalHandler {
  constructor(
    c: HandlerCtx,
    private readonly id: string,
  ) {
    super(c);
  }

  override start(): void {
    const line = MINIGAME_LINES[this.id];
    if (line) voice.say(line);
  }

  hint(): Hint {
    return { at: this.w.marker(this.id), line: 'hint-pad' };
  }
}

/** Do an errand. */
export class ErrandHandler extends GoalHandler {
  constructor(
    c: HandlerCtx,
    private readonly id: string,
  ) {
    super(c);
  }

  hint(): Hint | null {
    const who = this.w.state.errands.receiver(this.id);
    return this.w.hasMarker(who) ? { at: this.w.marker(who), line: 'hint-errand' } : null;
  }
}

/** Duck Crossing: walk to the ducks, they follow you in a line; lead them to the pond. */
export class EscortHandler extends GoalHandler {
  private state!: EscortState;
  private line!: DuckLine;
  private lastPhase: string = 'lost';

  constructor(
    c: HandlerCtx,
    private readonly goal: Extract<Goal, { type: 'escort' }>,
  ) {
    super(c);
  }

  override start(): void {
    const from = this.w.marker(this.goal.from);
    this.state = new EscortState(from, 4, this.w.marker(this.goal.to));
    this.line = new DuckLine(this.w.stage, this.state);
  }

  private trafficComing(): boolean {
    const m = this.state.ducks[0]!;
    return this.w.traffic.some((t) => !t.stoppedForSiren && dist(t.pos, m) < 3.5);
  }

  override update(dt: number): void {
    const leader = this.w.moveMode() === 'foot' ? this.w.playerPos() : { x: -99, y: -99 };
    const next = this.state.nextStep();
    const roadAhead = this.w.tileKind(Math.floor(next.x), Math.floor(next.y)) === 'road';
    const phase = this.state.update(dt, leader, roadAhead, this.trafficComing());
    this.line.update(dt);
    this.w.setObstacles('ducks', this.state.ducks);
    if (phase !== this.lastPhase) {
      if (this.lastPhase === 'lost' && phase !== 'lost') {
        voice.say('ducks-follow');
        sfx.play('quack');
      }
      if (phase === 'waiting') voice.say('ducks-wait');
      if (phase === 'kerb') {
        voice.say('ducks-kerb', { minGapMs: 6000 });
        sfx.play('quack', 0.8);
      }
      if (phase === 'delivered') {
        this.line.celebrate(this.w.marker(this.goal.to));
        sfx.play('quack', 1.2);
        sfx.play('splash');
        this.c.notify({ type: 'escorted', group: this.goal.group });
      }
      this.lastPhase = phase;
    }
  }

  hint(): Hint {
    return this.state.phase === 'lost' || this.state.phase === 'waiting'
      ? { at: this.state.ducks[0]!, line: 'hint-ducks' }
      : { at: this.w.marker(this.goal.to), line: 'hint-pond' };
  }

  override end(): void {
    this.w.setObstacles('ducks', []);
    const line = this.line;
    this.w.stage.time.delayedCall(2200, () => line.destroy());
  }
}

/** Lost Puppy: follow the barks and paw prints to the hiding spots; the puppy is in the last. */
export class FindHandler extends GoalHandler {
  private state!: FindState;
  private prints: Phaser.GameObjects.Image[] = [];

  constructor(
    c: HandlerCtx,
    private readonly goal: Extract<Goal, { type: 'find' }>,
  ) {
    super(c);
  }

  override start(): void {
    this.state = new FindState(this.goal.spots.map((s) => this.w.marker(s)));
    this.layPrints(this.w.focus());
  }

  /** A trail of paw prints leading toward the current spot (the last few steps before it). */
  private layPrints(from: Vec2): void {
    for (const p of this.prints) p.destroy();
    this.prints = [];
    const to = this.state.current;
    const n = this.state.easier ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const k = 1 - (i + 1) * (this.state.easier ? 0.1 : 0.12);
      const at = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
      const s = gridToScreen(at.x, at.y);
      const img = addBakedImage(this.w.stage, getBaked(MPROP.paw), s.x, s.y)
        .setDepth(-999_000)
        .setAlpha(0);
      this.w.stage.tweens.add({ targets: img, alpha: 1, delay: i * 90, duration: 200 });
      this.prints.push(img);
    }
  }

  private wasEasier = false;

  override update(dt: number): void {
    const f = this.w.focus();
    for (const e of this.state.update(dt, f)) {
      if (e.type === 'bark') {
        sfx.play('woof', 1, Math.max(0.15, e.volume));
        if (e.volume > 0.8) voice.say('woof', { minGapMs: 7000 });
      } else if (e.type === 'empty') {
        const at = this.w.marker(this.goal.spots[e.spot]!);
        this.shake(at);
        voice.say('not-here', { interrupt: true });
        this.layPrints(at);
      } else if (e.type === 'found') {
        const at = this.state.current;
        this.shake(at);
        for (const p of this.prints) p.destroy();
        this.prints = [];
        const s = gridToScreen(at.x, at.y);
        const pup = addBakedImage(this.w.stage, getBaked(MPROP.puppy), s.x, s.y);
        const full = pup.scaleX;
        pup.setScale(0);
        this.w.stage.tweens.add({ targets: pup, scale: full, duration: 300, ease: 'Back.easeOut' });
        sfx.play('woof', 1.2);
        voice.say('puppy-found', { interrupt: true });
        this.c.setCompanion(pup);
        this.c.notify({ type: 'found', item: this.goal.item });
      }
    }
    if (this.state.easier && !this.wasEasier) {
      this.wasEasier = true;
      this.layPrints(f);
    }
  }

  private shake(at: Vec2): void {
    const s = gridToScreen(at.x, at.y);
    const img = addBakedImage(this.w.stage, getBaked(MPROP.bushShake), s.x, s.y).setDepth(
      depthOf(at.x, at.y) + 45,
    );
    this.w.stage.tweens.add({
      targets: img,
      x: s.x + 3,
      duration: 60,
      yoyo: true,
      repeat: 5,
      onComplete: () => img.destroy(),
    });
    this.w.puff({ x: at.x, y: at.y - 0.3 });
    sfx.play('pop');
  }

  hint(): Hint {
    return { at: this.state.current, line: 'hint-find' };
  }

  override end(): void {
    for (const p of this.prints) p.destroy();
    this.prints = [];
  }
}

/** Spray fires out (spec 004). The world lights them; the hose puts them out. */
export class SprayHandler extends GoalHandler {
  constructor(
    c: HandlerCtx,
    private readonly fires: string[],
  ) {
    super(c);
  }

  override start(): void {
    for (const f of this.fires) this.w.lightFire(f);
    const practice = this.fires.length === 1 && this.fires[0] === 'practice-fire';
    voice.say(practice ? 'spray-now' : 'hint-spray');
  }

  override onPart(): void {
    voice.say('pfft', { interrupt: true });
  }

  hint(): Hint | null {
    const burning = this.fires.filter((f) => this.w.fireBurning(f)).map((f) => this.w.perch(f));
    if (burning.length === 0) return null;
    const f = this.w.focus();
    burning.sort((a, b) => dist(a, f) - dist(b, f));
    const target = burning[0]!;
    // High fires need the truck, and fires out at sea need the boat: hint at it while walking.
    if (target.z > 1.5 || this.c.vehicle === 'rescue-boat') {
      const v = this.vehicleHint();
      if (v) return v;
    }
    return { at: target, line: dist(target, f) < 3.5 ? 'hint-spray' : 'hint-fire-far' };
  }

  override end(): void {
    for (const f of this.fires) this.w.removeFire(f);
  }
}

/** Park the truck by the tower; the ladder goes up, the pet slides down to its owner (spec 004). */
export class RescueHandler extends GoalHandler {
  private pet: Phaser.GameObjects.Image | null = null;
  private ladder: { destroy(): void } | null = null;
  private phase: 'waiting' | 'rescuing' | 'done' = 'waiting';
  private timers: Phaser.Time.TimerEvent[] = [];

  constructor(
    c: HandlerCtx,
    private readonly goal: Extract<Goal, { type: 'rescue' }>,
  ) {
    super(c);
  }

  override start(): void {
    const p = this.w.perch(this.goal.perch);
    const s = gridToScreen(p.x, p.y);
    const key = this.goal.pet === 'parrot' ? MPROP.parrot : MPROP.kitten;
    const pet = addBakedImage(this.w.stage, getBaked(key), s.x, s.y - p.z * 32);
    pet.setDepth(depthOf(p.x, p.y) + 220);
    this.w.stage.tweens.add({ targets: pet, y: pet.y - 6, duration: 400, yoyo: true, repeat: -1 });
    this.pet = pet;
  }

  override update(): void {
    if (this.phase !== 'waiting') return;
    const r = this.w.riding();
    if (!r || r.id !== this.c.vehicle) return;
    const at = this.w.marker(this.goal.at);
    if (dist(r.vehicle.pos, at) > 2.6 || Math.abs(r.vehicle.driver.speed) > 0.6) return;
    const p = this.w.perch(this.goal.perch);
    if (p.z > this.w.ladderReach()) {
      voice.say('too-high', { minGapMs: 8000 });
      return;
    }
    this.phase = 'rescuing';
    r.vehicle.driver.speed = 0;
    voice.say('ladder-up', { interrupt: true });
    sfx.play('whoosh', 0.7);
    const from = { ...r.vehicle.pos };
    this.ladder = this.w.raiseLadder(from, p, 1200);
    const scene = this.w.stage;
    this.timers.push(
      scene.time.delayedCall(1300, () => {
        const pet = this.pet;
        if (!pet) return;
        scene.tweens.killTweensOf(pet);
        const down = gridToScreen(from.x, from.y);
        sfx.play('pop', 1.4);
        scene.tweens.add({
          targets: pet,
          x: down.x,
          y: down.y - 30,
          duration: 1000,
          ease: 'Quad.easeIn',
          onComplete: () => this.handOver(),
        });
      }),
    );
  }

  /** The pet hops to its owner (or just cheers), then the goal is done. */
  private handOver(): void {
    const pet = this.pet;
    if (!pet) return;
    this.ladder?.destroy();
    this.ladder = null;
    const owner = this.goal.pet === 'kitten' ? this.w.townsperson('kitty-owner') : null;
    const to = owner
      ? gridToScreen(owner.pos.x + 0.4, owner.pos.y + 0.2)
      : { x: pet.x, y: pet.y + 20 };
    sfx.play('pop', 1.3);
    this.w.stage.tweens.add({
      targets: pet,
      x: to.x,
      y: to.y,
      duration: 600,
      ease: 'Quad.easeOut',
    });
    owner?.cheer();
    this.phase = 'done';
    this.pet = null;
    this.c.notify({ type: 'rescued', pet: this.goal.pet });
    this.w.stage.tweens.add({
      targets: pet,
      alpha: 0,
      delay: 5000,
      duration: 600,
      onComplete: () => pet.destroy(),
    });
  }

  hint(): Hint | null {
    return this.vehicleHint() ?? { at: this.w.marker(this.goal.at), line: 'hint-rescue' };
  }

  override end(): void {
    for (const t of this.timers) t.remove();
    this.ladder?.destroy();
    if (this.pet && this.phase !== 'done') this.pet.destroy();
  }
}

/** Walk in through a door to a room (the kitchen); the room scene does the rest (spec 004). */
export class InsideHandler extends GoalHandler {
  private door: Phaser.GameObjects.Image | null = null;
  private went = false;

  constructor(
    c: HandlerCtx,
    private readonly goal: Extract<Goal, { type: 'inside' }>,
  ) {
    super(c);
  }

  override start(): void {
    const m = this.w.marker(this.goal.at);
    const s = gridToScreen(m.x, m.y);
    const door = addBakedImage(this.w.stage, getBaked(MPROP.door), s.x, s.y).setDepth(-999_985);
    this.w.stage.tweens.add({
      targets: door,
      scaleY: door.scaleY * 1.1,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
    this.door = door;
  }

  override update(): void {
    if (this.went || this.w.moveMode() !== 'foot') return;
    if (dist(this.w.playerPos(), this.w.marker(this.goal.at)) < 0.75) {
      this.went = true;
      this.w.goInside(this.goal.room);
    }
  }

  hint(): Hint {
    return { at: this.w.marker(this.goal.at), line: 'hint-door' };
  }

  override end(): void {
    this.door?.destroy();
  }
}

/** Build something on a build spot with the block blaster (spec 005). */
export class BuildHandler extends GoalHandler {
  constructor(
    c: HandlerCtx,
    private readonly spot: string,
  ) {
    super(c);
  }

  override start(): void {
    this.w.startSite(this.spot);
    voice.say('build-now');
  }

  hint(): Hint | null {
    const v = this.vehicleHint();
    if (v) return v;
    const at = `${this.spot}-at`;
    return { at: this.w.hasMarker(at) ? this.w.marker(at) : this.w.focus(), line: 'hint-build' };
  }

  override end(): void {
    if (!this.w.siteDone(this.spot)) this.w.stopSite(this.spot);
  }
}

/** Placeholder for goal types whose job spec isn't built yet: it hints at nothing. */
export class NoopHandler extends GoalHandler {
  hint(): null {
    return null;
  }
}

export function makeHandler(goal: Goal, c: HandlerCtx): GoalHandler {
  switch (goal.type) {
    case 'goTo':
      return new GoToHandler(c, goal.target, goal.carry);
    case 'catch':
      return new CatchHandler(c, goal);
    case 'checkpoints':
      return new CheckpointsHandler(c, goal.flags, goal.look);
    case 'siren':
      return new SirenHandler(c);
    case 'minigame':
      return new MinigameHandler(c, goal.id);
    case 'errand':
      return new ErrandHandler(c, goal.id);
    case 'escort':
      return new EscortHandler(c, goal);
    case 'find':
      return new FindHandler(c, goal);
    case 'spray':
      return new SprayHandler(c, goal.fires);
    case 'rescue':
      return new RescueHandler(c, goal);
    case 'inside':
      return new InsideHandler(c, goal);
    case 'build':
      return new BuildHandler(c, goal.spot);
    default:
      return new NoopHandler(c);
  }
}
