import type { Vec2 } from '../iso/projection';

/** Registry keys and game-wide event names shared between scenes. */
export const MAP_KEY = 'map';
export const INPUT_KEY = 'input';
export const STATE_KEY = 'state';
export const HUD_INFO_KEY = 'hudInfo';
export const HUD_HIT_KEY = 'hudHit';
/** A function the HUD calls to open the Job Center from anywhere (quick change, spec 005). */
export const OPEN_JOBS_KEY = 'openJobs';

export const EV = {
  missionComplete: 'mission:complete',
  minigameComplete: 'minigame:complete',
  coinsAwarded: 'coins:awarded',
  badge: 'badge:earned',
  /** A picture menu over the city closed (board, shop): the city resumes. */
  menuClosed: 'menu:closed',
  /** An interior room (the kitchen) was finished and closed. */
  interiorDone: 'interior:done',
  /** The finale is won: night-time parade (spec 007). */
  parade: 'finale:parade',
  /** Build It! was finished for a build spot (spec 008). */
  buildDone: 'build:done',
  /** Night tint on/off (the HUD draws it). */
  night: 'finale:night',
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
  /**
   * The running mission's steps (spec 008): how many, which one is on, and for a step with parts
   * (flags, fires, robbers) how many parts there are and how many are done.
   */
  mission: { goals: number; index: number; parts: number; partsDone: number } | null;
}

export interface MinigameResult {
  id: string;
  score: number;
  coins: number;
}
