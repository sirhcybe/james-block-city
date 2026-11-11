import type Phaser from 'phaser';
import { timeoutWindowPoint } from '../art/buildings';
import { CHAR_FOOT_Y, CHAR_H, characterFrameKey } from '../art/characters';
import { WT } from '../art/renderScale';
import type { BuildingDef } from '../content/schema';
import { footprintDepth, gridToScreen } from '../iso/projection';

/**
 * Time-Out Tower: caught Bandit Brothers sit in the corner behind the big window (comic action
 * rule 2). At the start of the next robber mission they "sneak out": a tiptoe out of the door and
 * away. It's a time-out, not a jail: nothing scary.
 */
export class TimeOutTower {
  /** Who is sitting inside right now (robber names). */
  readonly inmates: string[] = [];
  private imgs = new Map<string, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    readonly def: BuildingDef,
  ) {}

  /** Where the van drops robbers off (the door side of the tower), in grid coords. */
  get door(): { x: number; y: number } {
    return { x: this.def.gx + this.def.w / 2, y: this.def.gy + this.def.d + 0.6 };
  }

  private seatScreen(slot: number): { x: number; y: number } {
    const o = gridToScreen(this.def.gx, this.def.gy);
    const p = timeoutWindowPoint(this.def, slot);
    return { x: o.x + p.x, y: o.y + p.y };
  }

  /** A robber takes his seat behind the window (with a little pop). */
  addInmate(name: string): void {
    if (this.inmates.includes(name)) return;
    this.inmates.push(name);
    const slot = this.inmates.length - 1;
    const at = this.seatScreen(slot);
    const img = this.scene.add
      .image(at.x, at.y, characterFrameKey(name, 'SW', 0))
      .setOrigin(0.5, CHAR_FOOT_Y / CHAR_H)
      .setScale(0)
      .setDepth(
        footprintDepth({ x: this.def.gx, y: this.def.gy, w: this.def.w, d: this.def.d }) + 1,
      );
    this.scene.tweens.add({ targets: img, scale: 0.8 / WT, duration: 260, ease: 'Back.easeOut' });
    // Sulking in the corner: a slow little sway.
    this.scene.tweens.add({
      targets: img,
      angle: { from: -4, to: 4 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.imgs.set(name, img);
  }

  /**
   * Everyone tiptoes out (big careful steps) and away. Returns how long it takes in ms (0 if the
   * tower was empty).
   */
  sneakOut(): number {
    if (this.inmates.length === 0) return 0;
    const door = gridToScreen(this.door.x, this.door.y);
    let i = 0;
    for (const name of this.inmates.splice(0)) {
      const img = this.imgs.get(name);
      this.imgs.delete(name);
      if (!img) continue;
      this.scene.tweens.killTweensOf(img);
      img.setAngle(0).setTexture(characterFrameKey(name, 'SE', 0));
      const delay = i++ * 350;
      // Tiptoe: hop-hop toward the door, then off to the side and fade.
      this.scene.tweens.add({
        targets: img,
        x: door.x + 30 * i,
        y: door.y,
        delay,
        duration: 1300,
        ease: 'Linear',
        onUpdate: (tw) => {
          const k = tw.progress * 8;
          img.setTexture(characterFrameKey(name, 'SE', Math.floor(k) % 2 ? 1 : 0));
          img.setScale((0.8 + 0.2 * tw.progress) / WT);
        },
        onComplete: () => {
          this.scene.tweens.add({
            targets: img,
            x: img.x + 60,
            y: img.y + 30,
            alpha: 0,
            duration: 600,
            onComplete: () => img.destroy(),
          });
        },
      });
    }
    return 1300 + 600 + (i - 1) * 350;
  }
}
