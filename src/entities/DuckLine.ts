import type Phaser from 'phaser';
import { getBaked } from '../art/blocks';
import { MPROP } from '../art/missionProps';
import { WT } from '../art/renderScale';
import { depthOf, gridToScreen, type Vec2 } from '../iso/projection';
import type { EscortState } from '../systems/escort';

/** Draws a mother duck and her ducklings from an EscortState (a waddle and a facing flip). */
export class DuckLine {
  readonly imgs: Phaser.GameObjects.Image[] = [];
  private last: Vec2[] = [];
  private t = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: EscortState,
  ) {
    state.ducks.forEach((d, i) => {
      const meta = getBaked(i === 0 ? MPROP.duck : MPROP.duckling);
      const s = gridToScreen(d.x, d.y);
      const img = scene.add
        .image(s.x, s.y, meta.key)
        .setOrigin(meta.originX, meta.originY)
        .setScale(0);
      scene.tweens.add({
        targets: img,
        scale: 1 / WT,
        duration: 260,
        delay: i * 80,
        ease: 'Back.easeOut',
      });
      this.imgs.push(img);
      this.last.push({ ...d });
    });
  }

  get positions(): Vec2[] {
    return this.state.ducks;
  }

  update(dt: number): void {
    this.t += dt;
    this.state.ducks.forEach((d, i) => {
      const img = this.imgs[i]!;
      const prev = this.last[i]!;
      const sx = gridToScreen(d.x, d.y);
      const moved = Math.hypot(d.x - prev.x, d.y - prev.y) > 1e-4;
      const ps = gridToScreen(prev.x, prev.y);
      if (moved && Math.abs(sx.x - ps.x) > 0.01) img.setFlipX(sx.x < ps.x);
      const waddle = moved ? Math.sin(this.t * 18 + i) * 6 : 0;
      img
        .setPosition(sx.x, sx.y)
        .setAngle(waddle)
        .setDepth(depthOf(d.x, d.y) + 40);
      this.last[i] = { ...d };
    });
  }

  /** Happy hop into the pond, then gone. */
  celebrate(at: Vec2): void {
    const s = gridToScreen(at.x, at.y);
    this.imgs.forEach((img, i) => {
      this.scene.tweens.add({
        targets: img,
        x: s.x + (i - 1.5) * 14,
        y: s.y + 10,
        delay: i * 120,
        duration: 500,
        ease: 'Quad.easeOut',
      });
      this.scene.tweens.add({
        targets: img,
        y: s.y - 20,
        delay: i * 120 + 500,
        duration: 200,
        yoyo: true,
        repeat: 2,
      });
    });
  }

  destroy(): void {
    for (const i of this.imgs) {
      this.scene.tweens.killTweensOf(i);
      i.destroy();
    }
    this.imgs.length = 0;
  }
}
