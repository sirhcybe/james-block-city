import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { CHAR_FOOT_Y, CHAR_H, characterFrameKey } from '../art/characters';
import { CARD_H, CARD_W, iconKey, MENU } from '../art/menu';
import { RS, WT } from '../art/renderScale';
import { GAME_H, GAME_W, PALETTE } from '../config';
import type { GameState } from '../systems/GameState';
import { JOB_ORDER, JOBS, outfitFor, uniformState } from '../systems/jobs';
import type { JobId } from '../systems/missions';
import { STATE_KEY } from './keys';
import { closeMenu } from './minigameKit';

/**
 * The Job Center at City Hall (spec 004): three uniforms on a rack. Tap one to become that job
 * (spin + sparkle). Locked until the first badge, and for jobs that don't exist yet. Pictures only.
 */
export class JobCenterScene extends Phaser.Scene {
  private state!: GameState;
  private cards = new Map<JobId, Phaser.GameObjects.Image>();
  private picked = false;

  constructor() {
    super('JobCenter');
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    this.state = this.registry.get(STATE_KEY) as GameState;
    this.cards.clear();
    this.picked = false;
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0xf3e3c0, 0.96).setOrigin(0, 0);
    // The rack: a rail across the top.
    const g = this.add.graphics();
    g.lineStyle(10, PALETTE.trunk, 1);
    g.lineBetween(220, 120, GAME_W - 220, 120);
    g.lineStyle(4, PALETTE.outline, 1);
    g.strokeRect(220, 115, GAME_W - 440, 10);

    const s = this.state.progress;
    JOB_ORDER.forEach((job, i) => {
      const x = GAME_W / 2 + (i - 1) * (CARD_W + 70);
      const y = 350;
      const st = uniformState(job, this.state.job, s.badges, this.state.content.missions);
      g.lineStyle(4, PALETTE.outline, 1);
      g.lineBetween(x, 120, x, y - CARD_H / 2);
      const card = this.add
        .image(
          x,
          y,
          st === 'current' ? MENU.cardOwned : st === 'locked' ? MENU.cardLocked : MENU.card,
        )
        .setScale(1 / RS)
        .setInteractive({ useHandCursor: true });
      this.add
        .image(x, y + 60, characterFrameKey(outfitFor(job, [...s.owned, 'cap-cop']), 'SW', 0))
        .setOrigin(0.5, CHAR_FOOT_Y / CHAR_H)
        .setScale(2.2 / WT)
        .setAlpha(st === 'locked' ? 0.45 : 1);
      if (st === 'locked') this.add.image(x + 55, y + 70, iconKey('padlock')).setScale(0.55 / RS);
      if (this.state.hasBadge(job))
        this.add.image(x - 60, y - 90, `hud-badge-${job}`).setScale(1 / RS);
      card.on('pointerup', () => this.pick(job));
      this.cards.set(job, card);
    });

    const back = this.add
      .image(90, GAME_H - 90, MENU.back)
      .setScale(1 / RS)
      .setInteractive({ useHandCursor: true });
    back.on('pointerup', () => closeMenu(this));
    this.input.keyboard?.once('keydown-ESC', () => closeMenu(this));
    voice.say(this.state.progress.badges.length > 0 ? 'job-center-hello' : 'job-locked', {
      interrupt: true,
    });
  }

  /** Tap a uniform: switch to it, or a gentle wobble if it isn't open yet. */
  pick(job: JobId): boolean {
    if (this.picked) return false;
    const card = this.cards.get(job);
    if (!card) return false;
    const st = uniformState(
      job,
      this.state.job,
      this.state.progress.badges,
      this.state.content.missions,
    );
    if (st === 'current') {
      closeMenu(this);
      return false;
    }
    if (st === 'locked' || !this.state.switchJob(job)) {
      sfx.play('shrug');
      const soon = !this.state.content.missions.some((m) => m.job === job);
      voice.say(soon ? 'job-soon' : 'job-locked', { interrupt: true });
      this.tweens.add({
        targets: card,
        angle: { from: -5, to: 5 },
        duration: 80,
        yoyo: true,
        repeat: 2,
        onComplete: () => card.setAngle(0),
      });
      return false;
    }
    this.picked = true;
    sfx.play('sparkle');
    this.tweens.add({ targets: card, angle: 360, scale: 1.15 / RS, duration: 600 });
    this.time.delayedCall(700, () => closeMenu(this, { job: JOBS[job].id }));
    return true;
  }
}
