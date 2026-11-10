import type Phaser from 'phaser';
import { addBakedImage, type BakedMeta } from '../art/blocks';
import { CHAR_FOOT_Y, CHAR_H, characterFrameKey } from '../art/characters';
import { WT } from '../art/renderScale';
import { depthOf, gridToScreen, type Vec2 } from '../iso/projection';

/** Someone who can give an errand. Shows a picture bubble (never words) while it's on offer. */
export class Townsperson {
  readonly img: Phaser.GameObjects.Image;
  readonly bubble: Phaser.GameObjects.Image;
  offering = false;
  /** Has asked out loud during the current offer. */
  asked = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly id: string,
    lookName: string,
    readonly pos: Vec2,
    bubbleMeta: BakedMeta,
  ) {
    const s = gridToScreen(pos.x, pos.y);
    const depth = depthOf(pos.x, pos.y) + 50;
    this.img = scene.add
      .image(s.x, s.y, characterFrameKey(lookName, 'SW', 0))
      .setOrigin(0.5, CHAR_FOOT_Y / CHAR_H)
      .setScale(1 / WT)
      .setDepth(depth);
    this.bubble = addBakedImage(scene, bubbleMeta, s.x + 18, s.y - 58)
      .setDepth(depth + 1)
      .setVisible(false);
  }

  setOffering(on: boolean): void {
    if (on === this.offering) return;
    this.offering = on;
    this.asked = false;
    this.scene.tweens.killTweensOf(this.bubble);
    const s = gridToScreen(this.pos.x, this.pos.y);
    if (on) {
      const full = 1 / WT;
      this.bubble
        .setVisible(true)
        .setScale(0)
        .setY(s.y - 58);
      this.scene.tweens.add({
        targets: this.bubble,
        scale: full,
        duration: 300,
        ease: 'Back.easeOut',
      });
      this.scene.tweens.add({
        targets: this.bubble,
        y: s.y - 66,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      this.scene.tweens.add({
        targets: this.bubble,
        scale: 0,
        duration: 200,
        onComplete: () => this.bubble.setVisible(false),
      });
    }
  }

  /** A happy little jump (errand done). */
  cheer(): void {
    const y = this.img.y;
    this.scene.tweens.add({ targets: this.img, y: y - 24, duration: 180, yoyo: true, repeat: 2 });
  }
}
