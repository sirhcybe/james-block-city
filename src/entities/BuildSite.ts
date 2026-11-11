import type Phaser from 'phaser';
import { addBakedImage, getBaked } from '../art/blocks';
import { buildingTextureKey } from '../art/buildings';
import { iconKey } from '../art/menu';
import { RS } from '../art/renderScale';
import type { BuildingDef } from '../content/schema';
import { footprintDepth, gridToScreen, type Vec2 } from '../iso/projection';
import { blocksFor, SiteState } from '../systems/build';

/**
 * A Builder build spot (spec 005). While its mission is on, it shows as a pale blue ghost of the
 * finished thing; every blaster press flies a block in and the building grows up out of the
 * ground until it's done.
 */
export class BuildSite {
  readonly img: Phaser.GameObjects.Image;
  state: SiteState;
  active = false;
  private full: number;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly def: BuildingDef,
    built: boolean,
  ) {
    const p = gridToScreen(def.gx, def.gy);
    this.img = addBakedImage(scene, getBaked(buildingTextureKey(def)), p.x, p.y);
    this.img.setDepth(footprintDepth({ x: def.gx, y: def.gy, w: def.w, d: def.d }));
    this.full = this.img.scaleY;
    this.state = new SiteState(blocksFor(def));
    if (built) this.state.added = this.state.needed;
    this.img.setVisible(built);
  }

  get id(): string {
    return this.def.id;
  }

  get built(): boolean {
    return this.state.built;
  }

  /** Where blocks fly to (the middle of the footprint). */
  get centre(): Vec2 {
    return { x: this.def.gx + this.def.w / 2, y: this.def.gy + this.def.d / 2 };
  }

  /** Start (or restart) building: an empty ghost outline. */
  begin(): void {
    this.active = true;
    this.state = new SiteState(blocksFor(this.def));
    this.img
      .setVisible(true)
      .setTint(0x9fd8f5)
      .setAlpha(0.35)
      .setScale(this.img.scaleX, this.full * 0.12);
  }

  /** Stop without finishing (mission abandoned): back to how it was. */
  cancel(wasBuilt: boolean): void {
    this.active = false;
    this.state = new SiteState(blocksFor(this.def));
    if (wasBuilt) this.state.added = this.state.needed;
    this.img.clearTint().setAlpha(1).setScale(this.img.scaleX, this.full).setVisible(wasBuilt);
  }

  /** A block flies from `from` (world px) and lands; returns true when the building is done. */
  addBlocks(n: number, from: Vec2): boolean {
    const to = gridToScreen(this.centre.x, this.centre.y);
    const block = this.scene.add
      .image(from.x, from.y, iconKey('brick'))
      .setScale(0.35 / RS)
      .setDepth(this.img.depth + 5);
    this.scene.tweens.add({
      targets: block,
      x: to.x,
      y: to.y - 20,
      angle: 360,
      duration: 380,
      ease: 'Quad.easeIn',
      onComplete: () => block.destroy(),
    });
    const done = this.state.add(n);
    const k = this.state.progress;
    this.scene.tweens.add({
      targets: this.img,
      scaleY: this.full * (0.12 + 0.88 * k),
      alpha: 0.35 + 0.65 * k,
      delay: 300,
      duration: 220,
      ease: 'Back.easeOut',
    });
    if (done) {
      this.active = false;
      this.scene.time.delayedCall(560, () =>
        this.img.clearTint().setAlpha(1).setScale(this.img.scaleX, this.full),
      );
    }
    return done;
  }
}
