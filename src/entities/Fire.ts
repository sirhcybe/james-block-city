import type Phaser from 'phaser';
import { addBakedImage, getBaked } from '../art/blocks';
import { MPROP } from '../art/missionProps';
import { BLOCK_H } from '../config';
import { depthOf, gridToScreen, type Vec2 } from '../iso/projection';
import { FireState, type FireSpot } from '../systems/fire';

/** A grumpy cartoon flame on the ground or a tower window. It shrinks as it's sprayed. */
export class Fire {
  readonly state = new FireState();
  readonly img: Phaser.GameObjects.Image;
  private t = 0;
  private full: number;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly spot: FireSpot,
  ) {
    const s = this.screen;
    this.img = addBakedImage(scene, getBaked(MPROP.fire), s.x, s.y);
    // In front of the wall it's on (towers sort by their front-most tile).
    this.img.setDepth(depthOf(spot.x, spot.y) + 200);
    this.full = this.img.scaleX;
    this.img.setScale(0);
    scene.tweens.add({ targets: this.img, scale: this.full, duration: 350, ease: 'Back.easeOut' });
  }

  get id(): string {
    return this.spot.id;
  }

  /** Where it is on screen (world px), z lifted. */
  get screen(): Vec2 {
    const p = gridToScreen(this.spot.x, this.spot.y);
    return { x: p.x, y: p.y - this.spot.z * BLOCK_H };
  }

  /** Advance; returns true on the frame it goes out ("pfft"). */
  update(dt: number, spraying: boolean): boolean {
    this.t += dt;
    const out = this.state.update(dt, spraying);
    if (!this.state.out && this.img.scaleX > 0) {
      this.img.setTexture(Math.floor(this.t * 6) % 2 ? MPROP.fire2 : MPROP.fire);
      if (!this.scene.tweens.isTweening(this.img))
        this.img.setScale(this.full * (0.35 + 0.65 * this.state.hp));
    }
    if (out) this.pfft();
    return out;
  }

  private pfft(): void {
    this.scene.tweens.killTweensOf(this.img);
    this.scene.tweens.add({
      targets: this.img,
      scale: 0,
      alpha: 0,
      duration: 350,
      ease: 'Back.easeIn',
      onComplete: () => this.img.destroy(),
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.img);
    this.img.destroy();
  }
}
