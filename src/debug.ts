import type Phaser from 'phaser';
import { GAME_W } from './config';
import { gridToScreen } from './iso/projection';
import { sfx } from './audio/sfx';
import { voice } from './audio/voice';
import type { CityScene } from './scenes/CityScene';
import type { TrafficHelperScene } from './scenes/TrafficHelperScene';
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
  /** Launch the Traffic Helper minigame now / finish it with a score. */
  startMinigame(): void;
  finishMinigame(score: number): boolean;
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
      const r = c.robber.car.driver;
      c.car.driver.placeOnEdge(r.from, r.to, Math.max(0, r.t - 0.4));
    },
    startMinigame: () => city()?.startMinigame(),
    finishMinigame: (score) => {
      const s = game.scene.getScene('TrafficHelper') as TrafficHelperScene | null;
      if (!s || !s.scene.isActive()) return false;
      s.debugFinish(score);
      return true;
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
