import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { maskFor, solidAt } from '../art/alphaMask';
import { addBakedImage, getBaked, type BakedMeta } from '../art/blocks';
import { buildingTextureKey } from '../art/buildings';
import { CHAR_FOOT_Y, CHAR_H, characterFrameKey, ensureLook } from '../art/characters';
import { groundChunkKey } from '../art/ground';
import type { IconName } from '../art/icons';
import { iconKey } from '../art/menu';
import { bubbleKey, MPROP, padKey } from '../art/missionProps';
import { PROP } from '../art/props';
import { RS, WT } from '../art/renderScale';
import { UI } from '../art/ui';
import {
  GETAWAY_CAR,
  GETAWAY_CAR_2,
  GETAWAY_EMPTY,
  GETAWAY_EMPTY_2,
  POLICE_BIKE,
  POLICE_BIKE_RIDDEN,
  POLICE_CAR,
  SCOOTER,
  SCOOTER_EMPTY,
  FIRE_TRUCK,
  MIXER_TRUCK,
  OWN_CARS,
  ownCarName,
  HELICOPTER,
  HELICOPTER_EMPTY,
  TRAFFIC_CARS,
} from '../art/vehicles';
import {
  BLOCK_H,
  BUMP_DIST,
  CAMERA_LERP,
  CAR_MAX_SPEED,
  ENTER_CAR_DIST,
  FADE_MS,
  OCCLUDED_ALPHA,
  PALETTE,
  WORLD_ZOOM,
} from '../config';
import { tileAt, type BuildingDef, type MapDef, type TileKind } from '../content/schema';
import { buildRoadGraph, buildWalkGrid } from '../content/world';
import { BuildSite } from '../entities/BuildSite';
import { Bumpable } from '../entities/Bumpable';
import { Fire } from '../entities/Fire';
import { Pedestrian } from '../entities/Pedestrian';
import { Pickup } from '../entities/Pickup';
import { Player } from '../entities/Player';
import { RobberChase, type RobberLooks } from '../entities/RobberChase';
import { TimeOutTower } from '../entities/TimeOutTower';
import { Townsperson } from '../entities/Townsperson';
import { TrafficCar } from '../entities/TrafficCar';
import { Vehicle } from '../entities/Vehicle';
import { InputMapper, type PointerSample } from '../input/InputMapper';
import type { WalkGrid } from '../iso/grid';
import { PathFinder } from '../iso/path';
import { depthOf, footprintDepth, gridToScreen, screenToGrid, type Vec2 } from '../iso/projection';
import type { LaneGraph, LaneNode } from '../iso/roads';
import { MissionDirector } from '../missions/MissionDirector';
import type { MissionWorld, VehicleId } from '../missions/world';
import type { GameState } from '../systems/GameState';
import { IdleHints } from '../systems/hints';
import type { MissionEvent, RobberSpec } from '../systems/missions';
import { BUILD, pickSite } from '../systems/build';
import { FIRE, pickFire, tooHigh } from '../systems/fire';
import { JOBS, lookFor } from '../systems/jobs';
import { netTarget, NetShot } from '../systems/net';
import { resolveOcclusion, type Occluder } from '../systems/occlusion';
import {
  EV,
  HUD_HIT_KEY,
  HUD_INFO_KEY,
  INPUT_KEY,
  MAP_KEY,
  OPEN_JOBS_KEY,
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

/** Minigame id → its scene key and pad picture. */
export const MINIGAMES: Record<string, { scene: string; icon: IconName }> = {
  'traffic-helper': { scene: 'TrafficHelper', icon: 'trafficLight' },
  'who-took-it': { scene: 'WhoTookIt', icon: 'magnifier' },
  'window-splash': { scene: 'WindowSplash', icon: 'window' },
  'ladder-rescue': { scene: 'LadderRescue', icon: 'ladder' },
  'block-stack': { scene: 'BlockStack', icon: 'crane' },
  'copy-the-build': { scene: 'CopyBuild', icon: 'grid' },
  'cement-pour': { scene: 'CementPour', icon: 'bucket' },
};

/** The vehicles each job may hop into. */
const JOB_VEHICLES: Record<string, VehicleId[]> = {
  cop: ['police-car', 'police-bike', 'own-car'],
  fire: ['fire-truck', 'own-car'],
  builder: ['mixer-truck', 'own-car'],
};

/** Townspeople who give missions or errands: marker id → look. */
const TOWNSPEOPLE: Record<string, string> = {
  chief: 'chief',
  'donut-owner': 'baker',
  mayor: 'mayor',
  'puppy-owner': 'kid',
  'sock-owner': 'grandma',
  'fire-chief': 'fireChief',
  'kitty-owner': 'grandma',
  'kid-heights': 'kid',
  foreman: 'foreman',
  'boat-owner': 'walkerBlue',
  florist: 'florist',
  painter: 'painter',
  teacher: 'teacher',
  chef: 'baker',
  grandpa: 'grandpa',
  keeper: 'mayor',
};

/** What each errand's giver says when it is offered. */
const ERRAND_LINES: Record<string, string> = {
  'return-donuts': 'errand-offer',
  'return-socks': 'errand-socks',
  'find-rubber-duck': 'errand-rubber-duck',
  'deliver-balloon': 'errand-balloon',
  'deliver-cake': 'errand-cake',
  'find-balloon': 'errand-find-balloon',
  'find-wrench': 'errand-wrench',
  'deliver-pizza': 'errand-pizza',
};

/** Robber looks by who and what he drives. */
function robberLooks(spec: RobberSpec, bumps: number): RobberLooks {
  if (spec.vehicle === 'heli')
    return {
      name: spec.id,
      look: HELICOPTER,
      empty: HELICOPTER_EMPTY,
      bumpsNeeded: bumps,
      speedScale: 0.8,
      altitude: 46,
    };
  if (spec.vehicle === 'scooter')
    return {
      name: spec.id,
      look: SCOOTER,
      empty: SCOOTER_EMPTY,
      bumpsNeeded: bumps,
      speedScale: 0.85,
    };
  return spec.id === 'smudge'
    ? { name: 'smudge', look: GETAWAY_CAR_2, empty: GETAWAY_EMPTY_2, bumpsNeeded: bumps }
    : { name: spec.id, look: GETAWAY_CAR, empty: GETAWAY_EMPTY, bumpsNeeded: bumps };
}

/** Police bike: a bit faster, much zippier off the line. */
const BIKE_MAX_SPEED = CAR_MAX_SPEED * 1.1;
const BIKE_ACCEL = 1.6;

/** The isometric world: walk, drive, missions, errands, minigame pads, the board and the shop. */
export class CityScene extends Phaser.Scene implements MissionWorld {
  map!: MapDef;
  state!: GameState;
  player!: Player;
  input2!: InputMapper;
  car!: Vehicle;
  bike: Vehicle | null = null;
  fireTruck: Vehicle | null = null;
  mixer: Vehicle | null = null;
  ownCar: Vehicle | null = null;
  private stationImgs: Phaser.GameObjects.Image[] = [];
  /** Builder build spots by id (spec 005). */
  readonly sites = new Map<string, BuildSite>();
  private blastAim: string | null = null;
  private blastCooldown = 0;
  /** Fires burning right now, by perch id (spec 004). */
  readonly fires = new Map<string, Fire>();
  private spraying: { id: string; left: number } | null = null;
  private hoseAim: string | null = null;
  private dropT = 0;
  carGraph!: LaneGraph;
  bikeGraph!: LaneGraph;
  tower!: TimeOutTower;
  director!: MissionDirector;
  mode: 'foot' | 'car' = 'foot';
  ridingId: VehicleId | null = null;
  readonly pickups: Pickup[] = [];
  readonly bumpables: Bumpable[] = [];
  readonly walkers: Pedestrian[] = [];
  readonly robbers: RobberChase[] = [];
  readonly traffic: TrafficCar[] = [];
  readonly people = new Map<string, Townsperson>();
  private pathFinder!: PathFinder;
  private grid!: WalkGrid;
  private playerImg!: Phaser.GameObjects.Image;
  private props: Prop[] = [];
  private target!: Phaser.GameObjects.Image;
  private bobTimer = 0;
  private bobFrame: 0 | 1 = 0;
  private autoEnter: VehicleId | null = null;
  /** Where you stand to play / open things, and whether you're on one now. */
  private spots: {
    id: string;
    kind: 'minigame' | 'board' | 'shop' | 'jobs' | 'home' | 'station';
    pos: Vec2;
  }[] = [];
  /** Minigame pads (faded and still when they belong to another job). */
  private pads = new Map<
    string,
    { img: Phaser.GameObjects.Image; pulse: Phaser.Tweens.Tween; baseScaleY: number }
  >();
  /** Pads of other jobs already explained this time round (so the voice doesn't nag). */
  private padRefused = new Set<string>();
  private onSpot: string | null = null;
  private hints = new IdleHints();
  private obstacles = new Map<string, readonly Vec2[]>();
  private nets: { shot: NetShot; img: Phaser.GameObjects.Image }[] = [];
  private netCooldown = 0;
  private netAim: string | null = null;
  private findSpawned = new Set<string>();
  private errandAsked = new Set<string>();
  sirenPresses = 0;

  constructor() {
    super('City');
  }

  // ---------------------------------------------------------------------------------------------
  // MissionWorld
  // ---------------------------------------------------------------------------------------------

  now(): number {
    return this.time.now;
  }

  marker(id: string): Vec2 {
    const p = this.map.markers[id];
    if (!p) throw new Error(`map has no marker '${id}'`);
    return { x: p.gx, y: p.gy };
  }

  hasMarker(id: string): boolean {
    return id in this.map.markers;
  }

  tileKind(x: number, y: number): TileKind {
    if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height) return 'water';
    return tileAt(this.map, x, y);
  }

  focus(): Vec2 {
    return this.riding()?.vehicle.pos ?? this.player.pos;
  }

  playerPos(): Vec2 {
    return this.player.pos;
  }

  moveMode(): 'foot' | 'car' {
    return this.mode;
  }

  get stage(): Phaser.Scene {
    return this;
  }

  riding(): { id: VehicleId; vehicle: Vehicle } | null {
    if (this.mode !== 'car' || !this.ridingId) return null;
    const v = this.vehicle(this.ridingId);
    return v ? { id: this.ridingId, vehicle: v } : null;
  }

  vehicle(id: VehicleId): Vehicle | null {
    if (id === 'police-car') return this.car;
    if (id === 'police-bike') return this.bike;
    if (id === 'fire-truck') return this.fireTruck;
    if (id === 'mixer-truck') return this.mixer;
    if (id === 'own-car') return this.ownCar;
    return null;
  }

  townsperson(id: string): Townsperson | null {
    return this.people.get(id) ?? null;
  }

  private nodeNear(graph: LaneGraph, p: Vec2): LaneNode {
    const exact = graph.get(Math.round(p.x), Math.round(p.y));
    if (exact) return exact;
    let best: LaneNode | null = null;
    let bestD = Infinity;
    for (const n of graph.nodes.values()) {
      const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best!;
  }

  spawnRobber(spec: RobberSpec, bumps: number, onCaught: (name: string) => void): RobberChase {
    const graph = spec.vehicle === 'scooter' ? this.bikeGraph : this.carGraph;
    const home = this.nodeNear(graph, this.marker(spec.start));
    const next = graph.node(home.links[0]!);
    const heading = { x: Math.sign(next.x - home.x), y: Math.sign(next.y - home.y) };
    let offered = false;
    const r = new RobberChase(
      this,
      graph,
      home,
      heading,
      getBaked(PROP.puff),
      {
        onDrop: (at) => {
          if (!spec.drops) return;
          this.dropPickup(spec.drops, at);
          if (!offered) {
            offered = true;
            const e = this.state.errands.all.find(
              (x) => x.kind === 'return' && x.item === spec.drops,
            );
            if (e && this.state.errands.statusOf(e.id) !== 'offered')
              this.state.errands.offer(e.id);
          }
        },
        onBump: () => undefined,
        onOutOfGas: () => voice.say('out-of-gas'),
        onCaught: () => onCaught(r.name),
      },
      Math.random,
      robberLooks(spec, bumps),
    );
    r.car.img.setAlpha(0);
    this.tweens.add({ targets: r.car.img, alpha: 1, duration: 400 });
    this.puff(r.pos);
    this.robbers.push(r);
    return r;
  }

  removeRobber(r: RobberChase): void {
    const i = this.robbers.indexOf(r);
    if (i >= 0) this.robbers.splice(i, 1);
    this.tweens.add({
      targets: r.car.img,
      alpha: 0,
      delay: 1500,
      duration: 500,
      onComplete: () => r.destroy(),
    });
  }

  dropPickup(item: string, at: Vec2): void {
    const key = item === 'donut' ? PROP.donut : `pickup-${item}`;
    const meta = this.textures.exists(key) ? getBaked(key) : getBaked(PROP.donut);
    this.pickups.push(new Pickup(this, item, meta, at));
    sfx.play('pop', 0.8);
  }

  setObstacles(key: string, pts: readonly Vec2[]): void {
    this.obstacles.set(key, pts);
  }

  puff(at: Vec2): void {
    const s = gridToScreen(at.x, at.y);
    const img = addBakedImage(this, getBaked(PROP.puff), s.x, s.y - 10).setDepth(
      depthOf(at.x, at.y) + 80,
    );
    const full = img.scaleX;
    img.setScale(full * 0.3);
    this.tweens.add({
      targets: img,
      scale: full * 1.2,
      alpha: 0,
      duration: 600,
      onComplete: () => img.destroy(),
    });
  }

  give(item: string): void {
    this.state.give(item);
    if (item === 'cap-cop') {
      sfx.play('sparkle');
      this.sparkleAt(this.player.pos);
    }
  }

  perch(id: string): Vec2 & { z: number } {
    const p = this.map.perches.find((x) => x.id === id);
    if (!p) throw new Error(`map has no perch '${id}'`);
    return { x: p.gx, y: p.gy, z: p.z };
  }

  lightFire(id: string): void {
    if (this.fires.has(id)) return;
    const p = this.perch(id);
    this.fires.set(id, new Fire(this, { id, x: p.x, y: p.y, z: p.z }));
  }

  fireBurning(id: string): boolean {
    const f = this.fires.get(id);
    return !!f && !f.state.out;
  }

  removeFire(id: string): void {
    const f = this.fires.get(id);
    if (!f) return;
    this.fires.delete(id);
    if (!f.state.out) f.destroy();
  }

  ladderReach(): number {
    return this.state.owns('long-ladder') ? FIRE.ladderZ.long : FIRE.ladderZ.standard;
  }

  raiseLadder(from: Vec2, to: Vec2 & { z: number }, ms: number): { destroy(): void } {
    const a = gridToScreen(from.x, from.y);
    a.y -= 26;
    const b = gridToScreen(to.x, to.y);
    b.y -= to.z * BLOCK_H;
    const g = this.add.graphics().setDepth(depthOf(to.x, to.y) + 210);
    const k = { v: 0 };
    const draw = () => {
      g.clear();
      const ex = a.x + (b.x - a.x) * k.v;
      const ey = a.y + (b.y - a.y) * k.v;
      const nx = -(ey - a.y);
      const ny = ex - a.x;
      const len = Math.hypot(nx, ny) || 1;
      const ox = (nx / len) * 5;
      const oy = (ny / len) * 5;
      g.lineStyle(4, PALETTE.outline, 1);
      g.lineBetween(a.x + ox, a.y + oy, ex + ox, ey + oy);
      g.lineBetween(a.x - ox, a.y - oy, ex - ox, ey - oy);
      g.lineStyle(2.5, 0xe4e7ee, 1);
      g.lineBetween(a.x + ox, a.y + oy, ex + ox, ey + oy);
      g.lineBetween(a.x - ox, a.y - oy, ex - ox, ey - oy);
      const steps = Math.floor(Math.hypot(ex - a.x, ey - a.y) / 12);
      for (let i = 1; i <= steps; i++) {
        const t = i / (steps + 1);
        const x = a.x + (ex - a.x) * t;
        const y = a.y + (ey - a.y) * t;
        g.lineBetween(x + ox, y + oy, x - ox, y - oy);
      }
    };
    this.tweens.add({ targets: k, v: 1, duration: ms, ease: 'Sine.easeOut', onUpdate: draw });
    return { destroy: () => g.destroy() };
  }

  /** Put on a job's uniform right now (finale parts, glowing stations; spec 007). */
  forceJob(job: 'cop' | 'fire' | 'builder'): void {
    if (this.state.job === job) return;
    this.state.forceJob(job);
    this.applyJob();
  }

  /** The glowing job stations appear once the finale is open (spec 007). */
  private stationsOpen(): boolean {
    return this.state.unlocked('finale-tower-fire') || this.state.owns('finale-done');
  }

  private updateStations(): void {
    const open = this.stationsOpen();
    for (const img of this.stationImgs) img.setVisible(open);
  }

  private paradeOn = false;
  private paradeT = 0;
  private convoy: { v: Vehicle; corner: number }[] = [];
  private fireworks: Phaser.Time.TimerEvent | null = null;

  /** The end of the story (spec 007): night falls, a parade goes round the Plaza, fireworks. */
  parade(): void {
    if (this.paradeOn) return;
    this.paradeOn = true;
    this.paradeT = 30;
    this.state.give('finale-done');
    this.state.save.flush();
    if (this.mode === 'car') this.exitCar();
    this.player.cancelPath();
    this.player.pos = { ...this.marker('parade-stand') };
    this.game.events.emit(EV.night, true);
    voice.say('parade', { interrupt: true });
    sfx.play('tada');
    // The convoy: every job vehicle (and your car), nose to tail along the top of the Plaza ring.
    const vs = [this.car, this.fireTruck, this.mixer, this.ownCar, this.bike].filter(
      (v): v is Vehicle => !!v && v.driver.graph === this.carGraph,
    );
    this.convoy = vs.map((v, i) => {
      const head = this.marker('parade-start');
      const node = this.nodeNear(this.carGraph, { x: head.x - i * 2, y: head.y });
      v.placeAt(node, { x: 1, y: 0 });
      v.flash(30);
      return { v, corner: 0 };
    });
    this.fireworks = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        const mid = this.marker('plaza-centre');
        const c = gridToScreen(
          mid.x + (Math.random() - 0.5) * 14,
          mid.y + (Math.random() - 0.5) * 14,
        );
        const fw = this.add
          .image(c.x, c.y - 120 - Math.random() * 80, iconKey('firework'))
          .setScale(0)
          .setDepth(1_000_000);
        this.tweens.add({
          targets: fw,
          scale: (0.5 + Math.random() * 0.4) / RS,
          duration: 300,
          ease: 'Back.easeOut',
        });
        this.tweens.add({
          targets: fw,
          alpha: 0,
          delay: 600,
          duration: 500,
          onComplete: () => fw.destroy(),
        });
        sfx.play('pop', 0.6 + Math.random() * 0.6, 0.5);
        for (const p of this.people.values()) if (Math.random() < 0.15) p.cheer();
      },
    });
  }

  /** Corners of the Plaza ring road, in driving order (map markers). */
  private static readonly RING = ['ring-ne', 'ring-se', 'ring-sw', 'ring-nw'];

  private updateParade(dt: number): void {
    if (!this.paradeOn) return;
    this.paradeT -= dt;
    for (const c of this.convoy) {
      const d = c.v.driver;
      if (d.path.length === 0 && Math.abs(d.speed) < 0.2) {
        d.goToward(this.marker(CityScene.RING[c.corner % 4]!));
        c.corner++;
      }
    }
    if (this.paradeT <= 0) {
      this.paradeOn = false;
      this.fireworks?.remove();
      this.fireworks = null;
      for (const c of this.convoy) c.v.driver.cancelPath();
      this.convoy = [];
      this.game.events.emit(EV.night, false);
      voice.say('morning', { interrupt: true });
    }
  }

  /** Builder (spec 005): the ids of everything built. */
  private builtIds(): Set<string> {
    return new Set(
      this.state.progress.owned.filter((o) => o.startsWith('built:')).map((o) => o.slice(6)),
    );
  }

  startSite(id: string): void {
    this.sites.get(id)?.begin();
  }

  stopSite(id: string): void {
    this.sites.get(id)?.cancel(this.builtIds().has(id));
  }

  siteDone(id: string): boolean {
    const s = this.sites.get(id);
    return !!s && s.built && !s.active;
  }

  /** The active build spot the blaster would build on (builder job only), or null. */
  aimBlast(): string | null {
    if (this.state.job !== 'builder') return null;
    const r = this.riding();
    const mode = r ? (r.id === 'mixer-truck' ? 'truck' : null) : 'foot';
    if (!mode) return null;
    const active = [...this.sites.values()]
      .filter((x) => x.active)
      .map((x) => ({ id: x.id, ...x.centre }));
    return pickSite(this.focus(), mode, active);
  }

  /** One press of the block blaster. */
  blast(id: string): void {
    const site = this.sites.get(id);
    if (!site || !site.active || this.blastCooldown > 0) return;
    this.blastCooldown = BUILD.cooldownSec;
    const from = gridToScreen(this.focus().x, this.focus().y);
    from.y -= 30;
    sfx.play('thunk');
    const n = this.state.owns('giant-drum') ? BUILD.giantPerPress : BUILD.perPress;
    if (site.addBlocks(n, from)) {
      this.time.delayedCall(560, () => {
        this.state.give(`built:${id}`);
        this.state.save.flush();
        this.refreshWalkGrid();
        // Built things block the way (or, for docks and bridges, let you walk on the water).
        if (!this.props.some((p) => p.def.id === id)) {
          const depth = footprintDepth({
            x: site.def.gx,
            y: site.def.gy,
            w: site.def.w,
            d: site.def.d,
          });
          this.props.push({
            def: site.def,
            image: site.img,
            bounds: site.img.getBounds(),
            depth,
            faded: false,
          });
        }
        sfx.play('tada');
        this.sparkleAt(site.centre);
        voice.say('built', { interrupt: true });
        this.notifyMission({ type: 'built', spot: id });
      });
    }
  }

  private refreshWalkGrid(): void {
    this.grid.copyFrom(buildWalkGrid(this.map, this.builtIds()));
    this.pathFinder.refresh();
  }

  goInside(room: string): void {
    this.pauseForOverlay();
    this.scene.launch('Interior', { room });
  }

  private onInteriorDone(r: { room: string }): void {
    this.notifyMission({ type: 'insideDone', room: r.room });
  }

  private sparkleAt(at: Vec2): void {
    const s = gridToScreen(at.x, at.y);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const img = addBakedImage(this, getBaked(MPROP.sparkle), s.x, s.y - 40).setDepth(
        depthOf(at.x, at.y) + 90,
      );
      this.tweens.add({
        targets: img,
        x: s.x + Math.cos(a) * 46,
        y: s.y - 40 + Math.sin(a) * 30,
        alpha: 0,
        duration: 700,
        onComplete: () => img.destroy(),
      });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Set-up
  // ---------------------------------------------------------------------------------------------

  create(): void {
    this.map = this.registry.get(MAP_KEY) as MapDef;
    this.state = this.registry.get(STATE_KEY) as GameState;
    const built = new Set(
      this.state.progress.owned.filter((o) => o.startsWith('built:')).map((o) => o.slice(6)),
    );
    const grid = buildWalkGrid(this.map, built);
    this.grid = grid;
    this.pathFinder = new PathFinder(grid);
    this.carGraph = buildRoadGraph(this.map, 'car');
    this.bikeGraph = buildRoadGraph(this.map, 'bike');
    this.player = new Player(grid, { x: this.map.spawn.gx, y: this.map.spawn.gy });
    this.input2 = new InputMapper();
    this.registry.set(INPUT_KEY, this.input2);
    this.registry.set(OPEN_JOBS_KEY, () => this.openMenu('JobCenter'));
    this.props = [];
    this.pickups.length = 0;
    this.bumpables.length = 0;
    this.walkers.length = 0;
    this.robbers.length = 0;
    this.traffic.length = 0;
    this.people.clear();
    this.spots = [];
    this.pads = new Map();
    this.padRefused = new Set();
    this.nets = [];
    this.obstacles.clear();
    this.findSpawned.clear();
    this.errandAsked.clear();
    this.mode = 'foot';
    this.ridingId = null;
    this.bike = null;
    this.fireTruck = null;
    this.mixer = null;
    this.ownCar = null;
    this.sites.clear();
    this.fires.clear();
    this.spraying = null;

    const cam = this.cameras.main;
    cam.setZoom(RS * WORLD_ZOOM).setBackgroundColor(PALETTE.water);

    // Ground chunks (all-sea chunks have no texture).
    for (let cy = 0; cy < this.map.height; cy += 16) {
      for (let cx = 0; cx < this.map.width; cx += 16) {
        const key = groundChunkKey(this.map, cx, cy);
        if (!this.textures.exists(key)) continue;
        addBakedImage(this, getBaked(key), 0, 0).setDepth(-1_000_000);
      }
    }

    // Buildings, trees, fountain, Time-Out Tower.
    for (const def of this.map.buildings) {
      if (def.site) {
        const site = new BuildSite(this, def, built.has(def.id));
        this.sites.set(def.id, site);
        if (built.has(def.id)) {
          const depth = footprintDepth({ x: def.gx, y: def.gy, w: def.w, d: def.d });
          this.props.push({
            def,
            image: site.img,
            bounds: site.img.getBounds(),
            depth,
            faded: false,
          });
        }
        continue;
      }
      const meta = getBaked(buildingTextureKey(def));
      const p = gridToScreen(def.gx, def.gy);
      const depth = footprintDepth({ x: def.gx, y: def.gy, w: def.w, d: def.d });
      const image = addBakedImage(this, meta, p.x, p.y).setDepth(depth);
      image.setName(def.id);
      this.props.push({ def, image, bounds: image.getBounds(), depth, faded: false });
      maskFor(this.textures, meta.key); // build occlusion masks now, not mid-chase
      if (def.kind === 'timeout') this.tower = new TimeOutTower(this, def);
    }

    // Small props: cones and cans tumble; lights, bushes and the board just stand there.
    for (const p of this.map.props) {
      const s = gridToScreen(p.gx, p.gy);
      if (p.kind === 'trafficLight') {
        addBakedImage(this, getBaked(PROP.trafficLight), s.x, s.y).setDepth(
          depthOf(p.gx, p.gy) + 30,
        );
      } else if (p.kind === 'bush') {
        addBakedImage(this, getBaked(MPROP.bush), s.x, s.y).setDepth(depthOf(p.gx, p.gy) + 20);
      } else if (p.kind === 'grill') {
        addBakedImage(this, getBaked(MPROP.grill), s.x, s.y).setDepth(depthOf(p.gx, p.gy) + 30);
      } else if (p.kind === 'board') {
        addBakedImage(this, getBaked(MPROP.board), s.x, s.y).setDepth(depthOf(p.gx, p.gy) + 30);
      } else if (p.kind === 'flowers') {
        addBakedImage(this, getBaked(PROP.flowers), s.x, s.y).setDepth(-999_995);
      } else if (p.kind === 'bench' || p.kind === 'lamp' || p.kind === 'planter') {
        addBakedImage(this, getBaked(PROP[p.kind]), s.x, s.y).setDepth(depthOf(p.gx, p.gy) + 20);
      } else if (p.kind === 'buoy') {
        // Buoys bob on the swell.
        const img = addBakedImage(this, getBaked(PROP.buoy), s.x, s.y).setDepth(
          depthOf(p.gx, p.gy) + 20,
        );
        this.tweens.add({
          targets: img,
          y: s.y - 4,
          angle: { from: -5, to: 5 },
          duration: 1100 + (p.gx % 3) * 150,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else {
        const meta = getBaked(p.kind === 'cone' ? PROP.cone : PROP.trashcan);
        this.bumpables.push(new Bumpable(this, p.id, meta, { x: p.gx, y: p.gy }));
      }
    }

    // Pads: minigames, the mission board, the shop door.
    for (const [id, mg] of Object.entries(MINIGAMES)) {
      if (!this.hasMarker(id)) continue;
      const at = this.marker(id);
      this.spots.push({ id, kind: 'minigame', pos: at });
      const s = gridToScreen(at.x, at.y);
      const padImg = addBakedImage(this, getBaked(padKey(mg.icon)), s.x, s.y).setDepth(-999_990);
      const pulse = this.tweens.add({
        targets: padImg,
        scaleY: padImg.scaleY * 1.08,
        duration: 700,
        yoyo: true,
        repeat: -1,
      });
      this.pads.set(id, { img: padImg, pulse, baseScaleY: padImg.scaleY });
    }
    this.refreshPads();
    for (const j of Object.values(JOBS))
      if (this.hasMarker(j.board))
        this.spots.push({ id: j.board, kind: 'board', pos: this.marker(j.board) });
    if (this.hasMarker('job-center')) {
      const at = this.marker('job-center');
      this.spots.push({ id: 'job-center', kind: 'jobs', pos: at });
      const s = gridToScreen(at.x, at.y);
      addBakedImage(this, getBaked(padKey('uniforms')), s.x, s.y).setDepth(-999_990);
    }
    if (this.hasMarker('shop'))
      this.spots.push({ id: 'shop', kind: 'shop', pos: this.marker('shop') });

    // Go-to marker.
    this.target = this.add
      .image(0, 0, UI.target)
      .setScale(1 / WT)
      .setDepth(-999_980)
      .setVisible(false);

    // Player.
    const s = gridToScreen(this.player.pos.x, this.player.pos.y);
    this.playerImg = this.add
      .image(s.x, s.y, characterFrameKey(this.playerLook(), this.player.facing, 0))
      .setOrigin(0.5, CHAR_FOOT_Y / CHAR_H)
      .setScale(1 / WT);

    // Police car (and bike, once bought), parked by the station.
    const carAt = this.marker('police-car');
    this.car = new Vehicle(this, this.carGraph, POLICE_CAR, this.carGraph.get(carAt.x, carAt.y)!, {
      x: 1,
      y: 0,
    });
    this.car.img.setName('police-car');
    if (this.state.owns('police-bike')) this.spawnBike(false);
    if (this.state.owns('own-car')) this.spawnOwnCar(false);
    this.stationImgs = [];
    for (const [job, color] of [
      ['cop', PALETTE.policeBlue],
      ['fire', PALETTE.fireRed],
      ['builder', PALETTE.builderYellow],
    ] as const) {
      const id = `station-${job}`;
      if (!this.hasMarker(id)) continue;
      const at = this.marker(id);
      this.spots.push({ id, kind: 'station', pos: at });
      const s = gridToScreen(at.x, at.y);
      const img = addBakedImage(this, getBaked(padKey('uniforms')), s.x, s.y)
        .setDepth(-999_989)
        .setTint(color);
      this.tweens.add({
        targets: img,
        alpha: { from: 1, to: 0.55 },
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
      this.stationImgs.push(img);
    }
    this.updateStations();
    if (this.hasMarker('home-door')) {
      const at = this.marker('home-door');
      this.spots.push({ id: 'home-door', kind: 'home', pos: at });
      const s = gridToScreen(at.x, at.y);
      addBakedImage(this, getBaked(padKey('home')), s.x, s.y).setDepth(-999_990);
    }
    if (this.hasMarker('mixer-truck')) {
      const node = this.nodeNear(this.carGraph, this.marker('mixer-truck'));
      this.mixer = new Vehicle(this, this.carGraph, MIXER_TRUCK, node, { x: 0, y: 1 });
      this.mixer.img.setName('mixer-truck');
    }
    if (this.hasMarker('fire-truck')) {
      const node = this.nodeNear(this.carGraph, this.marker('fire-truck'));
      this.fireTruck = new Vehicle(this, this.carGraph, FIRE_TRUCK, node, { x: 0, y: 1 });
      this.fireTruck.img.setName('fire-truck');
    }

    // Town traffic.
    for (let i = 1; i <= 6; i++) {
      const id = `traffic-${i}`;
      if (!this.hasMarker(id)) continue;
      const node = this.nodeNear(this.carGraph, this.marker(id));
      const next = this.carGraph.node(node.links[0]!);
      this.traffic.push(
        new TrafficCar(this, this.carGraph, TRAFFIC_CARS[(i - 1) % TRAFFIC_CARS.length]!, node, {
          x: Math.sign(next.x - node.x),
          y: Math.sign(next.y - node.y),
        }),
      );
    }

    // Townspeople (bubble pictures for missions and errands) and strollers.
    for (const [id, look] of Object.entries(TOWNSPEOPLE)) {
      if (!this.hasMarker(id)) continue;
      const m = this.marker(id);
      this.people.set(id, new Townsperson(this, id, look, m, getBaked(bubbleKey('star'))));
    }
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

    this.director = new MissionDirector(this);

    this.wireInput();
    this.game.events.on(EV.minigameComplete, this.onMinigameComplete, this);
    this.game.events.on(EV.menuClosed, this.onMenuClosed, this);
    this.game.events.on(EV.interiorDone, this.onInteriorDone, this);
    this.game.events.on(EV.parade, this.parade, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(EV.minigameComplete, this.onMinigameComplete, this);
      this.game.events.off(EV.menuClosed, this.onMenuClosed, this);
      this.game.events.off(EV.interiorDone, this.onInteriorDone, this);
      this.game.events.off(EV.parade, this.parade, this);
      this.scene.stop('Hud');
    });
    this.scene.launch('Hud');

    this.time.delayedCall(800, () => {
      if (!this.director.busy && this.state.nextMission()?.id === 'first-day') voice.say('welcome');
    });
  }

  private playerLook(): string {
    const look = lookFor(this.state.job, this.state.progress.owned, this.state.progress.hat);
    ensureLook(this, look);
    return look;
  }

  /** Your own car appears by the apartment once bought (spec 006). */
  spawnOwnCar(puff: boolean): void {
    if (this.ownCar || !this.hasMarker('own-car')) return;
    const node = this.nodeNear(this.carGraph, this.marker('own-car'));
    const look =
      OWN_CARS.find((l) => l.name === ownCarName(this.state.progress.paint)) ?? OWN_CARS[0]!;
    this.ownCar = new Vehicle(this, this.carGraph, look, node, { x: 0, y: 1 });
    this.ownCar.img.setName('own-car');
    if (puff) {
      this.puff(this.ownCar.pos);
      sfx.play('sparkle');
    }
  }

  /** After the Shop or the apartment: new hat, new paint, new things. */
  private refreshLooks(): void {
    this.playerImg.setTexture(characterFrameKey(this.playerLook(), this.player.facing, 0));
    if (this.ownCar) {
      const look = OWN_CARS.find((l) => l.name === ownCarName(this.state.progress.paint));
      if (look) this.ownCar.setLook(look);
    }
  }

  /** Put on another uniform (Job Center closed with a job): spin, sparkle, new boss. */
  private applyJob(): void {
    if (this.mode === 'car') this.exitCar();
    if (this.director.run && this.director.run.mission.job !== this.state.job)
      this.director.abort();
    const look = this.playerLook();
    this.playerImg.setTexture(characterFrameKey(look, this.player.facing, 0));
    this.tweens.add({
      targets: this.playerImg,
      angle: 360,
      duration: 600,
      onComplete: () => this.playerImg.setAngle(0),
    });
    this.sparkleAt(this.player.pos);
    sfx.play('sparkle');
    voice.say(`job-${this.state.job}`, { interrupt: true });
    this.refreshPads();
  }

  /** Whether a minigame belongs to the uniform you're wearing (playtest 2026-11-11). */
  private minigameForJob(id: string): boolean {
    const def = this.state.content.minigames.find((m) => m.id === id);
    return !def || def.job === this.state.job;
  }

  /** Pads for your job pulse; the others are faded and still. */
  private refreshPads(): void {
    this.padRefused.clear();
    for (const [id, p] of this.pads) {
      const mine = this.minigameForJob(id);
      p.img.setAlpha(mine ? 1 : 0.35);
      if (mine) p.pulse.resume();
      else {
        p.pulse.pause();
        p.img.setScale(p.img.scaleX, p.baseScaleY);
      }
    }
  }

  /** The police bike appears next to the car (just bought: with a puff). */
  spawnBike(puff: boolean): void {
    if (this.bike) return;
    const at = this.marker('police-bike');
    const node = this.nodeNear(this.bikeGraph, at);
    this.bike = new Vehicle(
      this,
      this.bikeGraph,
      POLICE_BIKE,
      node,
      { x: 1, y: 0 },
      BIKE_MAX_SPEED,
      BIKE_ACCEL,
    );
    this.bike.img.setName('police-bike');
    if (puff) {
      this.puff(this.bike.pos);
      sfx.play('sparkle');
    }
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
      kb.on('keydown-J', () => {
        if (this.state.progress.badges.length >= 3 && this.mode === 'foot') {
          voice.say('job-key');
          this.openMenu('JobCenter');
        }
      });
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
    // A paused scene never hears the keyup for a key held while a minigame/menu opened, so that
    // key would stay "down" afterwards and walk the player on their own (playtest 2026-11-11).
    // Let go of everything on the way out and on the way back.
    for (const ev of [Phaser.Scenes.Events.PAUSE, Phaser.Scenes.Events.RESUME]) {
      this.events.on(ev, () => {
        this.input2.reset();
        uiDown.clear();
      });
    }
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
  // Player on foot / driving
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

  private distTo(v: Vehicle): number {
    return Math.hypot(this.player.pos.x - v.pos.x, this.player.pos.y - v.pos.y);
  }

  /** The closest vehicle the player can hop into right now. */
  private nearestVehicle(): VehicleId | null {
    let best: VehicleId | null = null;
    let bestD = ENTER_CAR_DIST;
    for (const id of JOB_VEHICLES[this.state.job] ?? []) {
      const v = this.vehicle(id);
      if (!v) continue;
      const d = this.distTo(v);
      if (d <= bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  /** Hop in (the police car by default). */
  enterCar(id: VehicleId = 'police-car'): void {
    if (this.mode === 'car') return;
    const v = this.vehicle(id);
    if (!v) return;
    this.mode = 'car';
    this.ridingId = id;
    this.autoEnter = null;
    this.player.cancelPath();
    this.target.setVisible(false);
    sfx.play('pop');
    if (id === 'police-bike') v.setLook(POLICE_BIKE_RIDDEN);
    this.tweens.add({
      targets: this.playerImg,
      scale: 0,
      duration: 160,
      onComplete: () => this.playerImg.setVisible(false).setScale(1 / WT),
    });
    this.tweens.add({ targets: v, hop: 10, duration: 120, yoyo: true });
    this.cameras.main.startFollow(v.img, false, CAMERA_LERP, CAMERA_LERP);
    this.notifyMission({ type: 'reached', target: id });
  }

  exitCar(): void {
    const r = this.riding();
    if (!r) return;
    const v = r.vehicle;
    this.mode = 'foot';
    this.ridingId = null;
    v.driver.speed = 0;
    v.driver.cancelPath();
    if (v === this.bike) v.setLook(POLICE_BIKE);
    // Hop out onto the nearest sidewalk/grass tile.
    const c = v.pos;
    let best: Vec2 = { ...c };
    let bestD = Infinity;
    for (let y = Math.floor(c.y) - 3; y <= Math.floor(c.y) + 3; y++) {
      for (let x = Math.floor(c.x) - 3; x <= Math.floor(c.x) + 3; x++) {
        if (!this.grid.isWalkable(x, y)) continue;
        const k = tileAt(this.map, x, y);
        if (k === 'road' || k === 'path') continue;
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

  // ---------------------------------------------------------------------------------------------
  // Missions, errands, minigames, menus
  // ---------------------------------------------------------------------------------------------

  notifyMission(e: MissionEvent): void {
    this.director.notify(e);
  }

  private updateErrands(): void {
    const f = this.focus();
    const book = this.state.errands;
    const inv = this.state.inventory;
    const showing = new Map<string, IconName>();
    for (const e of book.all) {
      if (book.statusOf(e.id) !== 'offered') continue;
      // Find errands: the lost thing lies at its spot.
      if (e.kind === 'find' && e.spot && !this.findSpawned.has(e.id) && this.hasMarker(e.spot)) {
        this.findSpawned.add(e.id);
        this.dropPickup(e.item, this.marker(e.spot));
      }
      const carrying = (inv[e.item] ?? 0) > 0;
      const receiver = book.receiver(e.id);
      const giver = this.people.get(e.giver);
      // Deliver: the giver hands the item over when you come by.
      if (e.kind === 'deliver' && !carrying && giver) {
        showing.set(e.giver, e.icon as IconName);
        if (Math.hypot(f.x - giver.pos.x, f.y - giver.pos.y) < 2.2) {
          this.state.pickUp(e.item);
          sfx.play('pop', 1.2);
          voice.say('got-it', { interrupt: true });
          giver.cheer();
        }
        continue;
      }
      const who = this.people.get(receiver);
      if (!who) continue;
      showing.set(receiver, e.icon as IconName);
      const d = Math.hypot(f.x - who.pos.x, f.y - who.pos.y);
      if (d < 2.2 && carrying) {
        const reward = this.state.completeErrand(e.id);
        if (reward !== null) {
          who.cheer();
          sfx.coin();
          voice.say('errand-done', { interrupt: true });
          this.notifyMission({ type: 'errandDone', id: e.id });
        }
      } else if (d < 4 && !this.errandAsked.has(e.id)) {
        this.errandAsked.add(e.id);
        voice.say(e.voice ?? ERRAND_LINES[e.id] ?? 'hint-errand');
      }
    }
    // Errand bubbles (the chief's own bubble is the director's).
    for (const [id, p] of this.people) {
      if (id === this.director.bossId() && (this.director.offer() || !showing.has(id))) continue;
      if (id === 'mayor' && this.director.finale()) continue;
      const icon = showing.get(id);
      if (icon) {
        p.setBubble(getBaked(bubbleKey(icon)));
        p.setOffering(true);
      } else p.setOffering(false);
    }
  }

  /** Stand on a pad: play a minigame, open the board, or the shop. */
  private updateSpots(): void {
    if (this.mode !== 'foot') return;
    let on: (typeof this.spots)[number] | null = null;
    for (const s of this.spots) {
      if (Math.hypot(this.player.pos.x - s.pos.x, this.player.pos.y - s.pos.y) < 0.6) on = s;
    }
    if (on && this.onSpot !== on.id) {
      this.onSpot = on.id;
      if (on.kind === 'minigame') {
        if (this.minigameForJob(on.id)) this.startMinigame(on.id);
        else if (!this.padRefused.has(on.id)) {
          // Another job's game: say so once, don't start it.
          this.padRefused.add(on.id);
          voice.say('pad-other-job', { interrupt: true });
        }
      } else if (on.kind === 'board') this.openMenu('MissionBoard');
      else if (on.kind === 'jobs') this.openMenu('JobCenter');
      else if (on.kind === 'home') this.openMenu('Apartment');
      else if (on.kind === 'station') {
        if (this.stationsOpen()) {
          const job = on.id.slice('station-'.length) as 'cop' | 'fire' | 'builder';
          if (job !== this.state.job) {
            this.forceJob(job);
            voice.say('station', { interrupt: true });
          }
        }
      } else this.openMenu('Shop');
    } else if (!on) {
      // Step well off before it can trigger again.
      const cur = this.spots.find((s) => s.id === this.onSpot);
      if (!cur || Math.hypot(this.player.pos.x - cur.pos.x, this.player.pos.y - cur.pos.y) > 1.0)
        this.onSpot = null;
    }
  }

  private pauseForOverlay(): void {
    this.input2.reset();
    this.player.cancelPath();
    this.scene.pause();
    this.scene.sleep('Hud');
  }

  startMinigame(id = 'traffic-helper'): void {
    const mg = MINIGAMES[id];
    if (!mg) return;
    this.onSpot = id;
    this.pauseForOverlay();
    this.scene.launch(mg.scene, { id, plays: this.state.plays(id) });
  }

  openMenu(key: 'MissionBoard' | 'Shop' | 'JobCenter' | 'Apartment'): void {
    if (!this.scene.isActive()) return;
    this.pauseForOverlay();
    this.scene.launch(key);
  }

  private onMinigameComplete(r: MinigameResult): void {
    // Coins were already paid by GameState.finishMinigame; the HUD shows them.
    this.notifyMission({ type: 'minigameDone', id: r.id });
  }

  private onMenuClosed(r: {
    replay?: string;
    bought?: string;
    job?: string;
    changed?: string;
  }): void {
    if (r.job) this.time.delayedCall(150, () => this.applyJob());
    if (r.changed) this.refreshLooks();
    if (r.bought === 'own-car') this.time.delayedCall(300, () => this.spawnOwnCar(true));
    if (r.bought === 'police-bike') this.time.delayedCall(300, () => this.spawnBike(true));
    // The job upgrade was the objective: say so, and the arrow now points at the boss.
    const item = this.state.content.shop.find((i) => i.id === r.bought);
    if (item?.tab === 'job' && item.job === this.state.job && this.director.offer())
      this.time.delayedCall(900, () => voice.say('upgrade-bought', { interrupt: true }));
    if (r.replay) {
      const id = r.replay;
      this.time.delayedCall(300, () => this.director.begin(id));
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Net launcher and siren
  // ---------------------------------------------------------------------------------------------

  aimNet(): string | null {
    const r = this.riding();
    if (!r || this.netCooldown > 0) return null;
    const a = r.vehicle.driver.headingAngle;
    const fleeing = this.robbers
      .filter((x) => x.phase === 'fleeing')
      .map((x) => ({ id: x.name, pos: x.pos }));
    if (fleeing.length === 0) return null;
    return netTarget(r.vehicle.pos, { x: Math.cos(a), y: Math.sin(a) }, fleeing);
  }

  fireNet(target: string): void {
    const r = this.riding()!;
    const shot = new NetShot(r.vehicle.pos, target);
    const s = gridToScreen(shot.pos.x, shot.pos.y);
    const img = addBakedImage(this, getBaked(MPROP.net), s.x, s.y - 20).setDepth(
      depthOf(shot.pos.x, shot.pos.y) + 90,
    );
    this.tweens.add({ targets: img, angle: 360, duration: 500, repeat: -1 });
    this.nets.push({ shot, img });
    this.netCooldown = 0.6;
    sfx.play('whoosh');
  }

  private updateNets(dt: number): void {
    if (this.netCooldown > 0) this.netCooldown -= dt;
    for (const n of this.nets) {
      const robber = this.robbers.find((x) => x.name === n.shot.target && x.phase === 'fleeing');
      const st = n.shot.step(dt, robber ? robber.pos : null);
      const s = gridToScreen(n.shot.pos.x, n.shot.pos.y);
      n.img.setPosition(s.x, s.y - 20).setDepth(depthOf(n.shot.pos.x, n.shot.pos.y) + 90);
      if (st === 'hit') {
        robber?.netted();
        n.img.destroy();
      } else if (st === 'missed') {
        voice.say('net-miss', { minGapMs: 4000 });
        this.tweens.killTweensOf(n.img);
        this.tweens.add({
          targets: n.img,
          alpha: 0,
          duration: 250,
          onComplete: () => n.img.destroy(),
        });
      }
    }
    this.nets = this.nets.filter((n) => n.shot.state === 'flying');
  }

  /** The fire the hose would spray right now (fire job only), or null. */
  aimHose(): string | null {
    if (this.state.job !== 'fire' || this.fires.size === 0) return null;
    const r = this.riding();
    const mode = r ? (r.id === 'fire-truck' ? 'truck' : null) : 'foot';
    if (!mode) return null;
    const from = this.focus();
    const ladder = this.state.owns('long-ladder') ? 'long' : 'standard';
    const spots = [...this.fires.values()].filter((f) => !f.state.out).map((f) => f.spot);
    const aim = pickFire(from, mode, ladder, spots);
    if (!aim && mode === 'truck' && tooHigh(from, mode, ladder, spots))
      voice.say('too-high', { minGapMs: 8000 });
    return aim;
  }

  /** One press of the hose: a burst of water at the aimed fire. */
  spray(id: string): void {
    const f = this.fires.get(id);
    if (!f || f.state.out) return;
    f.state.startBurst();
    this.spraying = { id, left: FIRE.burstSec };
    sfx.play('splash');
  }

  private updateFires(dt: number): void {
    if (this.spraying) {
      this.spraying.left -= dt;
      const f = this.fires.get(this.spraying.id);
      // Droplets from the nozzle to the fire.
      this.dropT += dt;
      if (f && this.dropT > 0.05) {
        this.dropT = 0;
        const from = gridToScreen(this.focus().x, this.focus().y);
        from.y -= this.riding() ? 30 : 34;
        const to = f.screen;
        const img = addBakedImage(this, getBaked(MPROP.drop), from.x, from.y).setDepth(
          f.img.depth + 1,
        );
        this.tweens.add({
          targets: img,
          x: to.x + (Math.random() - 0.5) * 12,
          y: to.y - 10,
          duration: 260,
          onComplete: () => img.destroy(),
        });
      }
      if (this.spraying.left <= 0) this.spraying = null;
    }
    for (const [id, f] of this.fires) {
      const sprayed = this.spraying?.id === id;
      if (f.update(dt, sprayed)) {
        sfx.play('pop', 0.7);
        this.puff({ x: f.spot.x, y: f.spot.y });
        this.notifyMission({ type: 'sprayed', fire: id });
      }
    }
    for (const [id, f] of this.fires) if (f.state.out) this.fires.delete(id);
  }

  private siren(): void {
    this.sirenPresses++;
    const r = this.riding();
    if (r?.id === 'mixer-truck' || r?.id === 'own-car') {
      sfx.play('horn');
      sfx.play('honk', 0.9);
    } else if (r) {
      sfx.sirenBlast();
      r.vehicle.flash(2.5);
    } else {
      sfx.play('whistle');
    }
    const at = this.focus();
    let stopped = false;
    for (const t of this.traffic) {
      const was = t.stoppedForSiren;
      t.hearSiren(at);
      if (!was && t.stoppedForSiren) stopped = true;
    }
    if (stopped) voice.say('traffic-stop', { minGapMs: 5000 });
    this.director.onSiren();
  }

  // ---------------------------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------------------------

  update(time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;
    const focusWorld = gridToScreen(this.focus().x, this.focus().y);
    const pointers = this.input.manager.pointers;
    this.input2.dropReleased((id) => pointers.some((p) => p.id === id && p.isDown));
    const a = this.input2.update(time, focusWorld);
    const moving = Math.hypot(a.move.x, a.move.y) > 0;
    const hadInput = moving || !!a.goTo || a.action || a.siren;

    if (a.siren) this.siren();
    this.netAim = this.state.job === 'cop' ? this.aimNet() : null;
    this.hoseAim = this.aimHose();
    if (this.blastCooldown > 0) this.blastCooldown -= Math.min(deltaMs, 50) / 1000;
    this.blastAim = this.aimBlast();
    if (this.mode === 'foot') this.updateOnFoot(dt, a);
    else this.updateDriving(dt, a);

    const r = this.riding();
    for (const robber of this.robbers) robber.update(dt, this.focus(), r?.vehicle ?? null);
    if (this.mode === 'foot' || this.ridingId !== 'police-car')
      this.car.update(dt, { stick: null });
    if (this.bike && (this.mode === 'foot' || this.ridingId !== 'police-bike'))
      this.bike.update(dt, { stick: null });
    if (this.mixer && (this.mode === 'foot' || this.ridingId !== 'mixer-truck'))
      this.mixer.update(dt, { stick: null });
    if (this.ownCar && (this.mode === 'foot' || this.ridingId !== 'own-car'))
      this.ownCar.update(dt, { stick: null });
    if (this.fireTruck && (this.mode === 'foot' || this.ridingId !== 'fire-truck'))
      this.fireTruck.update(dt, { stick: null });
    this.updateNets(dt);
    this.updateFires(dt);
    this.updateTraffic(dt);

    // Vehicles knock over cones and cans (pays nothing).
    const vehicles = this.allVehicles();
    for (const v of vehicles) {
      if (Math.abs(v.driver.speed) < 0.3) continue;
      for (const b of this.bumpables) {
        if (Math.hypot(v.pos.x - b.home.x, v.pos.y - b.home.y) < 0.55 && b.bump(v.pos)) {
          sfx.play('bump', 1.2, 0.7);
        }
      }
    }

    // Pickups.
    const f = this.focus();
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
    const movingVehicles = vehicles.filter((v) => Math.abs(v.driver.speed) > 0.5).map((v) => v.pos);
    for (const w of this.walkers) {
      if (w.update(dt, movingVehicles)) voice.say('whoa', { minGapMs: 5000 });
    }

    this.director.update(dt);
    this.updateStations();
    this.updateParade(dt);
    this.updateErrands();
    this.updateSpots();

    // Idle hints.
    if (this.hints.update(dt, hadInput)) {
      const h = this.hintTarget();
      if (h) voice.say(h.line);
    }

    this.updateDepths();
    this.publishHud();
  }

  private allVehicles(): Vehicle[] {
    const out: Vehicle[] = [this.car];
    if (this.bike) out.push(this.bike);
    if (this.fireTruck) out.push(this.fireTruck);
    if (this.mixer) out.push(this.mixer);
    if (this.ownCar) out.push(this.ownCar);
    for (const r of this.robbers) out.push(r.car);
    for (const t of this.traffic) out.push(t.vehicle);
    return out;
  }

  private updateTraffic(dt: number): void {
    if (this.traffic.length === 0) return;
    const extra: Vec2[] = [];
    for (const pts of this.obstacles.values()) extra.push(...pts);
    if (this.mode === 'foot') extra.push(this.player.pos);
    for (const w of this.walkers) extra.push(w.pos);
    const others = this.allVehicles();
    const r = this.riding();
    for (const t of this.traffic) {
      const obs = extra.concat(others.filter((v) => v !== t.vehicle).map((v) => v.pos));
      t.update(dt, obs);
      // Boing: bumping a town car stops you (and it hops), nothing else.
      if (
        r &&
        Math.abs(r.vehicle.driver.speed) > 1 &&
        Math.hypot(r.vehicle.pos.x - t.pos.x, r.vehicle.pos.y - t.pos.y) < BUMP_DIST
      ) {
        r.vehicle.driver.speed = 0;
        sfx.play('boing', 1.2, 0.6);
        this.tweens.add({ targets: t.vehicle, hop: 14, duration: 140, yoyo: true });
      }
    }
  }

  private updateOnFoot(dt: number, a: ReturnType<InputMapper['update']>): void {
    if (a.goTo) {
      const world = this.input2.lastGoToWorld;
      const tapped = world
        ? (JOB_VEHICLES[this.state.job] ?? []).find((id) => {
            const v = this.vehicle(id);
            return v && this.opaqueAt(v.img, world.x, world.y);
          })
        : undefined;
      if (tapped) {
        // Tapped a vehicle: walk over and hop in.
        const v = this.vehicle(tapped)!;
        if (this.distTo(v) <= ENTER_CAR_DIST) this.enterCar(tapped);
        else {
          this.goTo(Math.floor(v.pos.x), Math.floor(v.pos.y));
          this.autoEnter = tapped;
        }
      } else {
        this.autoEnter = null;
        let hit = world ? this.buildingAt(world) : null;
        if (hit && hit.def.h < 1 && this.grid.isWalkable(a.goTo.gx, a.goTo.gy)) hit = null;
        this.goTo(a.goTo.gx, a.goTo.gy, hit);
      }
    }
    if (a.action) {
      const near = this.nearestVehicle();
      if (this.hoseAim) this.spray(this.hoseAim);
      else if (this.blastAim) this.blast(this.blastAim);
      else if (near) this.enterCar(near);
    }
    if (this.mode !== 'foot') return;

    if (Math.hypot(a.move.x, a.move.y) > 0) this.autoEnter = null;
    this.player.update(dt, a.move);
    if (!this.player.following) this.target.setVisible(false);
    if (this.autoEnter) {
      const v = this.vehicle(this.autoEnter);
      if (v && this.distTo(v) <= ENTER_CAR_DIST) {
        this.enterCar(this.autoEnter);
        return;
      }
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
    this.playerImg.setTexture(
      characterFrameKey(this.playerLook(), this.player.facing, this.bobFrame),
    );
  }

  private updateDriving(dt: number, a: ReturnType<InputMapper['update']>): void {
    const r = this.riding();
    if (!r) return;
    const v = r.vehicle;
    if (a.action) {
      if (this.netAim) this.fireNet(this.netAim);
      else if (this.hoseAim) this.spray(this.hoseAim);
      else if (this.blastAim) this.blast(this.blastAim);
      else if (Math.abs(v.driver.speed) < 1.5) {
        this.exitCar();
        return;
      }
    }
    if (a.goTo) {
      const world = this.input2.lastGoToWorld;
      if (world && this.opaqueAt(v.img, world.x, world.y)) {
        sfx.play('horn');
      } else if (world) {
        const g = screenToGrid(world.x, world.y);
        if (v.driver.goToward(g)) {
          const end = v.driver.graph.node(v.driver.path.at(-1) ?? v.driver.to.id);
          this.showTarget(gridToScreen(end.x, end.y));
        }
      }
    }
    // Road assist steers by screen direction (ADR-004).
    const stick = Math.hypot(a.move.x, a.move.y) > 0 ? a.move : null;
    v.update(dt, { stick });
    if (v.driver.path.length === 0 && v.driver.speed === 0) this.target.setVisible(false);
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
    const r = this.riding();
    if (r) hiding = this.sortMover(r.vehicle.img, r.vehicle.pos, 0.4, CAR_SAMPLES);
    else hiding = this.sortMover(this.playerImg, this.player.pos, this.player.radius, CHAR_SAMPLES);
    for (const v of this.allVehicles()) {
      if (v === r?.vehicle) continue;
      this.sortMover(v.img, v.pos, 0.4, null);
    }
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
    const h = this.director.hint();
    if (h) return h;
    // Errands: someone with a bubble you can help.
    const book = this.state.errands;
    for (const e of book.all) {
      if (book.statusOf(e.id) !== 'offered') continue;
      const carrying = (this.state.inventory[e.item] ?? 0) > 0;
      const who = carrying || e.kind !== 'deliver' ? book.receiver(e.id) : e.giver;
      if (e.kind === 'return' && !carrying) continue;
      const p = this.people.get(who);
      if (p) return { at: p.pos, line: 'hint-errand' };
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
    const r = this.riding();
    const info: HudInfo = {
      mode: this.mode,
      action: this.blastAim
        ? 'blast'
        : this.hoseAim
          ? 'hose'
          : r
            ? this.netAim
              ? 'net'
              : 'exit'
            : this.nearestVehicle()
              ? 'enter'
              : 'none',
      donuts: this.state.inventory.donut ?? 0,
      sirenOn: r?.vehicle.flashing ?? false,
      hint,
    };
    this.registry.set(HUD_INFO_KEY, info);
  }

  /** The first robber on the map (spec 002 tests and the debug hook). */
  get robber(): RobberChase | undefined {
    return this.robbers[0];
  }

  /** Snapshot for tests / debugging. */
  debugState() {
    const run = this.director.run;
    const rb = this.robbers[0];
    const riding = this.riding();
    return {
      gx: this.player.pos.x,
      gy: this.player.pos.y,
      facing: this.player.facing,
      following: this.player.following,
      playerDepth: this.playerImg.depth,
      faded: this.props.filter((p) => p.faded).map((p) => p.def.id),
      screen: gridToScreen(this.player.pos.x, this.player.pos.y),
      mode: this.mode,
      riding: this.ridingId,
      job: this.state.job,
      fires: [...this.fires.keys()],
      hoseAim: this.hoseAim,
      blastAim: this.blastAim,
      sites: Object.fromEntries(
        [...this.sites.values()].map((x) => [
          x.id,
          { active: x.active, added: x.state.added, needed: x.state.needed, built: x.built },
        ]),
      ),
      mixer: this.mixer ? { ...this.mixer.pos } : null,
      truck: this.fireTruck ? { ...this.fireTruck.pos, speed: this.fireTruck.driver.speed } : null,
      car: { ...this.car.pos, speed: this.car.driver.speed, flashing: this.car.flashing },
      bike: this.bike ? { ...this.bike.pos, speed: this.bike.driver.speed } : null,
      sirenPresses: this.sirenPresses,
      coins: this.state.economy.coins,
      donuts: this.state.inventory.donut ?? 0,
      inventory: { ...this.state.inventory },
      badges: [...this.state.progress.badges],
      owned: [...this.state.progress.owned],
      stars: { ...this.state.progress.missionsDone },
      mission: run
        ? {
            id: run.mission.id,
            goal: run.goal?.type ?? 'done',
            goalIndex: run.goalIndex,
            waiting: false,
          }
        : null,
      offer: this.director.offer()?.id ?? null,
      chase: rb
        ? {
            phase: rb.phase,
            bumps: rb.chase.bumps,
            misses: rb.chase.misses,
            outOfGas: rb.chase.outOfGas,
            dropped: rb.chase.dropped,
            x: rb.pos.x,
            y: rb.pos.y,
          }
        : { phase: 'none', bumps: 0, misses: 0, outOfGas: false, dropped: 0, x: 0, y: 0 },
      robbers: this.robbers.map((x) => ({ name: x.name, phase: x.phase, x: x.pos.x, y: x.pos.y })),
      tower: [...this.tower.inmates],
      netAim: this.netAim,
      nets: this.nets.length,
      traffic: this.traffic.map((t) => ({ x: t.pos.x, y: t.pos.y, waiting: t.stoppedForSiren })),
      errand: this.state.errands.statusOf('return-donuts'),
      errands: Object.fromEntries(
        this.state.errands.all.map((e) => [e.id, this.state.errands.statusOf(e.id)]),
      ),
      pickups: this.pickups.length,
      bumpables: this.bumpables.map((b) => ({ id: b.id, tumbling: b.tumbling, bumps: b.bumps })),
      hintShowing: this.hints.showing,
      riddenSpeed: riding?.vehicle.driver.speed ?? 0,
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

export type { BakedMeta };
