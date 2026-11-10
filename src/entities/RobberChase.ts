import type Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { addBakedImage, getBaked, type BakedMeta } from '../art/blocks';
import { CHAR_FOOT_Y, CHAR_H, characterFrameKey } from '../art/characters';
import { WT } from '../art/renderScale';
import {
  GETAWAY_CAR,
  GETAWAY_EMPTY,
  POLICE_VAN,
  vehicleFrameKey,
  vehicleLightKey,
} from '../art/vehicles';
import { BUMP_DIST, CAR_MAX_SPEED } from '../config';
import { depthOf, gridToScreen, type Vec2 } from '../iso/projection';
import { rightOf, type LaneGraph, type LaneNode } from '../iso/roads';
import { ChaseState } from '../systems/chase';
import { dir8ForDir, type BranchChooser } from './LaneDriver';
import { Vehicle } from './Vehicle';

export interface ChaseHooks {
  onDrop(at: Vec2): void;
  onBump(bumps: number): void;
  onOutOfGas(): void;
  /** The whole comedy catch sequence has finished. */
  onCaught(): void;
}

export type ChasePhase = 'parked' | 'fleeing' | 'catching' | 'caught';

/**
 * Pickles in his wobbly getaway car: flees along the roads away from the player, drops donuts,
 * gets bumped (boing!), runs out of gas if the chase drags on, and when caught waddles into the
 * police van. No harm, ever.
 */
export class RobberChase {
  readonly car: Vehicle;
  chase = new ChaseState();
  phase: ChasePhase = 'parked';
  private wobble: Phaser.Tweens.Tween | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    graph: LaneGraph,
    private readonly home: LaneNode,
    private readonly heading: Vec2,
    private readonly puff: BakedMeta,
    private readonly hooks: ChaseHooks,
    private readonly rand: () => number = Math.random,
  ) {
    this.car = new Vehicle(scene, graph, GETAWAY_CAR, home, heading);
  }

  get pos(): Vec2 {
    return this.car.pos;
  }

  start(): void {
    this.chase = new ChaseState();
    this.phase = 'fleeing';
    this.car.setLook(GETAWAY_CAR);
    this.wobble?.stop();
    this.wobble = this.scene.tweens.add({
      targets: this.car.img,
      angle: { from: -4, to: 4 },
      duration: 260,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Back to the start spot, ready for another run ("he snuck out again"). */
  reset(): void {
    this.wobble?.stop();
    this.wobble = null;
    this.phase = 'parked';
    this.car.setLook(GETAWAY_CAR);
    this.car.img.setAngle(0);
    this.car.placeAt(this.home, this.heading);
    this.car.img.setAlpha(0);
    this.scene.tweens.add({ targets: this.car.img, alpha: 1, duration: 400 });
    this.puffAt(this.car.pos);
  }

  private chooser(police: Vec2): BranchChooser {
    return (options, heading, at) => {
      let best = -1;
      let bestScore = -Infinity;
      options.forEach((o, i) => {
        const back = o.x === -heading.x && o.y === -heading.y;
        if (back && options.length > 1) return;
        const p = { x: at.x + o.x * 2, y: at.y + o.y * 2 };
        const score = Math.hypot(p.x - police.x, p.y - police.y) + this.rand() * 0.8;
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      });
      return best;
    };
  }

  /** `police` is where the player is (on foot or driving); `policeCar` only when driving. */
  update(dt: number, police: Vec2, policeCar: Vehicle | null): void {
    if (this.phase !== 'fleeing') {
      this.car.sync(dt);
      return;
    }
    const dist = Math.hypot(police.x - this.pos.x, police.y - this.pos.y);
    for (const e of this.chase.update(dt, dist)) {
      if (e === 'drop') this.hooks.onDrop({ ...this.pos });
      if (e === 'outOfGas') {
        sfx.play('sputter');
        this.puffAt(this.pos);
        this.hooks.onOutOfGas();
      }
    }
    const cruise = CAR_MAX_SPEED * this.chase.speedFactor(dist);
    this.car.update(dt, { stick: null, cruise, chooser: this.chooser(police) });

    if (policeCar) {
      const d = Math.hypot(policeCar.pos.x - this.pos.x, policeCar.pos.y - this.pos.y);
      if (d < BUMP_DIST) {
        const r = this.chase.bump();
        if (r) {
          policeCar.driver.speed = 0;
          this.bumpFx();
          if (r === 'bump') this.hooks.onBump(this.chase.bumps);
          else this.catchSequence();
        }
      }
    }
  }

  private puffAt(p: Vec2): void {
    const s = gridToScreen(p.x, p.y);
    const img = addBakedImage(this.scene, this.puff, s.x, s.y - 10).setDepth(
      depthOf(p.x, p.y) + 80,
    );
    const full = img.scaleX;
    img.setScale(full * 0.3);
    this.scene.tweens.add({
      targets: img,
      scale: full * 1.2,
      alpha: 0,
      duration: 600,
      onComplete: () => img.destroy(),
    });
  }

  private bumpFx(): void {
    sfx.play('boing');
    sfx.play('bump', 1, 0.6);
    this.puffAt(this.pos);
    this.scene.tweens.add({
      targets: this.car,
      hop: 22,
      duration: 160,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  /** The comedy beat: spin, "Aw, nuts!", hop out, waddle into the van, van drives off. */
  private catchSequence(): void {
    this.phase = 'catching';
    this.wobble?.stop();
    this.wobble = null;
    this.car.driver.speed = 0;
    voice.say('caught', { interrupt: true });
    const scene = this.scene;
    scene.tweens.add({
      targets: this.car.img,
      angle: 360,
      duration: 700,
      onComplete: () => this.car.img.setAngle(0),
    });

    const dir = this.car.driver.dir;
    const right = rightOf(dir);
    const carPos = { ...this.pos };
    const robberAt = { x: carPos.x + right.x * 0.55, y: carPos.y + right.y * 0.55 };
    // The van pulls up just ahead (the police car is usually right behind).
    const vanAt = { x: carPos.x + dir.x * 1.6, y: carPos.y + dir.y * 1.6 };

    scene.time.delayedCall(700, () => {
      this.car.setLook(GETAWAY_EMPTY);
      const rs = gridToScreen(robberAt.x, robberAt.y);
      const robber = scene.add
        .image(rs.x, rs.y, characterFrameKey('pickles', 'SW', 0))
        .setOrigin(0.5, CHAR_FOOT_Y / CHAR_H)
        .setScale(0)
        .setDepth(depthOf(robberAt.x, robberAt.y) + 60);
      scene.tweens.add({ targets: robber, scale: 1 / WT, duration: 250, ease: 'Back.easeOut' });

      const facing = this.car.driver.facing;
      const vs = gridToScreen(vanAt.x, vanAt.y);
      const vanDir = dir8ForDir(dir);
      const vanMeta = getBaked(vehicleFrameKey(POLICE_VAN.name, vanDir, 0));
      const vanLightMeta = getBaked(vehicleLightKey(POLICE_VAN.name, vanDir, 1));
      const vanDepth = depthOf(vanAt.x, vanAt.y) + 55;
      const vanBody = scene.add
        .image(vs.x, vs.y, vanMeta.key)
        .setOrigin(vanMeta.originX, vanMeta.originY)
        .setScale(0)
        .setDepth(vanDepth);
      const vanLight = scene.add
        .image(vs.x, vs.y, vanLightMeta.key)
        .setOrigin(vanLightMeta.originX, vanLightMeta.originY)
        .setScale(0)
        .setDepth(vanDepth + 0.5);
      const van = [vanBody, vanLight];
      this.puffAt(vanAt);
      scene.tweens.add({ targets: van, scale: 1 / WT, duration: 300, ease: 'Back.easeOut' });
      let light: 1 | 2 = 1;
      const flasher = scene.time.addEvent({
        delay: 140,
        loop: true,
        callback: () => {
          light = light === 1 ? 2 : 1;
          vanLight.setTexture(vehicleLightKey(POLICE_VAN.name, vanDir, light));
        },
      });

      // Waddle (wobbling side to side) into the van.
      scene.time.delayedCall(900, () => {
        robber.setTexture(characterFrameKey('pickles', facing, 0));
        scene.tweens.add({
          targets: robber,
          angle: { from: -12, to: 12 },
          duration: 180,
          yoyo: true,
          repeat: 4,
        });
        scene.tweens.add({
          targets: robber,
          x: vs.x,
          y: vs.y - 6,
          duration: 1500,
          ease: 'Linear',
          onComplete: () => {
            sfx.play('pop');
            scene.tweens.add({
              targets: robber,
              scale: 0,
              duration: 180,
              onComplete: () => robber.destroy(),
            });
            // Van drives off and fades away.
            const away = gridToScreen(vanAt.x + dir.x * 5, vanAt.y + dir.y * 5);
            scene.tweens.add({
              targets: van,
              x: away.x,
              y: away.y,
              alpha: 0,
              delay: 300,
              duration: 1400,
              ease: 'Quad.easeIn',
              onComplete: () => {
                flasher.remove();
                for (const v of van) v.destroy();
                this.phase = 'caught';
                this.hooks.onCaught();
              },
            });
          },
        });
      });
    });
  }
}
