import { GAME_W, HOLD_TO_STEER_MS, STEER_FULL_PX } from '../config';
import { screenToGrid, tileOf, type Vec2 } from '../iso/projection';
import { emptyActions, type GameActions } from './actions';
import { TouchJoystick } from './TouchJoystick';

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const ACTION = new Set(['Space', 'Enter']);
/** Siren/horn. Q, because S is already WASD "down" (decided 2026-11-09). */
const SIREN = new Set(['KeyQ']);

/** A tap/click shorter than this and moving less than TAP_SLOP_PX counts as go-to. */
const TAP_MAX_MS = 300;
const TAP_SLOP_PX = 12;
/** Mouse steering ignores the pointer when it is this close to the player (px). */
const STEER_DEAD_PX = 14;

export interface PointerSample {
  id: number;
  /** Logical screen position (0..GAME_W, 0..GAME_H). */
  screen: Vec2;
  /** World position (iso screen space, same space as gridToScreen). */
  world: Vec2;
  isTouch: boolean;
  time: number;
}

interface MouseState {
  id: number;
  downAt: number;
  start: Vec2;
  world: Vec2;
  moved: number;
}

interface TouchTap {
  downAt: number;
  start: Vec2;
}

/**
 * Turns raw keyboard / mouse / touch events into one GameActions per frame.
 * Pure TS (no Phaser) so it can be unit-tested with synthetic events.
 */
export class InputMapper {
  readonly joystick = new TouchJoystick();
  private keys = new Set<string>();
  private mouse: MouseState | null = null;
  private touchTaps = new Map<number, TouchTap>();
  private pendingGoTo: Vec2 | null = null;
  private pendingAction = false;
  private pendingSiren = false;
  /** World point of the go-to emitted by the last update(), if any. */
  lastGoToWorld: Vec2 | null = null;
  /** Overrides keyboard/pointer movement (used by the debug hook). */
  debugMove: Vec2 | null = null;

  keyDown(code: string): void {
    if (ACTION.has(code) && !this.keys.has(code)) this.pendingAction = true;
    if (SIREN.has(code) && !this.keys.has(code)) this.pendingSiren = true;
    this.keys.add(code);
  }

  keyUp(code: string): void {
    this.keys.delete(code);
  }

  /** Release everything held (e.g. when the window loses focus). */
  reset(): void {
    this.keys.clear();
    this.mouse = null;
    this.touchTaps.clear();
    this.pendingGoTo = null;
    this.pendingAction = false;
    this.pendingSiren = false;
    if (this.joystick.pointerId !== null) this.joystick.end(this.joystick.pointerId);
  }

  /**
   * Let go of pointers that are no longer down, whose "up" never reached us (e.g. a press on the
   * world let go over a HUD button, which keeps the event). Without this, mouse hold-to-steer or
   * the joystick stayed on and walked the player on their own (playtest 2026-11-11).
   * `isDown(id)` reports whether that pointer is really still pressed.
   */
  dropReleased(isDown: (id: number) => boolean): void {
    if (this.mouse && !isDown(this.mouse.id)) this.mouse = null;
    const js = this.joystick.pointerId;
    if (js !== null && !isDown(js)) this.joystick.end(js);
    for (const id of [...this.touchTaps.keys()]) if (!isDown(id)) this.touchTaps.delete(id);
  }

  pointerDown(p: PointerSample): void {
    if (p.isTouch) {
      this.touchTaps.set(p.id, { downAt: p.time, start: p.screen });
      // Left half: floating joystick under the thumb (one at a time).
      if (p.screen.x < GAME_W / 2 && !this.joystick.active) {
        this.joystick.start(p.id, p.screen.x, p.screen.y);
      }
      return;
    }
    this.mouse = { id: p.id, downAt: p.time, start: p.screen, world: p.world, moved: 0 };
  }

  pointerMove(p: PointerSample): void {
    if (p.isTouch) {
      this.joystick.moveTo(p.id, p.screen.x, p.screen.y);
      return;
    }
    if (this.mouse && this.mouse.id === p.id) {
      this.mouse.world = p.world;
      this.mouse.moved = Math.max(
        this.mouse.moved,
        Math.hypot(p.screen.x - this.mouse.start.x, p.screen.y - this.mouse.start.y),
      );
    }
  }

  pointerUp(p: PointerSample): void {
    if (p.isTouch) {
      const tap = this.touchTaps.get(p.id);
      this.touchTaps.delete(p.id);
      const wasStick = this.joystick.pointerId === p.id;
      const stickTravel = this.joystick.maxTravel;
      this.joystick.end(p.id);
      if (
        tap &&
        p.time - tap.downAt <= TAP_MAX_MS &&
        Math.hypot(p.screen.x - tap.start.x, p.screen.y - tap.start.y) < TAP_SLOP_PX &&
        (!wasStick || stickTravel < TAP_SLOP_PX)
      ) {
        this.pendingGoTo = p.world;
      }
      return;
    }
    const m = this.mouse;
    if (!m || m.id !== p.id) return;
    this.mouse = null;
    if (p.time - m.downAt < HOLD_TO_STEER_MS && m.moved < TAP_SLOP_PX) {
      this.pendingGoTo = p.world;
    }
  }

  /** On-screen buttons feed the same one-frame presses as the keys. */
  pressAction(): void {
    this.pendingAction = true;
  }

  pressSiren(): void {
    this.pendingSiren = true;
  }

  /** Whether the mouse is currently in hold-to-steer mode. */
  isSteering(now: number): boolean {
    return this.mouse !== null && now - this.mouse.downAt >= HOLD_TO_STEER_MS;
  }

  /**
   * Produce this frame's actions. `playerWorld` is the player's position in world (iso screen) px,
   * used for mouse click-and-hold steering.
   */
  update(now: number, playerWorld: Vec2): GameActions {
    const a = emptyActions();

    // Keyboard.
    let kx = 0;
    let ky = 0;
    for (const k of this.keys) {
      if (UP.has(k)) ky -= 1;
      if (DOWN.has(k)) ky += 1;
      if (LEFT.has(k)) kx -= 1;
      if (RIGHT.has(k)) kx += 1;
    }
    let move: Vec2 = { x: Math.sign(kx), y: Math.sign(ky) };

    // Touch joystick.
    if (move.x === 0 && move.y === 0) move = this.joystick.vector();

    // Mouse click-and-hold steering toward the pointer.
    if (move.x === 0 && move.y === 0 && this.mouse && this.isSteering(now)) {
      const dx = this.mouse.world.x - playerWorld.x;
      const dy = this.mouse.world.y - playerWorld.y;
      const len = Math.hypot(dx, dy);
      if (len > STEER_DEAD_PX) {
        const mag = Math.min(1, len / STEER_FULL_PX);
        move = { x: (dx / len) * mag, y: (dy / len) * mag };
      }
    }

    if (this.debugMove) move = this.debugMove;

    const len = Math.hypot(move.x, move.y);
    a.move = len > 1 ? { x: move.x / len, y: move.y / len } : move;

    this.lastGoToWorld = null;
    if (this.pendingGoTo) {
      const g = screenToGrid(this.pendingGoTo.x, this.pendingGoTo.y);
      const t = tileOf(g.x, g.y);
      a.goTo = { gx: t.x, gy: t.y };
      this.lastGoToWorld = this.pendingGoTo;
      this.pendingGoTo = null;
    }
    a.action = this.pendingAction;
    this.pendingAction = false;
    a.siren = this.pendingSiren;
    this.pendingSiren = false;
    return a;
  }
}
