import type Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { addBakedImage, getBaked } from '../art/blocks';
import { MPROP } from '../art/missionProps';
import { DuckLine } from '../entities/DuckLine';
import type { RobberChase } from '../entities/RobberChase';
import { depthOf, gridToScreen, type Vec2 } from '../iso/projection';
import { EscortState } from '../systems/escort';
import { FindState } from '../systems/find';
import type { Goal, MissionEvent } from '../systems/missions';
import type { MissionWorld, VehicleId } from './world';

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
    if (this.w.moveMode() === 'car') return null;
    const v = this.w.vehicle(this.c.vehicle);
    if (!v) return null;
    return { at: v.pos, line: this.c.vehicle === 'police-bike' ? 'hint-bike' : 'hint-car' };
  }
}

const VEHICLE_IDS: VehicleId[] = ['police-car', 'police-bike', 'fire-truck', 'mixer-truck'];
const GOTO_LINES: Record<string, string> = {
  'police-car': 'hint-car',
  'police-bike': 'hint-bike',
  mayor: 'hint-mayor',
  'puppy-owner': 'hint-owner',
};

/** Go somewhere: hop into a vehicle (CityScene reports it), or reach a person/place. */
export class GoToHandler extends GoalHandler {
  constructor(
    c: HandlerCtx,
    private readonly target: string,
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
  }

  override update(): void {
    if (this.isVehicle) return;
    if (dist(this.w.focus(), this.w.marker(this.target)) < 1.7)
      this.c.notify({ type: 'reached', target: this.target });
  }

  hint(): Hint | null {
    if (this.isVehicle) {
      const v = this.w.vehicle(this.target as VehicleId);
      return v ? { at: v.pos, line: GOTO_LINES[this.target] ?? 'hint-car' } : null;
    }
    return { at: this.w.marker(this.target), line: GOTO_LINES[this.target] ?? 'hint-errand' };
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

/** Drive through checkpoint flags (First Day). */
export class CheckpointsHandler extends GoalHandler {
  private flags = new Map<string, Phaser.GameObjects.Image>();

  constructor(
    c: HandlerCtx,
    private readonly ids: string[],
  ) {
    super(c);
  }

  override start(): void {
    for (const id of this.ids) {
      const m = this.w.marker(id);
      const s = gridToScreen(m.x, m.y);
      const img = addBakedImage(this.w.stage, getBaked(MPROP.flag), s.x, s.y).setDepth(
        depthOf(m.x, m.y) + 35,
      );
      const full = img.scaleX;
      img.setScale(0);
      this.w.stage.tweens.add({ targets: img, scale: full, duration: 300, ease: 'Back.easeOut' });
      this.flags.set(id, img);
    }
  }

  override update(): void {
    const r = this.w.riding();
    if (!r) return;
    for (const id of this.ids) {
      if (dist(r.vehicle.pos, this.w.marker(id)) < 1.4)
        this.c.notify({ type: 'checkpoint', flag: id });
    }
  }

  override onPart(part: string): void {
    const img = this.flags.get(part);
    if (!img) return;
    img.setTexture(MPROP.flagDone);
    sfx.play('sparkle');
    voice.say('flag', { interrupt: true });
    this.w.stage.tweens.add({ targets: img, y: img.y - 16, duration: 140, yoyo: true });
  }

  hint(): Hint | null {
    const v = this.vehicleHint();
    if (v) return v;
    const f = this.w.focus();
    const left = this.ids.filter((id) => this.flags.get(id)?.texture.key === MPROP.flag);
    left.sort((a, b) => dist(this.w.marker(a), f) - dist(this.w.marker(b), f));
    return left[0] ? { at: this.w.marker(left[0]), line: 'hint-flags' } : null;
  }

  override end(): void {
    for (const img of this.flags.values()) {
      img.setTexture(MPROP.flagDone);
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

/** Placeholder for goal types whose job spec isn't built yet: it hints at nothing. */
export class NoopHandler extends GoalHandler {
  hint(): null {
    return null;
  }
}

export function makeHandler(goal: Goal, c: HandlerCtx): GoalHandler {
  switch (goal.type) {
    case 'goTo':
      return new GoToHandler(c, goal.target);
    case 'catch':
      return new CatchHandler(c, goal);
    case 'checkpoints':
      return new CheckpointsHandler(c, goal.flags);
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
    default:
      return new NoopHandler(c);
  }
}
