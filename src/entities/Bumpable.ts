import type Phaser from 'phaser';
import { addBakedImage, type BakedMeta } from '../art/blocks';
import { depthOf, gridToScreen, type Vec2 } from '../iso/projection';

/** Seconds after a bump before the prop pops back to its spot (AC: reset within 5 s). */
export const BUMP_RESET_SEC = 2.5;

/**
 * A cone or trash can that tumbles when a vehicle bumps it and pops back a moment later.
 * Bumping pays nothing.
 */
export class Bumpable {
  readonly img: Phaser.GameObjects.Image;
  readonly home: Vec2;
  tumbling = false;
  /** Times this prop has been bumped (for tests). */
  bumps = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly id: string,
    meta: BakedMeta,
    at: Vec2,
  ) {
    this.home = { ...at };
    const s = gridToScreen(at.x, at.y);
    this.img = addBakedImage(scene, meta, s.x, s.y).setDepth(depthOf(at.x, at.y) + 40);
  }

  /** Knock it over, flying away from `from` (a vehicle position). Returns false if already down. */
  bump(from: Vec2): boolean {
    if (this.tumbling) return false;
    this.tumbling = true;
    this.bumps++;
    const away = { x: this.home.x - from.x, y: this.home.y - from.y };
    const len = Math.hypot(away.x, away.y) || 1;
    const land = gridToScreen(
      this.home.x + (away.x / len) * 0.6,
      this.home.y + (away.y / len) * 0.6,
    );
    const start = gridToScreen(this.home.x, this.home.y);
    const img = this.img;
    this.scene.tweens.add({
      targets: img,
      x: land.x,
      duration: 500,
      ease: 'Linear',
    });
    this.scene.tweens.add({
      targets: img,
      y: { from: start.y, to: start.y - 34 },
      duration: 250,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: img,
      angle: 360 + 90 * Math.sign(away.x - away.y || 1),
      duration: 500,
    });
    this.scene.time.delayedCall(BUMP_RESET_SEC * 1000, () => this.reset());
    return true;
  }

  reset(): void {
    const s = gridToScreen(this.home.x, this.home.y);
    this.scene.tweens.killTweensOf(this.img);
    this.img.setPosition(s.x, s.y).setAngle(0).setAlpha(0);
    this.scene.tweens.add({ targets: this.img, alpha: 1, duration: 300 });
    this.tumbling = false;
  }
}
