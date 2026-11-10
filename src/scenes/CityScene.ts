import Phaser from 'phaser';
import { addBakedImage, getBaked } from '../art/blocks';
import { buildingTextureKey } from '../art/buildings';
import { CHAR_FOOT_Y, CHAR_H, characterFrameKey } from '../art/characters';
import { RS, WT } from '../art/renderScale';
import { UI } from '../art/ui';
import { CAMERA_LERP, FADE_MS, OCCLUDED_ALPHA, PALETTE, WORLD_ZOOM } from '../config';
import type { BuildingDef, MapDef } from '../content/schema';
import { buildWalkGrid } from '../content/world';
import { Player } from '../entities/Player';
import { InputMapper, type PointerSample } from '../input/InputMapper';
import type { WalkGrid } from '../iso/grid';
import { PathFinder } from '../iso/path';
import { footprintDepth, gridToScreen, type Vec2 } from '../iso/projection';
import { resolveOcclusion, type Occluder } from '../systems/occlusion';
import { MAP_KEY } from './BootScene';

interface Prop {
  def: BuildingDef;
  image: Phaser.GameObjects.Image;
  depth: number;
  faded: boolean;
}

/** Sample points on the player sprite (offsets from the feet, logical px) for occlusion tests. */
const PLAYER_SAMPLES: Vec2[] = [
  { x: 0, y: -4 },
  { x: 0, y: -24 },
  { x: 0, y: -46 },
  { x: -10, y: -30 },
  { x: 10, y: -30 },
];

export const INPUT_KEY = 'input';

/** The isometric world: ground, buildings, the walking player, camera. */
export class CityScene extends Phaser.Scene {
  map!: MapDef;
  player!: Player;
  input2!: InputMapper;
  private pathFinder!: PathFinder;
  private grid!: WalkGrid;
  private playerImg!: Phaser.GameObjects.Image;
  private props: Prop[] = [];
  private target!: Phaser.GameObjects.Image;
  private bobTimer = 0;
  private bobFrame: 0 | 1 = 0;

  constructor() {
    super('City');
  }

  create(): void {
    this.map = this.registry.get(MAP_KEY) as MapDef;
    const grid = buildWalkGrid(this.map);
    this.grid = grid;
    this.pathFinder = new PathFinder(grid);
    this.player = new Player(grid, { x: this.map.spawn.gx, y: this.map.spawn.gy });
    this.input2 = new InputMapper();
    this.registry.set(INPUT_KEY, this.input2);
    this.props = [];

    const cam = this.cameras.main;
    cam.setZoom(RS * WORLD_ZOOM).setBackgroundColor(PALETTE.water);

    // Ground (one baked texture).
    const ground = getBaked(`ground:${this.map.id}`);
    addBakedImage(this, ground, 0, 0).setDepth(-1_000_000);

    // Buildings, trees, fountain.
    for (const def of this.map.buildings) {
      const meta = getBaked(buildingTextureKey(def));
      const p = gridToScreen(def.gx, def.gy);
      const depth = footprintDepth({ x: def.gx, y: def.gy, w: def.w, d: def.d });
      const image = addBakedImage(this, meta, p.x, p.y).setDepth(depth);
      image.setName(def.id);
      this.props.push({ def, image, depth, faded: false });
    }

    // Go-to marker.
    this.target = this.add
      .image(0, 0, UI.target)
      .setScale(1 / WT)
      .setDepth(-999_999)
      .setVisible(false);

    // Player.
    const s = gridToScreen(this.player.pos.x, this.player.pos.y);
    this.playerImg = this.add
      .image(s.x, s.y, characterFrameKey('player', this.player.facing, 0))
      .setOrigin(0.5, CHAR_FOOT_Y / CHAR_H)
      .setScale(1 / WT);

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
    this.scene.launch('Hud');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scene.stop('Hud'));
  }

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

  private wireInput(): void {
    const kb = this.input.keyboard;
    if (kb) {
      // Stop the page scrolling on arrows/space.
      kb.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE']);
      kb.on('keydown', (e: KeyboardEvent) => this.input2.keyDown(e.code));
      kb.on('keyup', (e: KeyboardEvent) => this.input2.keyUp(e.code));
    }
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) =>
      this.input2.pointerDown(this.sample(p)),
    );
    this.input.on('pointermove', (p: Phaser.Input.Pointer) =>
      this.input2.pointerMove(this.sample(p)),
    );
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.input2.pointerUp(this.sample(p)));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) =>
      this.input2.pointerUp(this.sample(p)),
    );
    const onBlur = () => this.input2.reset();
    window.addEventListener('blur', onBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      window.removeEventListener('blur', onBlur),
    );
  }

  /** The building drawn on top under a world point (opaque pixels only), if any. */
  private buildingAt(world: Vec2): Prop | null {
    let best: Prop | null = null;
    for (const p of this.props) {
      if (!this.opaqueAt(p.image, world.x, world.y)) continue;
      if (!best || p.depth > best.depth) best = p;
    }
    return best;
  }

  private opaqueAt(img: Phaser.GameObjects.Image, wx: number, wy: number): boolean {
    const b = img.getBounds();
    if (!b.contains(wx, wy)) return false;
    const tx = Math.floor((wx - b.x) * WT);
    const ty = Math.floor((wy - b.y) * WT);
    const a = this.textures.getPixelAlpha(tx, ty, img.texture.key);
    return (a ?? 0) > 40;
  }

  /** Request a walk to a tile (used by tap/click and the debug hook). */
  goTo(gx: number, gy: number, hitBuilding: Prop | null = null): boolean {
    let tx = gx + 0.5;
    let ty = gy + 0.5;
    if (hitBuilding) {
      // Tapped a building: aim for the middle of its front edges.
      tx = hitBuilding.def.gx + hitBuilding.def.w / 2;
      ty = hitBuilding.def.gy + hitBuilding.def.d / 2;
    }
    const path = this.pathFinder.find(this.player.pos, { x: tx, y: ty });
    if (!path || path.length === 0) return false;
    this.player.setPath(path);
    const end = path[path.length - 1]!;
    const m = gridToScreen(end.x + 0.5, end.y + 0.5);
    this.target.setPosition(m.x, m.y).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.target);
    this.target.setScale(1.4 / WT);
    this.tweens.add({ targets: this.target, scale: 1 / WT, duration: 260, ease: 'Back.easeOut' });
    return true;
  }

  update(time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;
    const before = gridToScreen(this.player.pos.x, this.player.pos.y);
    const a = this.input2.update(time, before);

    if (a.goTo) {
      const world = this.input2.lastGoToWorld;
      let hit = world ? this.buildingAt(world) : null;
      // Low things (fountain rim) only capture the tap when the ground under it isn't walkable.
      if (hit && hit.def.h < 1 && this.grid.isWalkable(a.goTo.gx, a.goTo.gy)) hit = null;
      this.goTo(a.goTo.gx, a.goTo.gy, hit);
    }

    this.player.update(dt, a.move);
    if (!this.player.following) this.target.setVisible(false);

    // Sprite: position, facing, walk bob.
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

    this.updateOcclusion(p);
  }

  private updateOcclusion(feet: Vec2): void {
    const pb = this.playerImg.getBounds();
    const occluders: Occluder[] = [];
    for (const prop of this.props) {
      const bb = prop.image.getBounds();
      let overlaps = false;
      if (Phaser.Geom.Rectangle.Overlaps(pb, bb)) {
        overlaps = PLAYER_SAMPLES.some((o) =>
          this.opaqueAt(prop.image, feet.x + o.x, feet.y + o.y),
        );
      }
      occluders.push({
        id: prop.def.id,
        box: { x: prop.def.gx, y: prop.def.gy, w: prop.def.w, d: prop.def.d },
        depth: prop.depth,
        overlaps,
      });
    }
    const r = resolveOcclusion(
      { x: this.player.pos.x, y: this.player.pos.y, r: this.player.radius },
      occluders,
    );
    this.playerImg.setDepth(r.depth);
    for (const prop of this.props) {
      const hide = r.hiding.has(prop.def.id);
      if (hide === prop.faded) continue;
      prop.faded = hide;
      this.tweens.killTweensOf(prop.image);
      this.tweens.add({ targets: prop.image, alpha: hide ? OCCLUDED_ALPHA : 1, duration: FADE_MS });
    }
  }

  /** Snapshot for tests / debugging. */
  debugState() {
    return {
      gx: this.player.pos.x,
      gy: this.player.pos.y,
      facing: this.player.facing,
      following: this.player.following,
      playerDepth: this.playerImg.depth,
      faded: this.props.filter((p) => p.faded).map((p) => p.def.id),
      screen: gridToScreen(this.player.pos.x, this.player.pos.y),
    };
  }
}
