import type Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { getBaked } from '../art/blocks';
import type { IconName } from '../art/icons';
import { bubbleKey } from '../art/missionProps';
import { depthOf, gridToScreen, type Vec2 } from '../iso/projection';
import type { MissionResult } from '../systems/GameState';
import type { Goal, Mission, MissionEvent, MissionRun } from '../systems/missions';
import { EV } from '../scenes/keys';
import { JOBS } from '../systems/jobs';
import { makeHandler, type GoalHandler, type Hint } from './handlers';
import type { MissionWorld, VehicleId } from './world';

/** How close (tiles) you must come to the chief for them to start the next mission. */
const CHIEF_TALK_DIST = 1.6;

/** The vehicle a mission is played in: a bike mission if it ever asks for the bike. */
function missionVehicle(m: Mission): VehicleId {
  const goTos = m.goals.filter((g): g is Extract<Goal, { type: 'goTo' }> => g.type === 'goTo');
  for (const g of goTos)
    if (['police-bike', 'fire-truck', 'mixer-truck'].includes(g.target))
      return g.target as VehicleId;
  if (m.job === 'fire') return 'fire-truck';
  if (m.job === 'builder') return 'mixer-truck';
  return 'police-car';
}

/**
 * Runs missions (spec 003 plan B): the boss offers the next one with a picture bubble, walking up
 * starts it with a voice intro, each goal gets a handler (set-up, checks, hint target, clean-up),
 * and finishing pays, saves, and maybe awards a badge. Replays come from the mission board.
 */
export class MissionDirector {
  run: MissionRun | null = null;
  private handler: GoalHandler | null = null;
  private nearBoss = false;
  /** A found pet that follows the player until the mission ends (Lost Puppy). */
  private companion: { img: Phaser.GameObjects.Image; pos: Vec2; trail: Vec2[] } | null = null;
  /** Seconds before the boss offers again after a mission (so you don't start one by accident). */
  private cooldown = 0;

  constructor(private readonly w: MissionWorld) {}

  get busy(): boolean {
    return this.run !== null;
  }

  get goal(): Goal | null {
    return this.run?.goal ?? null;
  }

  /** The mission the boss offers right now, if any. */
  offer(): Mission | null {
    if (this.run || this.cooldown > 0) return null;
    return this.w.state.nextMission();
  }

  bossId(): string {
    return JOBS[this.w.state.job].boss;
  }

  /** Start a mission now (the boss, the mission board, or a test). */
  begin(id: string): void {
    this.abort();
    const def = this.w.state.missionDef(id);
    this.run = this.w.state.startMission(id, this.w.now());
    // The boss hands over the uniform's hat on the job's first mission.
    const first = this.w.state.content.missions.find((m) => m.job === def.job);
    if (first?.id === id) this.w.give(JOBS[def.job].gift);
    const boss = this.w.townsperson(this.bossId());
    boss?.setOffering(false);
    boss?.cheer();
    sfx.play('tada', 1.2, 0.6);
    voice.say(def.voiceIntro, { interrupt: true });
    this.startGoal();
  }

  /** Stop the current run without finishing it (a replay was picked instead). No penalty. */
  abort(): void {
    this.handler?.end();
    this.handler = null;
    this.run = null;
    this.dropCompanion();
    this.w.state.mission = null;
  }

  private ctx(): Parameters<typeof makeHandler>[1] {
    return {
      w: this.w,
      notify: (e) => this.notify(e),
      vehicle: this.run ? missionVehicle(this.run.mission) : 'police-car',
      setCompanion: (img) => this.setCompanion(img),
    };
  }

  private startGoal(): void {
    const g = this.run?.goal;
    if (!g) return;
    this.handler = makeHandler(g, this.ctx());
    this.handler.start();
  }

  /** A world event: maybe it finishes a goal or the mission. */
  notify(e: MissionEvent): void {
    const run = this.run;
    if (!run) return;
    const r = run.notify(e, this.w.now());
    if (r === 'part') {
      this.handler?.onPart(run.lastPart ?? '');
      return;
    }
    if (r === 'goal') {
      this.handler?.end();
      this.startGoal();
      return;
    }
    if (r === 'complete') this.finish();
  }

  private finish(): void {
    const run = this.run!;
    this.handler?.end();
    this.handler = null;
    const res: MissionResult = this.w.state.completeMission();
    this.run = null;
    this.cooldown = 4;
    this.handOverCompanion(run.mission);
    const scene = this.w.stage;
    scene.time.delayedCall(900, () => {
      sfx.play('tada');
      voice.say(run.mission.voiceDone, { interrupt: true });
      scene.game.events.emit(EV.missionComplete, res);
    });
    if (res.badge) {
      const badge = res.badge;
      scene.time.delayedCall(4200, () => {
        voice.say('badge', { interrupt: true });
        scene.game.events.emit(EV.badge, badge);
      });
    }
  }

  /** The siren (or whistle) went off. */
  onSiren(): void {
    this.handler?.onSiren();
  }

  private setCompanion(img: Phaser.GameObjects.Image | null): void {
    this.dropCompanion();
    if (!img) return;
    const s = this.w.focus();
    this.companion = { img, pos: { ...s }, trail: [] };
  }

  private dropCompanion(): void {
    this.companion?.img.destroy();
    this.companion = null;
  }

  /** The pet hops over to its family at the end of the mission. */
  private handOverCompanion(m: Mission): void {
    const c = this.companion;
    if (!c) return;
    this.companion = null;
    const owner = m.goals.at(-1);
    const to =
      owner?.type === 'goTo' && this.w.hasMarker(owner.target)
        ? this.w.marker(owner.target)
        : c.pos;
    const s = gridToScreen(to.x + 0.4, to.y + 0.3);
    this.w.stage.tweens.add({
      targets: c.img,
      x: s.x,
      y: s.y,
      duration: 500,
      ease: 'Quad.easeOut',
    });
    this.w.stage.tweens.add({
      targets: c.img,
      y: s.y - 18,
      delay: 500,
      duration: 160,
      yoyo: true,
      repeat: 3,
    });
    this.w.stage.tweens.add({
      targets: c.img,
      alpha: 0,
      delay: 6000,
      duration: 600,
      onComplete: () => c.img.destroy(),
    });
  }

  private updateCompanion(): void {
    const c = this.companion;
    if (!c) return;
    const f = this.w.focus();
    const last = c.trail[c.trail.length - 1];
    if (!last || Math.hypot(f.x - last.x, f.y - last.y) > 0.15) c.trail.push({ ...f });
    if (c.trail.length > 8) {
      const t = c.trail.shift()!;
      c.pos = t;
    }
    const s = gridToScreen(c.pos.x, c.pos.y);
    c.img.setPosition(s.x, s.y).setDepth(depthOf(c.pos.x, c.pos.y) + 40);
  }

  update(dt: number): void {
    if (this.cooldown > 0) this.cooldown -= dt;
    this.handler?.update(dt);
    this.updateCompanion();
    this.updateBoss();
  }

  /** The boss's bubble shows the next mission's picture; walking up to them starts it. */
  private updateBoss(): void {
    const boss = this.w.townsperson(this.bossId());
    if (!boss) return;
    const next = this.offer();
    const upgrade = this.w.state.content.shop.find((i) => i.job === this.w.state.job);
    const needBike = !next && !this.run && !!upgrade && this.lockedOnlyByShop();
    if (next) {
      boss.setBubble(getBaked(bubbleKey(next.icon as IconName)));
      boss.setOffering(true);
    } else if (needBike) {
      boss.setBubble(getBaked(bubbleKey((upgrade?.icon ?? 'bike') as IconName)));
      boss.setOffering(true);
    } else boss.setOffering(false);

    const near =
      Math.hypot(this.w.focus().x - boss.pos.x, this.w.focus().y - boss.pos.y) < CHIEF_TALK_DIST;
    if (near && !this.nearBoss) {
      if (next) this.begin(next.id);
      else if (needBike) voice.say('chief-need-bike', { interrupt: true });
      else if (!this.run) voice.say('chief-later', { minGapMs: 8000 });
    }
    this.nearBoss = near;
  }

  /** Every remaining mission of the job only needs a Shop item the player doesn't own yet. */
  private lockedOnlyByShop(): boolean {
    const s = this.w.state;
    const left = s.content.missions.filter((m) => m.job === s.job && !(s.stars(m.id) > 0));
    return (
      left.length > 0 &&
      left.every((m) =>
        (m.requires ?? []).some((r) => r.startsWith('owned:') && !s.owns(r.slice(6))),
      ) &&
      left.every((m) =>
        (m.requires ?? []).every((r) => !r.startsWith('badge:') || s.hasBadge(r.slice(6))),
      )
    );
  }

  /** Where the hint arrow points and what the voice says. */
  hint(): Hint | null {
    if (this.handler) return this.handler.hint();
    const boss = this.w.townsperson(this.bossId());
    if (boss && this.offer()) return { at: boss.pos, line: 'hint-chief' };
    return null;
  }
}
