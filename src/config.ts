/** Global tunables. Geometry follows docs/art-style.md. */

export const TILE_W = 64;
export const TILE_H = 32;
/** One block height unit on screen, in px. */
export const BLOCK_H = 32;

/** Logical game size (landscape). */
export const GAME_W = 1280;
export const GAME_H = 720;

/** Player walking speed in tiles per second. */
export const WALK_SPEED = 4;
/** Player collision radius in tiles. */
export const PLAYER_RADIUS = 0.28;

/** Police car top speed (lane nodes per second = tiles/s), acceleration and braking. Tune by feel. */
export const CAR_MAX_SPEED = 5.5;
export const CAR_ACCEL = 7;
export const CAR_BRAKE = 12;
/** How close (tiles) the player must be to hop into a car. */
export const ENTER_CAR_DIST = 1.6;
/** Vehicles bump things / each other within this distance (tiles). */
export const BUMP_DIST = 0.75;

/** Camera follow lerp (0..1 per frame at 60 fps). */
export const CAMERA_LERP = 0.08;
/** City camera zoom (logical). >1 makes the world (and James's character) bigger on screen. */
export const WORLD_ZOOM = 1.5;

/** Alpha for a building that hides the player. */
export const OCCLUDED_ALPHA = 0.35;
export const FADE_MS = 180;

/** Touch joystick. */
export const JOYSTICK_RADIUS = 70;
export const JOYSTICK_DEAD_ZONE = 0.15;

/** Mouse: how long a press must be held before it becomes steering instead of click-to-go. */
export const HOLD_TO_STEER_MS = 220;
/** Mouse steering: distance (px) from the player at which the move vector reaches full length. */
export const STEER_FULL_PX = 120;

export const PALETTE = {
  outline: 0x2b2d42,
  policeBlue: 0x2f6fde,
  fireRed: 0xe63946,
  builderYellow: 0xffc233,
  harborTeal: 0x2ec4b6,
  buildingWhite: 0xf4f6fa,
  windowBlue: 0x7ec8f2,
  grass: 0x7bd35a,
  road: 0x5a5f6b,
  sidewalk: 0xd9dce3,
  coinGold: 0xffd23f,
  water: 0x3fb8e0,
  // Supporting colors (not in the art-style table; tuned by eye).
  plaza: 0xeee3c8,
  roadLine: 0xf4f6fa,
  trunk: 0x9c6b3f,
  leaf: 0x4fb544,
  skin: 0xffc99a,
  donutPink: 0xff8fc7,
  dough: 0xe0a458,
  robberBlack: 0x2b2d42,
  getawayPurple: 0x8e6bd8,
  coneOrange: 0xff8c2e,
} as const;

export type PaletteKey = keyof typeof PALETTE;
