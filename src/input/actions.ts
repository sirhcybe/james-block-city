/** One frame of player intent, independent of the device that produced it. */
export interface GameActions {
  /** Screen-relative, length 0..1. +x = right, +y = down the screen. */
  move: { x: number; y: number };
  /** Tap/click destination tile (present for one frame). */
  goTo: { gx: number; gy: number } | null;
  /** Pressed this frame. */
  action: boolean;
  /** Pressed this frame (Q or the siren button). */
  siren: boolean;
  /** Screen point (logical px). */
  aim: { x: number; y: number } | null;
  switchJob: boolean;
}

export function emptyActions(): GameActions {
  return {
    move: { x: 0, y: 0 },
    goTo: null,
    action: false,
    siren: false,
    aim: null,
    switchJob: false,
  };
}
