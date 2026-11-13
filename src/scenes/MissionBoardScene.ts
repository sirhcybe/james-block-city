import { isJobMission } from '../systems/missions';
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import type { IconName } from '../art/icons';
import { CARD_H, CARD_W, iconKey, MENU } from '../art/menu';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W } from '../config';
import type { GameState } from '../systems/GameState';
import { STATE_KEY } from './keys';
import { closeMenu } from './minigameKit';

/**
 * The mission board on the station wall (AC15): one picture card per mission of the job, with the
 * best stars and a padlock if it's locked. Tap a card to (re)play that mission. Pictures only.
 */
export class MissionBoardScene extends Phaser.Scene {
  private state!: GameState;
  private cards: { id: string; img: Phaser.GameObjects.Image; locked: boolean }[] = [];

  constructor() {
    super('MissionBoard');
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    this.state = this.registry.get(STATE_KEY) as GameState;
    this.cards = [];
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x1f4fa8, 0.92).setOrigin(0, 0);

    const missions = this.state.content.missions.filter(
      (m) => m.job === this.state.job && isJobMission(m),
    );
    const perRow = 3;
    missions.forEach((m, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = GAME_W / 2 + (col - 1) * (CARD_W + 50);
      const y = 200 + row * (CARD_H + 30);
      const locked = !this.state.unlocked(m.id);
      const card = this.add
        .image(x, y, locked ? MENU.cardLocked : MENU.card)
        .setScale(1 / RS)
        .setInteractive({ useHandCursor: true });
      this.add
        .image(x, y - 30, iconKey(m.icon as IconName))
        .setScale(1 / RS)
        .setAlpha(locked ? 0.4 : 1);
      if (locked) this.add.image(x + 50, y + 40, iconKey('padlock')).setScale(0.6 / RS);
      else {
        const stars = this.state.stars(m.id);
        for (let k = 0; k < 3; k++)
          this.add
            .image(x + (k - 1) * 50, y + 80, k < stars ? MENU.starSmall : MENU.starSmallEmpty)
            .setScale(1 / RS);
      }
      card.on('pointerup', () => this.pick(m.id));
      this.cards.push({ id: m.id, img: card, locked });
    });

    const back = this.add
      .image(90, GAME_H - 90, MENU.back)
      .setScale(1 / RS)
      .setInteractive({ useHandCursor: true });
    back.on('pointerup', () => closeMenu(this));
    this.input.keyboard?.once('keydown-ESC', () => closeMenu(this));
    this.input.keyboard?.once('keydown-SPACE', () => closeMenu(this));
    voice.say('board-hello', { interrupt: true });
  }

  /** Tap a card: replay it, or wobble if it's still locked. */
  pick(id: string): void {
    const c = this.cards.find((x) => x.id === id);
    if (!c) return;
    if (c.locked) {
      sfx.play('shrug');
      this.tweens.add({
        targets: c.img,
        angle: { from: -5, to: 5 },
        duration: 80,
        yoyo: true,
        repeat: 2,
        onComplete: () => c.img.setAngle(0),
      });
      return;
    }
    sfx.play('pop');
    closeMenu(this, { replay: id });
  }
}
