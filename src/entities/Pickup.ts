import type Phaser from 'phaser';
import { addBakedImage, type BakedMeta } from '../art/blocks';
import { depthOf, gridToScreen, type Vec2 } from '../iso/projection';

export const PICKUP_DIST = 0.85;

/** Something lying on the ground to collect (dropped donuts). Collecting is never paid in coins. */
export class Pickup {
  readonly img: Phaser.GameObjects.Image;
  alive = true;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly item: string,
    meta: BakedMeta,
    readonly pos: Vec2,
  ) {
    const s = gridToScreen(pos.x, pos.y);
    this.img = addBakedImage(scene, meta, s.x, s.y).setDepth(depthOf(pos.x, pos.y) + 10);
    // Pop in, then bob gently so it reads as "pick me up".
    const full = this.img.scaleX;
    this.img.setScale(0);
    scene.tweens.add({ targets: this.img, scale: full, duration: 260, ease: 'Back.easeOut' });
    scene.tweens.add({
      targets: this.img,
      y: s.y - 6,
      duration: 500,
      yoyo: true,
      repeat: -1,
      delay: 260,
      ease: 'Sine.easeInOut',
    });
  }

  near(p: Vec2): boolean {
    return this.alive && Math.hypot(p.x - this.pos.x, p.y - this.pos.y) < PICKUP_DIST;
  }

  collect(): void {
    this.alive = false;
    this.scene.tweens.killTweensOf(this.img);
    this.scene.tweens.add({
      targets: this.img,
      y: this.img.y - 50,
      alpha: 0,
      duration: 350,
      ease: 'Quad.easeOut',
      onComplete: () => this.img.destroy(),
    });
  }
}
