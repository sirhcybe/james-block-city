import type Phaser from 'phaser';
import { CHAR_FOOT_Y, CHAR_H, characterFrameKey } from '../art/characters';
import { WT } from '../art/renderScale';
import type { WalkerDef } from '../content/schema';
import { gridToScreen, type Vec2 } from '../iso/projection';
import { facingForGridDir, type Facing } from './Player';

const WALK_SPEED = 0.9;
const HOP_DIST = 1.7;

/**
 * A townsperson strolling back and forth on a sidewalk. When a vehicle comes close they hop
 * ("whoa!"). They stay on sidewalks and vehicles stay on roads, so nobody is ever hit.
 */
export class Pedestrian {
  pos: Vec2;
  readonly img: Phaser.GameObjects.Image;
  private target: Vec2;
  private facing: Facing = 'SE';
  private bobT = 0;
  private frame: 0 | 1 = 0;
  private hopCooldown = 0;
  hopping = false;
  hop = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly def: WalkerDef,
    private readonly lookName: string,
  ) {
    this.pos = { x: def.from.gx, y: def.from.gy };
    this.target = { x: def.to.gx, y: def.to.gy };
    this.img = scene.add
      .image(0, 0, characterFrameKey(lookName, 'SE', 0))
      .setOrigin(0.5, CHAR_FOOT_Y / CHAR_H)
      .setScale(1 / WT);
  }

  /** Returns true when the pedestrian starts a hop this frame. */
  update(dt: number, vehicles: Vec2[]): boolean {
    let startedHop = false;
    this.hopCooldown -= dt;
    const near = vehicles.some((v) => Math.hypot(v.x - this.pos.x, v.y - this.pos.y) < HOP_DIST);
    if (near && !this.hopping && this.hopCooldown <= 0) {
      this.hopping = true;
      this.hopCooldown = 2.5;
      startedHop = true;
      this.scene.tweens.add({
        targets: this,
        hop: 26,
        duration: 220,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => (this.hopping = false),
      });
    }

    if (!this.hopping) {
      const dx = this.target.x - this.pos.x;
      const dy = this.target.y - this.pos.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.05) {
        this.target =
          this.target.x === this.def.to.gx && this.target.y === this.def.to.gy
            ? { x: this.def.from.gx, y: this.def.from.gy }
            : { x: this.def.to.gx, y: this.def.to.gy };
      } else {
        const step = Math.min(d, WALK_SPEED * dt);
        this.pos = { x: this.pos.x + (dx / d) * step, y: this.pos.y + (dy / d) * step };
        this.facing = facingForGridDir({ x: dx, y: dy }, this.facing);
        this.bobT += dt;
        if (this.bobT > 0.2) {
          this.bobT = 0;
          this.frame = this.frame === 0 ? 1 : 0;
        }
      }
    }
    const s = gridToScreen(this.pos.x, this.pos.y);
    this.img.setPosition(s.x, s.y - this.hop);
    this.img.setTexture(
      characterFrameKey(this.lookName, this.facing, this.hopping ? 1 : this.frame),
    );
    return startedHop;
  }
}
