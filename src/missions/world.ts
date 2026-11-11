import type Phaser from 'phaser';
import type { RobberChase } from '../entities/RobberChase';
import type { TimeOutTower } from '../entities/TimeOutTower';
import type { Townsperson } from '../entities/Townsperson';
import type { TrafficCar } from '../entities/TrafficCar';
import type { Vehicle } from '../entities/Vehicle';
import type { TileKind } from '../content/schema';
import type { Vec2 } from '../iso/projection';
import type { GameState } from '../systems/GameState';
import type { RobberSpec } from '../systems/missions';

/** Which of the player's vehicles. */
export type VehicleId = 'police-car' | 'police-bike' | 'fire-truck' | 'mixer-truck';

/**
 * What mission goal handlers may use from the city. CityScene implements it; handlers never touch
 * Phaser input or the HUD directly, so the city stays the one place that owns the world.
 */
export interface MissionWorld {
  readonly stage: Phaser.Scene;
  readonly state: GameState;
  readonly tower: TimeOutTower;
  readonly traffic: readonly TrafficCar[];
  readonly robbers: readonly RobberChase[];
  now(): number;
  /** A named map point (throws for unknown ids: content is validated by tests). */
  marker(id: string): Vec2;
  hasMarker(id: string): boolean;
  /** Ground kind under a tile ('water' outside the map). */
  tileKind(x: number, y: number): TileKind;
  /** The player (on foot) or the vehicle they are driving. */
  focus(): Vec2;
  /** The player character's own position (even when driving). */
  playerPos(): Vec2;
  moveMode(): 'foot' | 'car';
  /** The vehicle being driven, if any, and which one it is. */
  riding(): { id: VehicleId; vehicle: Vehicle } | null;
  vehicle(id: VehicleId): Vehicle | null;
  townsperson(id: string): Townsperson | null;
  /** Put a robber on the map (not fleeing yet). */
  spawnRobber(spec: RobberSpec, bumps: number, onCaught: (name: string) => void): RobberChase;
  removeRobber(r: RobberChase): void;
  /** Something to pick up (loot drops). */
  dropPickup(item: string, at: Vec2): void;
  /** Extra things traffic must stop for (ducks, puppy). */
  setObstacles(key: string, pts: readonly Vec2[]): void;
  /** Little puff of cartoon smoke. */
  puff(at: Vec2): void;
  /** Give the player something to wear/keep (e.g. the cap on First Day). */
  give(item: string): void;
  /** A point up in the air on the map (fires on windows, pets on ledges). */
  perch(id: string): Vec2 & { z: number };
  /** Light a fire at a perch (spec 004). When it's put out, the world reports `sprayed`. */
  lightFire(id: string): void;
  /** Whether a fire is still burning. */
  fireBurning(id: string): boolean;
  /** Remove a fire without it being sprayed (mission ended or abandoned). */
  removeFire(id: string): void;
  /** How high the fire truck's ladder reaches now (block units). */
  ladderReach(): number;
  /** Draw the truck's ladder rising from `from` to a perch over `ms`; returns a remover. */
  raiseLadder(from: Vec2, to: Vec2 & { z: number }, ms: number): { destroy(): void };
  /** Go inside a room (a separate scene); the world reports `insideDone` when it's finished. */
  goInside(room: string): void;
  /** Builder (spec 005): show a build spot's ghost so the blaster can build it. */
  startSite(id: string): void;
  /** Stop a build spot that wasn't finished. */
  stopSite(id: string): void;
  /** Whether a build spot is built right now. */
  siteDone(id: string): boolean;
}
