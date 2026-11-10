import type Phaser from 'phaser';
import { GAME_W } from './config';
import { gridToScreen } from './iso/projection';
import type { CityScene } from './scenes/CityScene';

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
  /** Page coordinates of a logical screen point (0..1280, 0..720). */
  logicalToClient(x: number, y: number): { x: number; y: number };
  fps(): number;
  renderScale(): number;
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
    logicalToClient: (x, y) => {
      const { rect } = canvasScale();
      const k = rect.width / GAME_W;
      return { x: rect.left + x * k, y: rect.top + y * k };
    },
    fps: () => game.loop.actualFps,
    renderScale: () => game.scale.width / GAME_W,
  };
}
