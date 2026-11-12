import { describe, expect, it } from 'vitest';
import { applyDeadZone, screenDirToGrid } from '../../src/input/direction';
import { InputMapper, type PointerSample } from '../../src/input/InputMapper';
import { gridToScreen } from '../../src/iso/projection';

const angle = (v: { x: number; y: number }) => Math.atan2(v.y, v.x);
const mag = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);

describe('screenDirToGrid', () => {
  const cases: [string, { x: number; y: number }][] = [
    ['up', { x: 0, y: -1 }],
    ['down', { x: 0, y: 1 }],
    ['left', { x: -1, y: 0 }],
    ['right', { x: 1, y: 0 }],
    ['up-right', { x: Math.SQRT1_2, y: -Math.SQRT1_2 }],
    ['down-left', { x: -0.6, y: 0.8 }],
  ];

  for (const [name, v] of cases) {
    it(`${name} on screen projects back to ${name}`, () => {
      const g = screenDirToGrid(v);
      expect(angle(gridToScreen(g.x, g.y))).toBeCloseTo(angle(v), 9);
    });
  }

  it('up the screen means decreasing gx and gy equally', () => {
    const g = screenDirToGrid({ x: 0, y: -1 });
    expect(g.x).toBeLessThan(0);
    expect(g.y).toBeLessThan(0);
    expect(g.x).toBeCloseTo(g.y, 9);
  });

  it('right on screen means +gx, -gy', () => {
    const g = screenDirToGrid({ x: 1, y: 0 });
    expect(g.x).toBeGreaterThan(0);
    expect(g.y).toBeLessThan(0);
  });

  it('preserves magnitude (clamped to 1) and handles zero', () => {
    expect(mag(screenDirToGrid({ x: 0.5, y: 0 }))).toBeCloseTo(0.5);
    expect(mag(screenDirToGrid({ x: 3, y: 4 }))).toBeCloseTo(1);
    expect(screenDirToGrid({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe('applyDeadZone', () => {
  it('zeros small vectors and rescales the rest', () => {
    expect(applyDeadZone({ x: 0.1, y: 0 }, 0.15)).toEqual({ x: 0, y: 0 });
    expect(applyDeadZone({ x: 1, y: 0 }, 0.15).x).toBeCloseTo(1);
    expect(applyDeadZone({ x: 2, y: 0 }, 0.15).x).toBeCloseTo(1);
  });
});

const origin = { x: 0, y: 0 };
function ptr(id: number, sx: number, sy: number, time: number, isTouch: boolean): PointerSample {
  return { id, screen: { x: sx, y: sy }, world: { x: sx, y: sy }, isTouch, time };
}

describe('InputMapper keyboard', () => {
  it('maps arrows and WASD to screen directions', () => {
    const m = new InputMapper();
    m.keyDown('ArrowUp');
    expect(m.update(0, origin).move).toEqual({ x: 0, y: -1 });
    m.keyUp('ArrowUp');
    m.keyDown('KeyD');
    expect(m.update(0, origin).move).toEqual({ x: 1, y: 0 });
    m.keyDown('KeyS');
    const v = m.update(0, origin).move;
    expect(v.x).toBeCloseTo(Math.SQRT1_2);
    expect(v.y).toBeCloseTo(Math.SQRT1_2);
  });

  it('reset lets go of held keys and pending presses (keyup lost while a minigame was open)', () => {
    const m = new InputMapper();
    m.keyDown('ArrowRight');
    m.keyDown('Space');
    m.reset();
    const a = m.update(0, origin);
    expect(a.move).toEqual({ x: 0, y: 0 });
    expect(a.action).toBe(false);
  });

  it('dropReleased lets go of a pointer whose up never arrived (released over the HUD)', () => {
    const m = new InputMapper();
    m.pointerDown({
      id: 1,
      screen: { x: 900, y: 600 },
      world: { x: 300, y: 0 },
      isTouch: false,
      time: 0,
    });
    expect(m.isSteering(500)).toBe(true);
    m.dropReleased(() => false);
    expect(m.isSteering(500)).toBe(false);
    expect(m.update(500, origin).move).toEqual({ x: 0, y: 0 });
  });

  it('opposite keys cancel', () => {
    const m = new InputMapper();
    m.keyDown('ArrowLeft');
    m.keyDown('ArrowRight');
    expect(m.update(0, origin).move).toEqual({ x: 0, y: 0 });
  });

  it('Q (and the siren button) is a one-frame siren press; S stays down', () => {
    const m = new InputMapper();
    m.keyDown('KeyQ');
    const a = m.update(0, origin);
    expect(a.siren).toBe(true);
    expect(a.move).toEqual({ x: 0, y: 0 });
    expect(m.update(0, origin).siren).toBe(false);
    m.pressSiren();
    expect(m.update(0, origin).siren).toBe(true);
    m.keyDown('KeyS');
    const b = m.update(0, origin);
    expect(b.siren).toBe(false);
    expect(b.move).toEqual({ x: 0, y: 1 });
  });

  it('action is a one-frame press', () => {
    const m = new InputMapper();
    m.keyDown('Space');
    expect(m.update(0, origin).action).toBe(true);
    m.keyDown('Space'); // key repeat
    expect(m.update(0, origin).action).toBe(false);
  });
});

describe('InputMapper mouse', () => {
  it('a quick click produces a one-frame goTo on the clicked tile', () => {
    const m = new InputMapper();
    const w = gridToScreen(5.5, 3.5);
    m.pointerDown({ id: 1, screen: { x: 10, y: 10 }, world: w, isTouch: false, time: 0 });
    m.pointerUp({ id: 1, screen: { x: 10, y: 10 }, world: w, isTouch: false, time: 100 });
    expect(m.update(100, origin).goTo).toEqual({ gx: 5, gy: 3 });
    expect(m.lastGoToWorld).toEqual(w);
    expect(m.update(116, origin).goTo).toBeNull();
  });

  it('click-and-hold steers toward the pointer and does not goTo on release', () => {
    const m = new InputMapper();
    m.pointerDown(ptr(1, 500, 300, 0, false));
    expect(m.update(50, origin).move).toEqual({ x: 0, y: 0 });
    const a = m.update(400, origin);
    expect(a.move.x).toBeGreaterThan(0.8);
    expect(a.move.y).toBeGreaterThan(0.4);
    m.pointerUp(ptr(1, 500, 300, 600, false));
    const b = m.update(600, origin);
    expect(b.goTo).toBeNull();
    expect(b.move).toEqual({ x: 0, y: 0 });
  });
});

describe('InputMapper touch', () => {
  it('left-half touch spawns the joystick where the thumb lands and drives movement', () => {
    const m = new InputMapper();
    m.pointerDown(ptr(7, 200, 500, 0, true));
    expect(m.joystick.active).toBe(true);
    expect(m.joystick.origin).toEqual({ x: 200, y: 500 });
    m.pointerMove(ptr(7, 200, 400, 50, true)); // drag up past the radius
    const a = m.update(50, origin);
    expect(a.move.x).toBeCloseTo(0);
    expect(a.move.y).toBeCloseTo(-1);
    m.pointerUp(ptr(7, 200, 400, 600, true));
    expect(m.joystick.active).toBe(false);
    const b = m.update(600, origin);
    expect(b.move).toEqual({ x: 0, y: 0 });
    expect(b.goTo).toBeNull();
  });

  it('right-half touch does not spawn the joystick; a tap is go-to', () => {
    const m = new InputMapper();
    m.pointerDown(ptr(3, 900, 300, 0, true));
    expect(m.joystick.active).toBe(false);
    m.pointerUp(ptr(3, 902, 301, 120, true));
    expect(m.update(120, origin).goTo).not.toBeNull();
  });

  it('a quick tap on the left half (no drag) is also go-to', () => {
    const m = new InputMapper();
    m.pointerDown(ptr(4, 100, 300, 0, true));
    m.pointerUp(ptr(4, 101, 300, 100, true));
    expect(m.update(100, origin).goTo).not.toBeNull();
  });

  it('a second finger on the left does not steal the joystick', () => {
    const m = new InputMapper();
    m.pointerDown(ptr(1, 200, 500, 0, true));
    m.pointerDown(ptr(2, 300, 300, 10, true));
    expect(m.joystick.pointerId).toBe(1);
  });

  it('touch never feeds mouse steering', () => {
    const m = new InputMapper();
    m.pointerDown(ptr(9, 900, 300, 0, true));
    expect(m.isSteering(1000)).toBe(false);
    expect(m.update(1000, origin).move).toEqual({ x: 0, y: 0 });
  });
});
