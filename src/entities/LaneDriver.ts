import {
  CAR_ACCEL,
  CAR_BRAKE,
  CAR_CORNER_SPEED,
  CAR_MAX_SPEED,
  CAR_TURN_RADIUS,
  CAR_UTURN_SEC,
} from '../config';
import type { Vec2 } from '../iso/projection';
import { dirBetween, type LaneGraph, type LaneNode } from '../iso/roads';
import { MAX_BRANCH_DEG, pickBranch, stickDiff, wantsUTurn } from '../iso/steer';
import type { Facing } from './Player';

export function facingForDir(d: Vec2): Facing {
  if (d.x > 0) return 'SE';
  if (d.x < 0) return 'NW';
  if (d.y > 0) return 'SW';
  return 'NE';
}

/** 8-way vehicle frame index for a grid-space angle: 0 = +gx (SE on screen), counting toward +gy. */
export function dir8ForAngle(gridAngle: number): number {
  const k = Math.round(gridAngle / (Math.PI / 4));
  return ((k % 8) + 8) % 8;
}

export function dir8ForDir(d: Vec2): number {
  return dir8ForAngle(Math.atan2(d.y, d.x));
}

/** Chooses a branch index at a node, or -1 to stop. */
export type BranchChooser = (options: Vec2[], heading: Vec2, at: LaneNode) => number;

export interface DriveInput {
  /** Screen-space stick (up the screen = −y), length 0..1, or null for no input. */
  stick: Vec2 | null;
  /** Speed to aim for when not steered by the stick (path following / AI). */
  cruise?: number;
  /** Custom branch choice (AI). Used when there is no stick input. */
  chooser?: BranchChooser;
}

/** Tunable feel (the `?drive` overlay edits these live). */
export const DRIVE_TUNING = {
  maxSpeed: CAR_MAX_SPEED,
  accel: CAR_ACCEL,
  brake: CAR_BRAKE,
  cornerSpeed: CAR_CORNER_SPEED,
  turnRadius: CAR_TURN_RADIUS,
  uturnSec: CAR_UTURN_SEC,
};

/** Where a waiting vehicle stops before a junction (centre-line progress along the edge). */
const STOP_LINE_T = 0.5;
/** A stick pointing behind still takes a junction this close ahead (tiles) instead of spinning. */
const JUNCTION_LOOKAHEAD = 1.2;

const lane = (d: Vec2): Vec2 => ({ x: -d.y * 0.5, y: d.x * 0.5 });
const same = (a: Vec2, b: Vec2) => a.x === b.x && a.y === b.y;
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;

/** The lane-path corner at node n when arriving along a and leaving along b (right-hand lanes). */
function corner(n: Vec2, a: Vec2, b: Vec2): Vec2 {
  const p = add(n, lane(a));
  return same(a, b) || (a.x === -b.x && a.y === -b.y) ? p : add(p, lane(b));
}

/**
 * Road-assist vehicle motion on a lane graph (no rendering), ADR-003 + ADR-004.
 *
 * Logically the vehicle is on an edge from → to and has already picked its next edge (`next`),
 * so the drawn path can curve through the corner. It drives along its right-hand lane: a polyline
 * of lane corners, with each turn rounded by a short curve. A U-turn is a quick cartoon spin.
 */
export class LaneDriver {
  from: LaneNode;
  to: LaneNode;
  /** The edge after `to` (null = stop at `to`). */
  next: LaneNode | null = null;
  /** Direction we arrived at `from` with (for the corner at the start of this edge). */
  private prevDir: Vec2;
  /** Distance travelled along this edge's lane segment. */
  private d = 0;
  /** Corner curve radius at the start of this segment (shared with the previous segment's end). */
  private rStart = 0;
  /** Stopping at `to` because the tap-to-go route ends there (vs. waiting at the stop line). */
  private arriving = false;
  /** Following a tap-to-go route (stays true until it has stopped at the end). */
  following = false;
  /** Turn around once stopped at the stop line (an AI dead end / the stick chose to go back). */
  private uturnAtStop = false;
  speed = 0;
  /** Remaining node ids to visit after `to` (tap-to-go). */
  path: string[] = [];
  /** Seconds since the direction last changed (turn, bend or U-turn). */
  sinceTurn = 10;
  /** A U-turn spin in progress. */
  spin: { t: number; from: number; to: number } | null = null;
  /** Visual offset that eases to zero (hides small jumps: U-turn lane change, re-routing). */
  private blend: Vec2 = { x: 0, y: 0 };
  private blendLeft = 0;
  /** Grid-space heading angle of the drawn vehicle (radians). */
  headingAngle: number;

  constructor(
    readonly graph: LaneGraph,
    start: LaneNode,
    heading: Vec2,
    private readonly ownMaxSpeed?: number,
    /** Multiplies acceleration (the police bike is zippier). */
    private readonly accelScale = 1,
  ) {
    this.from = start;
    this.to = graph.get(start.x + heading.x, start.y + heading.y) ?? graph.node(start.links[0]!);
    this.prevDir = this.dir;
    this.headingAngle = Math.atan2(this.dir.y, this.dir.x);
    this.decide(null, {});
  }

  /** Top speed (tiles/s): this vehicle's own, else the tunable default. */
  get maxSpeed(): number {
    return this.ownMaxSpeed ?? DRIVE_TUNING.maxSpeed;
  }

  get dir(): Vec2 {
    return dirBetween(this.from, this.to);
  }

  get facing(): Facing {
    return facingForDir(this.dir);
  }

  /** 8-way frame index of the drawn vehicle. */
  get dir8(): number {
    return dir8ForAngle(this.headingAngle);
  }

  // --- segment geometry -------------------------------------------------------------------------

  private get endDir(): Vec2 {
    return this.next && !this.uturnAtStop ? dirBetween(this.to, this.next) : this.dir;
  }

  private get start(): Vec2 {
    return corner(this.from, this.prevDir, this.dir);
  }

  private get end(): Vec2 {
    return corner(this.to, this.dir, this.endDir);
  }

  /** Length of this lane segment (corner to corner). */
  private get length(): number {
    return Math.max(0, dot(sub(this.end, this.start), this.dir));
  }

  /** Corner curve radius at the end of this segment. */
  private get rEnd(): number {
    const e = this.endDir;
    if (same(e, this.dir) || !this.next) return 0;
    // The next segment, assumed to run straight on, bounds the curve too.
    const nextLen = dot(sub(add(this.next, lane(e)), this.end), e);
    return Math.max(
      0,
      Math.min(DRIVE_TUNING.turnRadius, this.length - this.rStart, nextLen, this.length),
    );
  }

  /** Progress along the centre line of this edge (0 at `from`, 1 at `to`). */
  get t(): number {
    const os = dot(sub(this.start, this.from), this.dir);
    return Math.max(0, Math.min(1, os + this.d));
  }

  /** Centre-line position (for distances, catching, tap-to-go). */
  get centre(): Vec2 {
    return add(this.from, scale(this.dir, this.t));
  }

  /** Distance along the segment where a stopping vehicle comes to rest. */
  private get stopAt(): number {
    const os = dot(sub(this.start, this.from), this.dir);
    return Math.max(0, (this.arriving ? 1 : STOP_LINE_T) - os);
  }

  /** Raw lane position + travel tangent (grid space), before the visual blend. */
  private sample(): { p: Vec2; tan: Vec2 } {
    const dir = this.dir;
    const S = this.start;
    const L = this.length;
    const rs = Math.min(this.rStart, L);
    const re = this.rEnd;
    if (rs > 1e-6 && this.d < rs && !same(this.prevDir, dir)) {
      // Second half of the curve around the start corner.
      const u = (rs + this.d) / (2 * rs);
      return this.curve(S, this.prevDir, dir, rs, u);
    }
    if (re > 1e-6 && this.d > L - re) {
      const u = Math.min(1, (this.d - (L - re)) / (2 * re));
      return this.curve(this.end, dir, this.endDir, re, u);
    }
    return { p: add(S, scale(dir, Math.min(this.d, L))), tan: dir };
  }

  /** Quadratic curve through corner K from K − r·a to K + r·b, at parameter u. */
  private curve(K: Vec2, a: Vec2, b: Vec2, r: number, u: number): { p: Vec2; tan: Vec2 } {
    const P0 = sub(K, scale(a, r));
    const P1 = add(K, scale(b, r));
    const w0 = (1 - u) * (1 - u);
    const w1 = 2 * u * (1 - u);
    const w2 = u * u;
    return {
      p: {
        x: P0.x * w0 + K.x * w1 + P1.x * w2,
        y: P0.y * w0 + K.y * w1 + P1.y * w2,
      },
      tan: add(scale(a, 1 - u), scale(b, u)),
    };
  }

  /** Where the vehicle is drawn: its lane, rounded through corners. */
  get pos(): Vec2 {
    return add(this.sample().p, this.blend);
  }

  private setBlend(oldPos: Vec2, seconds: number): void {
    this.blend = sub(oldPos, this.sample().p);
    this.blendLeft = seconds;
  }

  // --- decisions --------------------------------------------------------------------------------

  private optionsAt(n: LaneNode): { dirs: Vec2[]; nodes: LaneNode[] } {
    const nodes = n.links.map((id) => this.graph.node(id));
    return { nodes, dirs: nodes.map((m) => dirBetween(n, m)) };
  }

  /** Pick the edge after `to` (sets next / arriving / uturnAtStop). */
  private decide(stick: Vec2 | null, input: Pick<DriveInput, 'chooser'>): void {
    this.arriving = false;
    this.uturnAtStop = false;
    const at = this.to;
    if (this.path.length > 0) {
      const id = this.path[0]!;
      this.next = at.links.includes(id) ? this.graph.node(id) : null;
      if (!this.next) this.path = [];
      else return;
    }
    if (this.following) {
      this.next = null;
      this.arriving = true;
      return;
    }
    const { dirs, nodes } = this.optionsAt(at);
    const stopped = this.speed === 0 && this.d >= this.stopAt - 1e-6;
    const idx =
      input.chooser && !stick
        ? input.chooser(dirs, this.dir, at)
        : pickBranch(stick, this.dir, dirs, stopped);
    if (idx < 0) {
      this.next = null;
      return;
    }
    const n = nodes[idx]!;
    if (n.id === this.from.id) {
      // Going back the way we came: stop at the line, then spin round.
      this.next = n;
      this.uturnAtStop = true;
      return;
    }
    this.next = n;
  }

  /** Re-pick the next edge if there's still room before the corner. Keeps position continuous. */
  private redecide(stick: Vec2 | null, input: DriveInput): void {
    const before = { next: this.next, arriving: this.arriving, uturn: this.uturnAtStop };
    // Once the vehicle is in the corner curve, the old choice is locked in.
    const oldStops = before.next === null || before.uturn;
    const oldCommitted = !oldStops && this.d > this.length - this.rEnd + 1e-6;
    if (oldCommitted && this.d > 1e-6) return;
    const oldPos = this.pos;
    const oldBlend = this.blend;
    this.decide(stick, input);
    const changed =
      before.next?.id !== this.next?.id ||
      before.arriving !== this.arriving ||
      before.uturn !== this.uturnAtStop;
    if (!changed) return;
    // Too late for the new choice (already past where it would start): keep the old one.
    const stops = this.next === null || this.uturnAtStop;
    const tooLate =
      this.d > 1e-6 &&
      (stops ? this.d > this.stopAt + 1e-6 : this.d > this.length - this.rEnd + 1e-6);
    if (tooLate) {
      this.next = before.next;
      this.arriving = before.arriving;
      this.uturnAtStop = before.uturn;
      return;
    }
    this.blend = oldBlend;
    const jump = sub(oldPos, this.pos);
    if (Math.hypot(jump.x, jump.y) > 1e-3) this.setBlend(oldPos, 0.15);
  }

  // --- commands ---------------------------------------------------------------------------------

  /** Turn around with a quick cartoon spin (also swaps to the other lane). */
  private startSpin(stick: Vec2 | null = null): void {
    const oldPos = this.pos;
    const fromAngle = this.headingAngle;
    const tc = this.t;
    [this.from, this.to] = [this.to, this.from];
    this.prevDir = this.dir;
    this.rStart = 0;
    this.d = Math.max(0, 1 - tc - dot(sub(this.start, this.from), this.dir));
    this.speed = 0;
    this.sinceTurn = 0;
    this.next = null;
    this.decide(stick, {});
    this.d = Math.min(this.d, this.next === null ? this.stopAt : this.length);
    this.setBlend(oldPos, DRIVE_TUNING.uturnSec);
    // Spin toward the new lane's side so the car swings across the road.
    this.spin = { t: 0, from: fromAngle, to: fromAngle + Math.PI };
  }

  /** Put the vehicle on a node, heading along `heading` if possible. */
  placeAt(node: LaneNode, heading: Vec2): void {
    this.from = node;
    this.to =
      this.graph.get(node.x + heading.x, node.y + heading.y) ?? this.graph.node(node.links[0]!);
    this.resetOnEdge(0);
  }

  /** Put the vehicle on edge from → to at centre-line progress t (debug / scripted scenes). */
  placeOnEdge(from: LaneNode, to: LaneNode, t: number): void {
    this.from = from;
    this.to = to;
    this.resetOnEdge(t);
  }

  private resetOnEdge(t: number): void {
    this.prevDir = this.dir;
    this.rStart = 0;
    this.d = t;
    this.speed = 0;
    this.path = [];
    this.following = false;
    this.spin = null;
    this.blend = { x: 0, y: 0 };
    this.blendLeft = 0;
    this.headingAngle = Math.atan2(this.dir.y, this.dir.x);
    this.decide(null, {});
  }

  /** Drive to the node nearest a grid point along the roads. Returns false if unreachable. */
  goToward(p: Vec2): boolean {
    const target = this.graph.nearest(p);
    const viaTo = this.graph.path(this.to.id, target.id);
    const viaFrom = this.graph.path(this.from.id, target.id);
    if (!viaTo && !viaFrom) return false;
    if (viaFrom && (!viaTo || viaFrom.length + 1 < viaTo.length)) {
      // Going back through `from` is shorter: spin round first.
      this.path = [];
      this.startSpin();
      this.path = viaFrom.slice(1);
      this.following = true;
      this.decide(null, {});
      return true;
    }
    this.path = viaTo!.slice(1);
    this.following = true;
    const oldNext = this.next;
    const oldPos = this.pos;
    const inCorner = oldNext !== null && this.d > this.length - this.rEnd + 1e-6;
    if (inCorner && this.path[0] !== oldNext.id) {
      // Already turning: carry on round this corner and route from there.
      const fromNext = this.graph.path(oldNext.id, target.id);
      if (fromNext) this.path = fromNext;
      return true;
    }
    this.decide(null, {});
    if (this.d > this.length) this.d = this.length;
    this.setBlend(oldPos, 0.15);
    return true;
  }

  cancelPath(): void {
    this.path = [];
    this.following = false;
    this.arriving = false;
  }

  // --- per frame --------------------------------------------------------------------------------

  update(dt: number, input: DriveInput): void {
    const s = input.stick;
    const mag = s ? Math.hypot(s.x, s.y) : 0;
    const manual = mag > 0.15;
    const stick = manual ? s : null;
    if (manual && (this.path.length > 0 || this.following)) {
      this.path = [];
      this.following = false;
      this.redecide(stick, input);
    }
    this.sinceTurn += dt;

    // Visual blend eases out.
    if (this.blendLeft > 0) {
      const k = Math.min(1, dt / this.blendLeft);
      this.blend = scale(this.blend, 1 - k);
      this.blendLeft -= dt;
    } else this.blend = { x: 0, y: 0 };

    if (this.spin) {
      this.spin.t += dt;
      const u = Math.min(1, this.spin.t / DRIVE_TUNING.uturnSec);
      const e = 1 - (1 - u) * (1 - u);
      this.headingAngle = this.spin.from + (this.spin.to - this.spin.from) * e;
      this.speed = 0;
      if (u >= 1) {
        this.spin = null;
        this.headingAngle = Math.atan2(this.dir.y, this.dir.x);
      }
      return;
    }

    // Stick clearly behind: spin round, unless the junction just ahead goes the right way.
    if (stick && wantsUTurn(stick, this.dir, this.sinceTurn)) {
      let goodAhead = false;
      if (this.length - this.d < JUNCTION_LOOKAHEAD) {
        this.redecide(stick, input);
        goodAhead =
          this.next !== null &&
          !this.uturnAtStop &&
          !same(this.endDir, this.dir) &&
          stickDiff(stick, this.endDir) <= MAX_BRANCH_DEG;
      }
      if (!goodAhead) {
        this.startSpin(stick);
        return;
      }
    }

    // Steering can change the choice at the coming junction until the corner starts.
    if (stick || this.next === null) this.redecide(stick, input);

    // Stopped at the line and the choice is "go back": spin.
    if (this.uturnAtStop && this.speed === 0 && this.d >= this.stopAt - 1e-6) {
      this.startSpin(stick);
      return;
    }

    // Target speed.
    let target = 0;
    if (manual) target = this.maxSpeed * Math.min(1, mag);
    else if (this.path.length > 0 || this.following) target = this.maxSpeed;
    else if (input.cruise !== undefined) target = input.cruise;
    if (this.next === null || this.uturnAtStop) {
      const left = Math.max(0, this.stopAt - this.d);
      target = Math.min(target, Math.sqrt(2 * DRIVE_TUNING.brake * left));
    } else if (this.rEnd > 0) {
      const toCurve = Math.max(0, this.length - this.rEnd - this.d);
      target = Math.min(
        target,
        Math.sqrt(DRIVE_TUNING.cornerSpeed ** 2 + 2 * DRIVE_TUNING.brake * toCurve),
      );
    }
    const rate = target > this.speed ? DRIVE_TUNING.accel * this.accelScale : DRIVE_TUNING.brake;
    this.speed +=
      Math.sign(target - this.speed) * Math.min(Math.abs(target - this.speed), rate * dt);

    // Move along the lane, crossing into following segments.
    this.d += this.speed * dt;
    for (let guard = 0; guard < 4; guard++) {
      if (this.next === null || this.uturnAtStop) {
        if (this.d >= this.stopAt) {
          this.d = this.stopAt;
          this.speed = 0;
          if (this.arriving) this.following = false;
        }
        break;
      }
      const L = this.length;
      if (this.d < L) break;
      const rEnd = this.rEnd;
      const turned = !same(this.endDir, this.dir);
      this.d -= L;
      this.prevDir = this.dir;
      this.from = this.to;
      this.to = this.next;
      this.rStart = rEnd;
      if (this.path[0] === this.to.id) this.path.shift();
      if (turned) this.sinceTurn = 0;
      this.next = null;
      this.decide(stick, input);
    }

    const { tan } = this.sample();
    if (Math.hypot(tan.x, tan.y) > 1e-6) this.headingAngle = Math.atan2(tan.y, tan.x);
  }
}
