import type { Vec2 } from '../iso/projection';

/** Registry keys and game-wide event names shared between scenes. */
export const MAP_KEY = 'map';
export const INPUT_KEY = 'input';
export const STATE_KEY = 'state';
export const HUD_INFO_KEY = 'hudInfo';
export const HUD_HIT_KEY = 'hudHit';

export const EV = {
  missionComplete: 'mission:complete',
  minigameComplete: 'minigame:complete',
  coinsAwarded: 'coins:awarded',
  badge: 'badge:earned',
  /** A picture menu over the city closed (board, shop): the city resumes. */
  menuClosed: 'menu:closed',
  /** An interior room (the kitchen) was finished and closed. */
  interiorDone: 'interior:done',
} as const;

/** What the HUD needs to draw this frame (written by CityScene). */
export interface HudInfo {
  mode: 'foot' | 'car';
  /** What the Action button would do right now. */
  action: 'enter' | 'exit' | 'none' | 'net' | 'hose' | 'blast';
  donuts: number;
  sirenOn: boolean;
  /** Logical screen point to point the hint arrow at, or null. */
  hint: Vec2 | null;
}

export interface MinigameResult {
  id: string;
  score: number;
  coins: number;
}
