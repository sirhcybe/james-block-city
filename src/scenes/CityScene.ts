import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { maskFor, solidAt } from '../art/alphaMask';
import { addBakedImage, getBaked, type BakedMeta } from '../art/blocks';
import { buildingTextureKey } from '../art/buildings';
import { CHAR_FOOT_Y, CHAR_H, characterFrameKey } from '../art/characters';
import { PROP } from '../art/props';
import { RS, WT } from '../art/renderScale';
import { UI } from '../art/ui';
import { POLICE_CAR } from '../art/vehicles';
import {
  CAMERA_LERP,
  ENTER_CAR_DIST,
  FADE_MS,
  OCCLUDED_ALPHA,
  PALETTE,
  WORLD_ZOOM,
} from '../config';
import { marker, tileAt, type BuildingDef, type MapDef } from '../content/schema';
import { buildWalkGrid } from '../content/world';
import { Bumpable } from '../entities/Bumpable';
import { Pedestrian } from '../entities/Pedestrian';
import { Pickup } from '../entities/Pickup';
import { Player } from '../entities/Player';
import { RobberChase } from '../entities/RobberChase';
import { Townsperson } from '../entities/Townsperson';
import { Vehicle } from '../entities/Vehicle';
import { InputMapper, type PointerSample } from '../input/InputMapper';
import type { WalkGrid } from '../iso/grid';
import { PathFinder } from '../iso/path';
import { depthOf, footprintDepth, gridToScreen, screenToGrid, type Vec2 } from '../iso/projection';
import { buildLaneGraph, type LaneGraph } from '../iso/roads';
import type { GameState } from '../systems/GameState';
import { IdleHints } from '../systems/hints';
import { resolveOcclusion, type Occluder } from '../systems/occlusion';
import {
  EV,
  HUD_HIT_KEY,
  HUD_INFO_KEY,
  INPUT_KEY,
  MAP_KEY,
  STATE_KEY,
  type HudInfo,
  type MinigameResult,
} from './keys';

interface Prop {
  def: BuildingDef;
  image: Phaser.GameObjects.Image;
  bounds: Phaser.Geom.Rectangle;
  depth: number;
  faded: boolean;
}

/** Sample points on a character sprite (offsets from the feet, logical px) for occlusion tests. */
const CHAR_SAMPLES: Vec2[] = [
  { x: 0, y: -4 },
  { x: 0, y: -24 },
  { x: 0, y: -46 },
  { x: -10, y: -30 },
  { x: 10, y: -30 },
];
const CAR_SAMPLES: Vec2[] = [
  { x: 0, y: -4 },
  { x: -18, y: -10 },
  { x: 18, y: -10 },
  { x: 0, y: -26 },
];

const MISSION_ID = 'donut-dash';
const ERRAND_ID = 'return-donuts';
const MINIGAME_ID = 'traffic-helper';
const OWNER_ID = 'donut-owner';
/** Seconds after a finished mission before Pickles sneaks out again. */
const REPLAY_AFTER_SEC = 12;

/** The isometric world and the vertical-slice gameplay: walk, drive, chase, errand, minigame. */
export class CityScene extends Phaser.Scene {
  map!: MapDef;
  state!: GameState;
  player!: Player;
  input2!: InputMapper;
  car!: Vehicle;
  robber!: RobberChase;
  graph!: LaneGraph;
  owner!: Townsperson;
  mode: 'foot' | 'car' = 'foot';
  readonly pickups: Pickup[] = [];
  readonly bumpables: Bumpable[] = [];
  readonly walkers: Pedestrian[] = [];
  private pathFinder!: PathFinder;
  private grid!: WalkGrid;
  private playerImg!: Phaser.GameObjects.Image;
  private props: Prop[] = [];
  private target!: Phaser.GameObjects.Image;
  private bobTimer = 0;
  private bobFrame: 0 | 1 = 0;
  private autoEnter = false;
  private padPos!: Vec2;
  private onPad = false;
  private hints = new IdleHints();
  private donutMeta!: BakedMeta;
  private missionWaiting = false;
  sirenPresses = 0;

  constructor() {
    super('City');
  }

  create(): void {
    this.map = this.registry.get(MAP_KEY) as MapDef;
    this.state = this.registry.get(STATE_KEY) as GameState;
    const grid = buildWalkGrid(this.map);
    this.grid = grid;
    this.pathFinder = new PathFinder(grid);
    this.graph = buildLaneGraph(
      (x, y) => tileAt(this.map, x, y) === 'road',
      this.map.width,
      this.map.height,
    );
    this.player = new Player(grid, { x: this.map.spawn.gx, y: this.map.spawn.gy });
    this.input2 = new InputMapper();
    this.registry.set(INPUT_KEY, this.input2);
    this.props = [];
    this.pickups.length = 0;
    this.bumpables.length = 0;
    this.walkers.length = 0;
    this.mode = 'foot';

    const cam = this.cameras.main;
    cam.setZoom(RS * WORLD_ZOOM).setBackgroundColor(PALETTE.water);

    // Ground chunks.
    for (let cy = 0; cy < this.map.height; cy += 16) {
      for (let cx = 0; cx < this.map.width; cx += 16) {
        addBakedImage(this, getBaked(`ground:${this.map.id}:${cx},${cy}`), 0, 0).setDepth(
          -1_000_000,
        );
      }
    }

    // Buildings, trees, fountain.
    for (const def of this.map.buildings) {
      const meta = getBaked(buildingTextureKey(def));
      const p = gridToScreen(def.gx, def.gy);
      const depth = footprintDepth({ x: def.gx, y: def.gy, w: def.w, d: def.d });
      const image = addBakedImage(this, meta, p.x, p.y).setDepth(depth);
      image.setName(def.id);
      this.props.push({ def, image, bounds: image.getBounds(), depth, faded: false });
      maskFor(this.textures, meta.key); // build occlusion masks now, not mid-chase
    }

    // Small props: cones and cans tumble; the traffic light just stands there.
    for (const p of this.map.props) {
      if (p.kind === 'trafficLight') {
        const s = gridToScreen(p.gx, p.gy);
        addBakedImage(this, getBaked(PROP.trafficLight), s.x, s.y).setDepth(
          depthOf(p.gx, p.gy) + 30,
        );
      } else {
        const meta = getBaked(p.kind === 'cone' ? PROP.cone : PROP.trashcan);
        this.bumpables.push(new Bumpable(this, p.id, meta, { x: p.gx, y: p.gy }));
      }
    }

    // Minigame pad.
    const pad = marker(this.map, MINIGAME_ID);
    this.padPos = { x: pad.gx, y: pad.gy };
    const ps = gridToScreen(pad.gx, pad.gy);
    const padImg = addBakedImage(this, getBaked(PROP.pad), ps.x, ps.y).setDepth(-999_990);
    this.tweens.add({
      targets: padImg,
      scaleY: padImg.scaleY * 1.08,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    // Go-to marker.
    this.target = this.add
      .image(0, 0, UI.target)
      .setScale(1 / WT)
      .setDepth(-999_980)
      .setVisible(false);

    // Player.
    const s = gridToScreen(this.player.pos.x, this.player.pos.y);
    this.playerImg = this.add
      .image(s.x, s.y, characterFrameKey('player', this.player.facing, 0))
      .setOrigin(0.5, CHAR_FOOT_Y / CHAR_H)
      .setScale(1 / WT);

    // Police car, parked by the station.
    const carAt = marker(this.map, 'police-car');
    this.car = new Vehicle(this, this.graph, POLICE_CAR, this.graph.get(carAt.gx, carAt.gy)!, {
      x: 1,
      y: 0,
    });
    this.car.img.setName('police-car');

    // Pickles and his getaway car.
    const gaAt = marker(this.map, 'getaway-start');
    this.donutMeta = getBaked(PROP.donut);
    this.robber = new RobberChase(
      this,
      this.graph,
      this.graph.get(gaAt.gx, gaAt.gy)!,
      { x: 1, y: 0 },
      getBaked(PROP.puff),
      {
        onDrop: (at) => this.dropDonut(at),
        onBump: () => undefined,
        onOutOfGas: () => voice.say('out-of-gas'),
        onCaught: () => this.onRobberCaught(),
      },
    );

    // Donut shop owner and townspeople.
    const own = marker(this.map, OWNER_ID);
    this.owner = new Townsperson(
      this,
      OWNER_ID,
      'baker',
      { x: own.gx, y: own.gy },
      getBaked(PROP.bubble),
    );
    for (const w of this.map.walkers) this.walkers.push(new Pedestrian(this, w, w.look));

    // Camera: follow softly, clamp to the island.
    const left = gridToScreen(0, this.map.height);
    const right = gridToScreen(this.map.width, 0);
    const bottom = gridToScreen(this.map.width, this.map.height);
    const margin = 48;
    cam.setBounds(
      left.x - margin,
      -260,
      right.x - left.x + margin * 2,
      bottom.y + 260 + margin + 30,
    );
    cam.startFollow(this.playerImg, false, CAMERA_LERP, CAMERA_LERP);
    cam.centerOn(s.x, s.y);

    this.wireInput();
    this.game.events.on(EV.minigameComplete, this.onMinigameComplete, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(EV.minigameComplete, this.onMinigameComplete, this);
      this.scene.stop('Hud');
    });
    this.scene.launch('Hud');

    // The mission starts right away: "You're a police officer! Hop in your police car!"
    this.state.startMission(MISSION_ID, this.time.now);
    this.time.delayedCall(700, () => voice.say('intro-donut-dash'));
  }

  // ---------------------------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------------------------

  private sample(p: Phaser.Input.Pointer): PointerSample {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    return {
      id: p.id,
      screen: { x: p.x / RS, y: p.y / RS },
      world: { x: w.x, y: w.y },
      isTouch: p.wasTouch,
      time: this.time.now,
    };
  }

  /** Pointer events on HUD buttons belong to the HUD, not the world. */
  private onUi(p: Phaser.Input.Pointer): boolean {
    const hit = this.registry.get(HUD_HIT_KEY) as ((x: number, y: number) => boolean) | undefined;
    return !!hit?.(p.x / RS, p.y / RS);
  }

  private wireInput(): void {
    const kb = this.input.keyboard;
    if (kb) {
      kb.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE']);
      kb.on('keydown', (e: KeyboardEvent) => this.input2.keyDown(e.code));
      kb.on('keyup', (e: KeyboardEvent) => this.input2.keyUp(e.code));
    }
    const uiDown = new Set<number>();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.onUi(p)) {
        uiDown.add(p.id);
        return;
      }
      this.input2.pointerDown(this.sample(p));
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!uiDown.has(p.id)) this.input2.pointerMove(this.sample(p));
    });
    const up = (p: Phaser.Input.Pointer) => {
      if (uiDown.delete(p.id)) return;
      this.input2.pointerUp(this.sample(p));
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    const onBlur = () => this.input2.reset();
    window.addEventListener('blur', onBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      window.removeEventListener('blur', onBlur),
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Hit tests
  // ---------------------------------------------------------------------------------------------

  private opaqueAt(
    img: Phaser.GameObjects.Image,
    wx: number,
    wy: number,
    bounds?: Phaser.Geom.Rectangle,
  ): boolean {
    const b = bounds ?? img.getBounds();
    if (!b.contains(wx, wy)) return false;
    const tx = Math.floor((wx - b.x) * WT);
    const ty = Math.floor((wy - b.y) * WT);
    return solidAt(this.textures, img.texture.key, tx, ty);
  }

  /** The building drawn on top under a world point (opaque pixels only), if any. */
  private buildingAt(world: Vec2): Prop | null {
    let best: Prop | null = null;
    for (const p of this.props) {
      if (!this.opaqueAt(p.image, world.x, world.y, p.bounds)) continue;
      if (!best || p.depth > best.depth) best = p;
    }
    return best;
  }

  // ---------------------------------------------------------------------------------------------
  // Player on foot / in the car
  // ---------------------------------------------------------------------------------------------

  /** Request a walk to a tile (tap/click and the debug hook). */
  goTo(gx: number, gy: number, hitBuilding: Prop | null = null): boolean {
    let tx = gx + 0.5;
    let ty = gy + 0.5;
    if (hitBuilding) {
      tx = hitBuilding.def.gx + hitBuilding.def.w / 2;
      ty = hitBuilding.def.gy + hitBuilding.def.d / 2;
    }
    const path = this.pathFinder.find(this.player.pos, { x: tx, y: ty });
    if (!path || path.length === 0) return false;
    this.player.setPath(path);
    const end = path[path.length - 1]!;
    this.showTarget(gridToScreen(end.x + 0.5, end.y + 0.5));
    return true;
  }

  private showTarget(at: Vec2): void {
    this.target.setPosition(at.x, at.y).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.target);
    this.target.setScale(1.4 / WT);
    this.tweens.add({ targets: this.target, scale: 1 / WT, duration: 260, ease: 'Back.easeOut' });
  }

  private distToCar(): number {
    return Math.hypot(this.player.pos.x - this.car.pos.x, this.player.pos.y - this.car.pos.y);
  }

  enterCar(): void {
    if (this.mode === 'car') return;
    this.mode = 'car';
    this.autoEnter = false;
    this.player.cancelPath();
    this.target.setVisible(false);
    sfx.play('pop');
    this.tweens.add({
      targets: this.playerImg,
      scale: 0,
      duration: 160,
      onComplete: () => this.playerImg.setVisible(false).setScale(1 / WT),
    });
    this.tweens.add({ targets: this.car, hop: 10, duration: 120, yoyo: true });
    this.cameras.main.startFollow(this.car.img, false, CAMERA_LERP, CAMERA_LERP);
    this.notifyMission({ type: 'reached', target: 'police-car' });
  }

  exitCar(): void {
    if (this.mode !== 'car') return;
    this.mode = 'foot';
    this.car.driver.speed = 0;
    this.car.driver.cancelPath();
    // Hop out onto the nearest sidewalk/grass tile.
    const c = this.car.pos;
    let best: Vec2 = { ...c };
    let bestD = Infinity;
    for (let y = Math.floor(c.y) - 3; y <= Math.floor(c.y) + 3; y++) {
      for (let x = Math.floor(c.x) - 3; x <= Math.floor(c.x) + 3; x++) {
        if (!this.grid.isWalkable(x, y) || tileAt(this.map, x, y) === 'road') continue;
        const d = (x + 0.5 - c.x) ** 2 + (y + 0.5 - c.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { x: x + 0.5, y: y + 0.5 };
        }
      }
    }
    this.player.pos = best;
    this.player.cancelPath();
    this.playerImg.setVisible(true).setScale(0);
    this.tweens.add({
      targets: this.playerImg,
      scale: 1 / WT,
      duration: 200,
      ease: 'Back.easeOut',
    });
    sfx.play('pop');
    this.cameras.main.startFollow(this.playerImg, false, CAMERA_LERP, CAMERA_LERP);
  }

  private focusPos(): Vec2 {
    return this.mode === 'car' ? this.car.pos : this.player.pos;
  }

  // ---------------------------------------------------------------------------------------------
  // Mission, errand, minigame
  // ---------------------------------------------------------------------------------------------

  private notifyMission(e: Parameters<NonNullable<GameState['mission']>['notify']>[0]): void {
    const run = this.state.mission;
    if (!run) return;
    const r = run.notify(e, this.time.now);
    if (!r) return;
    if (r === 'complete') {
      const res = this.state.completeMission();
      this.missionWaiting = true;
      this.time.delayedCall(1300, () => {
        sfx.play('tada');
        voice.say('mission-done');
        this.game.events.emit(EV.missionComplete, res);
      });
      this.time.delayedCall(REPLAY_AFTER_SEC * 1000, () => this.replayMission());
      return;
    }
    if (run.goal?.type === 'catch') this.startChase();
  }

  private startChase(): void {
    if (this.robber.phase !== 'parked') this.robber.reset();
    this.time.delayedCall(900, () => {
      voice.say('chase-start', { interrupt: true });
      this.robber.start();
    });
  }

  private replayMission(): void {
    this.missionWaiting = false;
    this.robber.reset();
    this.state.startMission(MISSION_ID, this.time.now);
    voice.say('pickles-back');
    if (this.mode === 'car') this.notifyMission({ type: 'reached', target: 'police-car' });
  }

  private onRobberCaught(): void {
    this.notifyMission({ type: 'caught', robber: 'pickles' });
  }

  private dropDonut(at: Vec2): void {
    this.pickups.push(new Pickup(this, 'donut', this.donutMeta, at));
    sfx.play('pop', 0.8);
    if (this.state.errands.statusOf(ERRAND_ID) !== 'offered') {
      this.state.errands.offer(ERRAND_ID);
      this.owner.setOffering(true);
    }
  }

  private updateErrand(): void {
    if (!this.owner.offering) return;
    const f = this.focusPos();
    const d = Math.hypot(f.x - this.owner.pos.x, f.y - this.owner.pos.y);
    const donuts = this.state.inventory.donut ?? 0;
    if (d < 2.2 && donuts > 0) {
      const reward = this.state.completeErrand(ERRAND_ID);
      if (reward !== null) {
        this.owner.setOffering(false);
        this.owner.cheer();
        sfx.coin();
        voice.say('errand-done', { interrupt: true });
      }
    } else if (d < 4 && !this.owner.asked) {
      this.owner.asked = true;
      voice.say('errand-offer');
    }
  }

  startMinigame(): void {
    this.input2.reset();
    this.player.cancelPath();
    this.scene.pause();
    this.scene.sleep('Hud');
    this.scene.launch('TrafficHelper', { id: MINIGAME_ID, plays: this.state.plays(MINIGAME_ID) });
  }

  private onMinigameComplete(_r: MinigameResult): void {
    // Coins were already paid by GameState.finishMinigame; the HUD shows them.
    this.onPad = true; // don't relaunch until the player steps off the pad
  }

  // ---------------------------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------------------------

  update(time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;
    const focusWorld = gridToScreen(this.focusPos().x, this.focusPos().y);
    const a = this.input2.update(time, focusWorld);
    const moving = Math.hypot(a.move.x, a.move.y) > 0;
    const hadInput = moving || !!a.goTo || a.action || a.siren;

    if (this.mode === 'foot') this.updateOnFoot(dt, a);
    else this.updateDriving(dt, a);

    this.robber.update(dt, this.focusPos(), this.mode === 'car' ? this.car : null);
    if (this.mode === 'foot') this.car.update(dt, { stick: null });

    // Vehicles knock over cones and cans (pays nothing).
    for (const v of [this.car, this.robber.car]) {
      if (Math.abs(v.driver.speed) < 0.3) continue;
      for (const b of this.bumpables) {
        if (Math.hypot(v.pos.x - b.home.x, v.pos.y - b.home.y) < 0.55 && b.bump(v.pos)) {
          sfx.play('bump', 1.2, 0.7);
        }
      }
    }

    // Pickups.
    const f = this.focusPos();
    for (const p of this.pickups) {
      if (p.near(f)) {
        p.collect();
        this.state.pickUp(p.item);
        sfx.play('pop', 1.3);
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--)
      if (!this.pickups[i]!.alive) this.pickups.splice(i, 1);

    // Pedestrians hop when a moving vehicle comes near.
    const movingVehicles = [this.car, this.robber.car]
      .filter((v) => Math.abs(v.driver.speed) > 0.5)
      .map((v) => v.pos);
    for (const w of this.walkers) {
      if (w.update(dt, movingVehicles)) voice.say('whoa', { minGapMs: 5000 });
    }

    this.updateErrand();

    // Idle hints.
    if (this.hints.update(dt, hadInput)) {
      const h = this.hintTarget();
      if (h) voice.say(h.line);
    }

    this.updateDepths();
    this.publishHud();
  }

  private updateOnFoot(dt: number, a: ReturnType<InputMapper['update']>): void {
    if (a.goTo) {
      const world = this.input2.lastGoToWorld;
      if (world && this.opaqueAt(this.car.img, world.x, world.y)) {
        // Tapped the police car: walk over and hop in.
        if (this.distToCar() <= ENTER_CAR_DIST) this.enterCar();
        else {
          const c = this.car.pos;
          this.goTo(Math.floor(c.x), Math.floor(c.y));
          this.autoEnter = true;
        }
      } else {
        this.autoEnter = false;
        let hit = world ? this.buildingAt(world) : null;
        if (hit && hit.def.h < 1 && this.grid.isWalkable(a.goTo.gx, a.goTo.gy)) hit = null;
        this.goTo(a.goTo.gx, a.goTo.gy, hit);
      }
    }
    if (a.action && this.distToCar() <= ENTER_CAR_DIST) this.enterCar();
    if (this.mode !== 'foot') return;

    if (Math.hypot(a.move.x, a.move.y) > 0) this.autoEnter = false;
    this.player.update(dt, a.move);
    if (!this.player.following) this.target.setVisible(false);
    if (this.autoEnter && this.distToCar() <= ENTER_CAR_DIST) {
      this.enterCar();
      return;
    }

    const p = gridToScreen(this.player.pos.x, this.player.pos.y);
    this.playerImg.setPosition(p.x, p.y);
    if (this.player.moving) {
      this.bobTimer += dt;
      if (this.bobTimer > 0.14) {
        this.bobTimer = 0;
        this.bobFrame = this.bobFrame === 0 ? 1 : 0;
      }
    } else {
      this.bobFrame = 0;
      this.bobTimer = 0;
    }
    this.playerImg.setTexture(characterFrameKey('player', this.player.facing, this.bobFrame));

    // Minigame pad: step on it to play.
    const dPad = Math.hypot(this.player.pos.x - this.padPos.x, this.player.pos.y - this.padPos.y);
    if (dPad < 0.55 && !this.onPad) {
      this.onPad = true;
      this.startMinigame();
    } else if (dPad > 1.0) this.onPad = false;
  }

  private updateDriving(dt: number, a: ReturnType<InputMapper['update']>): void {
    if (a.action && Math.abs(this.car.driver.speed) < 1.5) {
      this.exitCar();
      return;
    }
    if (a.siren) {
      this.sirenPresses++;
      sfx.sirenBlast();
      this.car.flash(2.5);
    }
    if (a.goTo) {
      const world = this.input2.lastGoToWorld;
      if (world && this.opaqueAt(this.car.img, world.x, world.y)) {
        sfx.play('horn');
      } else if (world) {
        const g = screenToGrid(world.x, world.y);
        if (this.car.driver.goToward(g)) {
          const end = this.graph.node(this.car.driver.path.at(-1) ?? this.car.driver.to.id);
          this.showTarget(gridToScreen(end.x, end.y));
        }
      }
    }
    // Road assist steers by screen direction (ADR-004).
    const stick = Math.hypot(a.move.x, a.move.y) > 0 ? a.move : null;
    this.car.update(dt, { stick });
    if (this.car.driver.path.length === 0 && this.car.driver.speed === 0)
      this.target.setVisible(false);
  }

  // ---------------------------------------------------------------------------------------------
  // Depth sorting + occlusion fade for everything that moves
  // ---------------------------------------------------------------------------------------------

  private sortMover(
    img: Phaser.GameObjects.Image,
    pos: Vec2,
    r: number,
    samples: Vec2[] | null,
  ): Set<string> {
    const mb = img.getBounds();
    const occluders: Occluder[] = [];
    for (const prop of this.props) {
      if (!Phaser.Geom.Rectangle.Overlaps(mb, prop.bounds)) continue;
      const overlaps = samples
        ? samples.some((o) => this.opaqueAt(prop.image, img.x + o.x, img.y + o.y, prop.bounds))
        : true;
      occluders.push({
        id: prop.def.id,
        box: { x: prop.def.gx, y: prop.def.gy, w: prop.def.w, d: prop.def.d },
        depth: prop.depth,
        overlaps,
      });
    }
    const res = resolveOcclusion({ x: pos.x, y: pos.y, r }, occluders);
    img.setDepth(res.depth);
    return res.hiding;
  }

  private updateDepths(): void {
    let hiding: Set<string>;
    if (this.mode === 'foot') {
      hiding = this.sortMover(this.playerImg, this.player.pos, this.player.radius, CHAR_SAMPLES);
      this.sortMover(this.car.img, this.car.pos, 0.4, null);
    } else {
      hiding = this.sortMover(this.car.img, this.car.pos, 0.4, CAR_SAMPLES);
    }
    this.sortMover(this.robber.car.img, this.robber.pos, 0.4, null);
    for (const w of this.walkers) this.sortMover(w.img, w.pos, 0.25, null);

    for (const prop of this.props) {
      const hide = hiding.has(prop.def.id);
      if (hide === prop.faded) continue;
      prop.faded = hide;
      this.tweens.killTweensOf(prop.image);
      this.tweens.add({ targets: prop.image, alpha: hide ? OCCLUDED_ALPHA : 1, duration: FADE_MS });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // HUD + hints
  // ---------------------------------------------------------------------------------------------

  /** Where the "can't get stuck" arrow should point, and what to say. */
  hintTarget(): { at: Vec2; line: string } | null {
    const goal = this.state.mission?.goal;
    if (goal && !this.missionWaiting) {
      if (goal.type === 'goTo' || (goal.type === 'catch' && this.mode === 'foot')) {
        return { at: this.car.pos, line: 'hint-car' };
      }
      if (goal.type === 'catch') return { at: this.robber.pos, line: 'hint-chase' };
    }
    if (this.owner.offering && (this.state.inventory.donut ?? 0) > 0) {
      return { at: this.owner.pos, line: 'hint-errand' };
    }
    return null;
  }

  private publishHud(): void {
    let hint: Vec2 | null = null;
    if (this.hints.showing) {
      const t = this.hintTarget();
      if (t) {
        const w = gridToScreen(t.at.x, t.at.y);
        const cam = this.cameras.main;
        hint = {
          x: (w.x - cam.worldView.x) * WORLD_ZOOM,
          y: (w.y - 40 - cam.worldView.y) * WORLD_ZOOM,
        };
      }
    }
    const info: HudInfo = {
      mode: this.mode,
      action: this.mode === 'car' ? 'exit' : this.distToCar() <= ENTER_CAR_DIST ? 'enter' : 'none',
      donuts: this.state.inventory.donut ?? 0,
      sirenOn: this.car.flashing,
      hint,
    };
    this.registry.set(HUD_INFO_KEY, info);
  }

  /** Snapshot for tests / debugging. */
  debugState() {
    const run = this.state.mission;
    return {
      gx: this.player.pos.x,
      gy: this.player.pos.y,
      facing: this.player.facing,
      following: this.player.following,
      playerDepth: this.playerImg.depth,
      faded: this.props.filter((p) => p.faded).map((p) => p.def.id),
      screen: gridToScreen(this.player.pos.x, this.player.pos.y),
      mode: this.mode,
      car: { ...this.car.pos, speed: this.car.driver.speed, flashing: this.car.flashing },
      sirenPresses: this.sirenPresses,
      coins: this.state.economy.coins,
      donuts: this.state.inventory.donut ?? 0,
      mission: run
        ? { id: run.mission.id, goal: run.goal?.type ?? 'done', waiting: this.missionWaiting }
        : null,
      chase: {
        phase: this.robber.phase,
        bumps: this.robber.chase.bumps,
        misses: this.robber.chase.misses,
        outOfGas: this.robber.chase.outOfGas,
        dropped: this.robber.chase.dropped,
        x: this.robber.pos.x,
        y: this.robber.pos.y,
      },
      errand: this.state.errands.statusOf(ERRAND_ID),
      pickups: this.pickups.length,
      bumpables: this.bumpables.map((b) => ({ id: b.id, tumbling: b.tumbling, bumps: b.bumps })),
      hintShowing: this.hints.showing,
    };
  }

  /** Test hooks: run the idle clock forward (hints) without waiting 20 real seconds. */
  debugIdle(seconds: number): void {
    if (this.hints.update(seconds, false)) {
      const h = this.hintTarget();
      if (h) voice.say(h.line);
    }
  }
}
