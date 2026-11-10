import { JOYSTICK_DEAD_ZONE, JOYSTICK_RADIUS } from '../config';
import type { Vec2 } from '../iso/projection';
import { applyDeadZone } from './direction';

/**
 * Floating joystick logic (no rendering). Appears where the thumb lands, follows the thumb up to
 * its radius, and disappears on release. Coordinates are logical screen px.
 */
export class TouchJoystick {
  pointerId: number | null = null;
  origin: Vec2 = { x: 0, y: 0 };
  knob: Vec2 = { x: 0, y: 0 };
  /** Furthest the thumb travelled from the origin during this touch (px). */
  maxTravel = 0;

  constructor(
    readonly radius = JOYSTICK_RADIUS,
    readonly deadZone = JOYSTICK_DEAD_ZONE,
  ) {}

  get active(): boolean {
    return this.pointerId !== null;
  }

  start(id: number, x: number, y: number): void {
    this.pointerId = id;
    this.origin = { x, y };
    this.knob = { x, y };
    this.maxTravel = 0;
  }

  moveTo(id: number, x: number, y: number): void {
    if (id !== this.pointerId) return;
    const dx = x - this.origin.x;
    const dy = y - this.origin.y;
    const len = Math.hypot(dx, dy);
    this.maxTravel = Math.max(this.maxTravel, len);
    const k = len > this.radius ? this.radius / len : 1;
    this.knob = { x: this.origin.x + dx * k, y: this.origin.y + dy * k };
  }

  end(id: number): boolean {
    if (id !== this.pointerId) return false;
    this.pointerId = null;
    return true;
  }

  /** Screen-relative move vector, length 0..1. */
  vector(): Vec2 {
    if (!this.active) return { x: 0, y: 0 };
    return applyDeadZone(
      {
        x: (this.knob.x - this.origin.x) / this.radius,
        y: (this.knob.y - this.origin.y) / this.radius,
      },
      this.deadZone,
    );
  }
}
