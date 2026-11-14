import type Phaser from 'phaser';
import { GAME_W } from './config';
import { gridToScreen } from './iso/projection';
import { sfx } from './audio/sfx';
import { voice } from './audio/voice';
import type { CityScene } from './scenes/CityScene';
import type { ApartmentScene } from './scenes/ApartmentScene';
import type { InteriorScene } from './scenes/InteriorScene';
import type { JobCenterScene } from './scenes/JobCenterScene';
import type { MissionBoardScene } from './scenes/MissionBoardScene';
import type { ShopScene } from './scenes/ShopScene';
import type { TrafficHelperScene } from './scenes/TrafficHelperScene';
import type { WhoTookItScene } from './scenes/WhoTookItScene';
import type { VehicleId } from './missions/world';
import type { BuildItScene } from './scenes/BuildItScene';
import { closeMenu as closeMenuScene, type MinigameScene } from './scenes/minigameKit';
import { Boat } from './entities/Boat';
import { SAVE_KEY } from './systems/save';

/** `window.__jbc`: test/debug hook. Only installed in dev builds or when VITE_DEBUG_HOOK=1. */
export interface DebugHook {
  game: Phaser.Game;
  /** Keys of scenes that are currently running. */
  scenes(): string[];
  /** Player state, or null when the city isn't running. */
  player(): ReturnType<CityScene['debugState']> | null;
  /** Whether the touch joystick is showing, and where (logical px). */
  joystick(): { active: boolean; x: number; y: number } | null;
  /** Override movement with a screen-relative vector. */
  setMove(x: number, y: number): void;
  clearMove(): void;
  /** Walk to a tile via pathfinding. Returns false if unreachable. */
  goTo(gx: number, gy: number): boolean;
  /** Teleport the player (tests only). */
  teleport(gx: number, gy: number): void;
  /** Page (client) coordinates of a tile centre, for synthetic clicks/taps. */
  tileToClient(gx: number, gy: number): { x: number; y: number } | null;
  /** Page coordinates of a world grid point lifted `up` logical px (e.g. a sprite's middle). */
  gridToClient(gx: number, gy: number, up?: number): { x: number; y: number } | null;
  /** Page coordinates of a logical screen point (0..1280, 0..720). */
  logicalToClient(x: number, y: number): { x: number; y: number };
  fps(): number;
  renderScale(): number;
  /** Hop into the police car (teleports next to it first). */
  enterCar(): void;
  exitCar(): void;
  /** Put the police car right behind the getaway car (tests the bump/catch flow quickly). */
  chaseUp(): void;
  /** Launch a minigame now / finish whichever minigame is running with a score. */
  startMinigame(id?: string): void;
  finishMinigame(score: number): boolean;
  /** Start a mission right away (as if the chief or the board offered it). */
  startMission(id: string): void;
  /** Set up progress for a test: coins (paid as minigame coins), badges, owned items, stars. */
  grant(p: { coins?: number; badges?: string[]; owned?: string[]; done?: string[] }): void;
  /** Hop into a vehicle (teleports next to it first). */
  ride(id: VehicleId): void;
  /** Put the vehicle being driven on the road next to a map marker (or a perch, e.g. a fire). */
  driveTo(marker: string): void;
  /** Teleport the player onto a marker (on foot). */
  walkTo(marker: string): void;
  /** Fire the net (as if Action was pressed). Returns the aimed target or null. */
  fireNet(): string | null;
  /** Who Took It?: the culprit index, and tap a suspect. */
  culprit(): number;
  tapSuspect(i: number): void;
  /** Open menus and use them. */
  openMenu(key: 'MissionBoard' | 'Shop' | 'JobCenter' | 'Apartment'): void;
  /** Start the finale parade now. */
  parade(): void;
  /** Shop: tap a card (buy, or wear/apply when owned). */
  shopTap(id: string): void;
  /** Apartment: put an item on a square / back in the tray; wear a hat. */
  placeItem(item: string, gx: number, gy: number): boolean;
  removeItem(item: string): void;
  toggleHat(hat: string): void;
  /** Job Center: tap a uniform. */
  pickJob(job: 'cop' | 'fire' | 'builder'): boolean;
  /** Press the hose (as Action with a fire in reach). Returns the aimed fire or null. */
  hose(): string | null;
  /**
   * Press the block blaster (as Action with a build spot in reach): opens Build It!. Called again
   * while Build It! is open, it finishes it. Returns the spot or null.
   */
  blast(): string | null;
  /** Build It!: what it shows; finish it now (everything placed and fixed). */
  buildIt(): {
    site: string;
    fixed: number;
    total: number;
    pending: number;
    toolNeeded: string | null;
    busy: boolean;
  } | null;
  finishBuildIt(): boolean;
  /** Build It!: put the next piece in its slot; pick a tool; where to drag from and to. */
  buildPlace(): boolean;
  buildTool(tool: 'hammer' | 'trowel' | 'wrench'): void;
  buildDrag(): { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  /** The running minigame's round (hearts, level, top bar), or null. */
  round(): {
    id: string;
    score: number;
    hearts: number;
    maxHearts: number;
    level: number;
    failed: boolean;
    fails: number;
    bar: boolean;
  } | null;
  /** Lose a heart in the running minigame; retry after an Oops. */
  oops(): void;
  retry(): void;
  /** Traffic Helper: the light and the crossing; switch the light. */
  traffic(): { red: boolean; crossing: number; waiting: number; scares: number } | null;
  toggleLight(): void;
  /** Kitchen: put every flame out, then leave. */
  interiorDone(): boolean;
  pickMission(id: string): void;
  buy(id: string): boolean;
  closeMenu(): void;
  /** Pretend the player has been idle for N seconds (hint system). */
  idle(seconds: number): void;
  voiceLog(): string[];
  sfxPlayed(): Record<string, number>;
  saved(): unknown;
}

declare global {
  interface Window {
    __jbc?: DebugHook;
  }
}

export function installDebugHook(game: Phaser.Game): void {
  const city = (): CityScene | null => {
    const s = game.scene.getScene('City') as CityScene | null;
    return s && s.scene.isActive() ? s : null;
  };
  const canvasScale = () => {
    const rect = game.canvas.getBoundingClientRect();
    return { rect, k: rect.width / game.canvas.width };
  };
  const MINIGAME_KEYS = [
    'TrafficHelper',
    'WhoTookIt',
    'WindowSplash',
    'LadderRescue',
    'BlockStack',
    'CopyBuild',
    'CementPour',
  ];
  /** The minigame scene that is running right now, if any. */
  const minigame = (): MinigameScene | null => {
    for (const key of MINIGAME_KEYS) {
      const s = game.scene.getScene(key) as MinigameScene | null;
      if (s && s.scene.isActive()) return s;
    }
    return null;
  };
  window.__jbc = {
    game,
    scenes: () => game.scene.getScenes(true).map((s) => s.scene.key),
    player: () => city()?.debugState() ?? null,
    joystick: () => {
      const j = city()?.input2.joystick;
      return j ? { active: j.active, x: j.knob.x, y: j.knob.y } : null;
    },
    setMove: (x, y) => {
      const c = city();
      if (c) c.input2.debugMove = { x, y };
    },
    clearMove: () => {
      const c = city();
      if (c) c.input2.debugMove = null;
    },
    goTo: (gx, gy) => city()?.goTo(gx, gy) ?? false,
    teleport: (gx, gy) => {
      const c = city();
      if (c) {
        c.player.cancelPath();
        c.player.pos = { x: gx, y: gy };
        // Snap the camera so screen positions are stable right away.
        const w = gridToScreen(gx, gy);
        c.cameras.main.centerOn(w.x, w.y);
      }
    },
    tileToClient: (gx, gy) => {
      const c = city();
      if (!c) return null;
      const cam = c.cameras.main;
      const w = gridToScreen(gx + 0.5, gy + 0.5);
      const sx = (w.x - cam.worldView.x) * cam.zoom;
      const sy = (w.y - cam.worldView.y) * cam.zoom;
      const { rect, k } = canvasScale();
      return { x: rect.left + sx * k, y: rect.top + sy * k };
    },
    gridToClient: (gx, gy, up = 0) => {
      const c = city();
      if (!c) return null;
      const cam = c.cameras.main;
      const w = gridToScreen(gx, gy);
      const sx = (w.x - cam.worldView.x) * cam.zoom;
      const sy = (w.y - up - cam.worldView.y) * cam.zoom;
      const { rect, k } = canvasScale();
      return { x: rect.left + sx * k, y: rect.top + sy * k };
    },
    logicalToClient: (x, y) => {
      const { rect } = canvasScale();
      const k = rect.width / GAME_W;
      return { x: rect.left + x * k, y: rect.top + y * k };
    },
    fps: () => game.loop.actualFps,
    renderScale: () => game.scale.width / GAME_W,
    enterCar: () => {
      const c = city();
      if (!c) return;
      c.player.pos = { x: c.car.pos.x, y: c.car.pos.y - 1.2 };
      c.enterCar();
    },
    exitCar: () => city()?.exitCar(),
    chaseUp: () => {
      const c = city();
      if (!c) return;
      // Pull the vehicle being driven up right behind the nearest fleeing robber.
      const ride = c.riding()?.vehicle;
      const v = ride && !(ride instanceof Boat) ? ride : c.car;
      const rb = c.robbers
        .filter((x) => x.phase === 'fleeing')
        .sort(
          (a, b) =>
            Math.hypot(a.pos.x - v.pos.x, a.pos.y - v.pos.y) -
            Math.hypot(b.pos.x - v.pos.x, b.pos.y - v.pos.y),
        )[0];
      if (!rb) return;
      const r = rb.car.driver;
      const from = v.driver.graph.get(r.from.x, r.from.y);
      const to = v.driver.graph.get(r.to.x, r.to.y);
      if (from && to) v.driver.placeOnEdge(from, to, Math.max(0, r.t - 0.4));
    },
    startMinigame: (id) => city()?.startMinigame(id),
    finishMinigame: (score) => {
      const s = minigame();
      if (!s) return false;
      s.debugFinish(score);
      return true;
    },
    startMission: (id) => city()?.director.begin(id),
    grant: (p) => {
      const c = city();
      if (!c) return;
      const st = c.state;
      if (p.coins) st.economy.award('minigame', p.coins);
      st.save.update((s) => {
        for (const b of p.badges ?? []) if (!s.badges.includes(b)) s.badges.push(b);
        for (const o of p.owned ?? []) if (!s.owned.includes(o)) s.owned.push(o);
        for (const d of p.done ?? []) s.missionsDone[d] = Math.max(1, s.missionsDone[d] ?? 0);
      });
      if (p.owned?.includes('police-bike')) c.spawnBike(false);
      for (const o of p.owned ?? []) if (o.startsWith('built:')) c.debugBuilt(o.slice(6));
      st.save.flush();
    },
    ride: (id) => {
      const c = city();
      const v = c?.vehicle(id);
      if (!c || !v) return;
      if (c.mode === 'car') c.exitCar();
      c.player.pos = { x: v.pos.x, y: v.pos.y - 1.2 };
      c.enterCar(id);
    },
    driveTo: (marker) => {
      const c = city();
      const v = c?.riding()?.vehicle;
      if (!c || !v) return;
      const m = c.hasMarker(marker) ? c.marker(marker) : c.perch(marker);
      if (v instanceof Boat) {
        // The boat goes straight there (to the nearest open water if the point is on land).
        v.moveTo(c.nearestWater(m));
        return;
      }
      let best = v.driver.from;
      let bestD = Infinity;
      for (const n of v.driver.graph.nodes.values()) {
        const d = (n.x - m.x) ** 2 + (n.y - m.y) ** 2;
        if (d < bestD && n.links.length > 0) {
          bestD = d;
          best = n;
        }
      }
      v.placeAt(best, { x: 1, y: 0 });
    },
    walkTo: (marker) => {
      const c = city();
      if (!c) return;
      if (c.mode === 'car') c.exitCar();
      const m = c.marker(marker);
      c.player.cancelPath();
      c.player.pos = { x: m.x, y: m.y };
      const w = gridToScreen(m.x, m.y);
      c.cameras.main.centerOn(w.x, w.y);
    },
    fireNet: () => {
      const c = city();
      if (!c) return null;
      const t = c.aimNet();
      if (t) c.fireNet(t);
      return t;
    },
    culprit: () => {
      const s = game.scene.getScene('WhoTookIt') as WhoTookItScene | null;
      return s && s.scene.isActive() ? s.debugCulprit() : -1;
    },
    tapSuspect: (i) => {
      const s = game.scene.getScene('WhoTookIt') as WhoTookItScene | null;
      if (s && s.scene.isActive()) s.debugTap(i);
    },
    openMenu: (key) => city()?.openMenu(key),
    pickMission: (id) => {
      const s = game.scene.getScene('MissionBoard') as MissionBoardScene | null;
      if (s && s.scene.isActive()) s.pick(id);
    },
    buy: (id) => {
      const s = game.scene.getScene('Shop') as ShopScene | null;
      return s && s.scene.isActive() ? s.buy(id) : false;
    },
    pickJob: (job) => {
      const s = game.scene.getScene('JobCenter') as JobCenterScene | null;
      return s && s.scene.isActive() ? s.pick(job) : false;
    },
    hose: () => {
      const c = city();
      if (!c) return null;
      const t = c.aimHose();
      if (t) c.spray(t);
      return t;
    },
    blast: () => {
      // With Build It! open, "blasting" again builds everything (tests don't drag pieces).
      const open = game.scene.getScene('BuildIt') as BuildItScene | null;
      if (open && open.scene.isActive()) {
        const site = open.debugState().site;
        open.debugFinish();
        return site;
      }
      const c = city();
      if (!c) return null;
      const t = c.aimBlast();
      if (t) c.blast(t);
      return t;
    },
    buildIt: () => {
      const b = game.scene.getScene('BuildIt') as BuildItScene | null;
      return b && b.scene.isActive() ? b.debugState() : null;
    },
    finishBuildIt: () => {
      const b = game.scene.getScene('BuildIt') as BuildItScene | null;
      if (!b || !b.scene.isActive()) return false;
      b.debugFinish();
      return true;
    },
    buildPlace: () => {
      const b = game.scene.getScene('BuildIt') as BuildItScene | null;
      return b && b.scene.isActive() ? b.debugPlaceNext() : false;
    },
    buildTool: (tool) => {
      const b = game.scene.getScene('BuildIt') as BuildItScene | null;
      if (b && b.scene.isActive()) b.pickTool(tool);
    },
    buildDrag: () => {
      const b = game.scene.getScene('BuildIt') as BuildItScene | null;
      return b && b.scene.isActive() ? b.debugDragPath() : null;
    },
    round: () => minigame()?.debugRound() ?? null,
    oops: () => minigame()?.debugOops(),
    retry: () => minigame()?.retry(),
    traffic: () => {
      const t = game.scene.getScene('TrafficHelper') as TrafficHelperScene | null;
      return t && t.scene.isActive() ? t.debugTraffic() : null;
    },
    toggleLight: () => {
      const t = game.scene.getScene('TrafficHelper') as TrafficHelperScene | null;
      if (t && t.scene.isActive()) t.debugToggle();
    },
    interiorDone: () => {
      const s = game.scene.getScene('Interior') as InteriorScene | null;
      if (!s || !s.scene.isActive()) return false;
      s.debugAllOut();
      s.debugLeave();
      return true;
    },
    parade: () => city()?.parade(),
    shopTap: (id) => {
      const s = game.scene.getScene('Shop') as ShopScene | null;
      if (s && s.scene.isActive()) s.debugTap(id);
    },
    placeItem: (item, gx, gy) => {
      const s = game.scene.getScene('Apartment') as ApartmentScene | null;
      return s && s.scene.isActive() ? s.placeItem(item, gx, gy) : false;
    },
    removeItem: (item) => {
      const s = game.scene.getScene('Apartment') as ApartmentScene | null;
      if (s && s.scene.isActive()) s.removeItem(item);
    },
    toggleHat: (hat) => {
      const s = game.scene.getScene('Apartment') as ApartmentScene | null;
      if (s && s.scene.isActive()) s.toggleHat(hat);
    },
    closeMenu: () => {
      for (const key of ['MissionBoard', 'Shop', 'JobCenter', 'Apartment']) {
        const s = game.scene.getScene(key);
        if (s && s.scene.isActive()) {
          // Close the way the back arrow does, so the city hears what was bought or changed.
          const own = s as unknown as { close?: () => void; leave?: () => void };
          if (key === 'Shop' && own.close) own.close();
          else if (key === 'Apartment' && own.leave) own.leave();
          else closeMenuScene(s);
        }
      }
    },
    idle: (seconds) => city()?.debugIdle(seconds),
    voiceLog: () => [...voice.log],
    sfxPlayed: () => ({ ...sfx.played }),
    saved: () => {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    },
  };
}
