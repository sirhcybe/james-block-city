import { CAR_ACCEL, CAR_BRAKE, CAR_MAX_SPEED } from '../config';
import type { Vec2 } from '../iso/projection';
import { chooseBranch, dirBetween, rightOf, type LaneGraph, type LaneNode } from '../iso/roads';
import type { Facing } from './Player';

export function facingForDir(d: Vec2): Facing {
  if (d.x > 0) return 'SE';
  if (d.x < 0) return 'NW';
  if (d.y > 0) return 'SW';
  return 'NE';
}

/** Chooses a branch index at a node, or -1 to stop. */
export type BranchChooser = (options: Vec2[], heading: Vec2, at: LaneNode) => number;

export interface DriveInput {
  /** Desired grid direction × strength (0..1), or null for no stick input. */
  stick: Vec2 | null;
  /** Speed to aim for when not steered by the stick (path following / AI). */
  cruise?: number;
  /** Custom branch choice (AI). Defaults to road assist from the stick. */
  chooser?: BranchChooser;
}

/**
 * Road-assist vehicle motion on a lane graph (no rendering). The vehicle is always on an edge
 * from → to at progress t, drives on the right-hand lane, and only decides at nodes.
 */
export class LaneDriver {
  from: LaneNode;
  to: LaneNode;
  t = 0;
  speed = 0;
  /** Smoothed lane offset (grid units). */
  lane: Vec2;
  /** Remaining node ids to visit (tap-to-go). */
  path: string[] = [];

  constructor(
    readonly graph: LaneGraph,
    start: LaneNode,
    heading: Vec2,
    readonly maxSpeed = CAR_MAX_SPEED,
  ) {
    this.from = start;
    const ahead = graph.get(start.x + heading.x, start.y + heading.y);
    this.to = ahead ?? graph.node(start.links[0]!);
    const r = rightOf(this.dir);
    this.lane = { x: r.x * 0.5, y: r.y * 0.5 };
  }

  get dir(): Vec2 {
    return dirBetween(this.from, this.to);
  }

  get facing(): Facing {
    return facingForDir(this.dir);
  }

  /** Centre-line position. */
  get centre(): Vec2 {
    return {
      x: this.from.x + (this.to.x - this.from.x) * this.t,
      y: this.from.y + (this.to.y - this.from.y) * this.t,
    };
  }

  /** Where the vehicle is drawn: centre line + its lane. */
  get pos(): Vec2 {
    const c = this.centre;
    return { x: c.x + this.lane.x, y: c.y + this.lane.y };
  }

  reverse(): void {
    [this.from, this.to] = [this.to, this.from];
    this.t = 1 - this.t;
  }

  /** Put the vehicle on a node, heading along `heading` if possible. */
  placeAt(node: LaneNode, heading: Vec2): void {
    this.from = node;
    this.to =
      this.graph.get(node.x + heading.x, node.y + heading.y) ?? this.graph.node(node.links[0]!);
    this.t = 0;
    this.speed = 0;
    this.path = [];
    const r = rightOf(this.dir);
    this.lane = { x: r.x * 0.5, y: r.y * 0.5 };
  }

  /** Drive to the node nearest a grid point along the roads. Returns false if unreachable. */
  goToward(p: Vec2): boolean {
    const target = this.graph.nearest(p);
    const viaTo = this.graph.path(this.to.id, target.id);
    const viaFrom = this.graph.path(this.from.id, target.id);
    if (!viaTo && !viaFrom) return false;
    // Turn around if going back through `from` is shorter.
    if (viaFrom && (!viaTo || viaFrom.length + 1 < viaTo.length)) {
      this.reverse();
      this.path = viaFrom.slice(1);
    } else {
      this.path = viaTo!.slice(1);
    }
    return true;
  }

  cancelPath(): void {
    this.path = [];
  }

  private optionsAt(n: LaneNode): { dirs: Vec2[]; nodes: LaneNode[] } {
    const nodes = n.links.map((id) => this.graph.node(id));
    return { nodes, dirs: nodes.map((m) => dirBetween(n, m)) };
  }

  /** Pick the next edge at node `to`. Returns false if the vehicle must stop there. */
  private turnAt(input: DriveInput, stick: Vec2 | null): boolean {
    const at = this.to;
    const { dirs, nodes } = this.optionsAt(at);
    let idx: number;
    if (this.path.length > 0) {
      const next = this.path.shift()!;
      idx = nodes.findIndex((m) => m.id === next);
    } else if (input.chooser && !stick) {
      idx = input.chooser(dirs, this.dir, at);
    } else {
      idx = chooseBranch(stick, this.dir, dirs);
    }
    if (idx < 0) return false;
    this.from = at;
    this.to = nodes[idx]!;
    return true;
  }

  update(dt: number, input: DriveInput): void {
    const s = input.stick;
    const mag = s ? Math.hypot(s.x, s.y) : 0;
    const manual = mag > 0.15;
    const stick = manual ? s : null;
    if (manual) this.path = [];

    // Stick pointing back along the road: turn around (on the spot, it's a cartoon).
    if (stick) {
      const d = this.dir;
      if ((stick.x * d.x + stick.y * d.y) / mag < -0.6) this.reverse();
    }

    // Stopped at a node (e.g. a T-junction waiting for a choice): take the stick's branch.
    if (this.t >= 1 && stick) {
      if (this.turnAt(input, stick)) this.t = 0;
    }

    let target = 0;
    if (manual) target = this.maxSpeed * Math.min(1, mag);
    else if (this.path.length > 0) target = this.maxSpeed;
    else if (input.cruise !== undefined) target = input.cruise;
    const rate = target > this.speed ? CAR_ACCEL : CAR_BRAKE;
    this.speed +=
      Math.sign(target - this.speed) * Math.min(Math.abs(target - this.speed), rate * dt);

    this.t += this.speed * dt;
    let guard = 0;
    while (this.t >= 1 && guard++ < 4) {
      if (this.speed <= 0) break;
      if (!this.turnAt(input, stick)) {
        this.t = 1;
        this.speed = 0;
        break;
      }
      this.t -= 1;
    }
    if (this.t > 1) this.t = 1;

    // Ease into the new lane after a turn.
    const r = rightOf(this.dir);
    const k = Math.min(1, dt * 8);
    this.lane = {
      x: this.lane.x + (r.x * 0.5 - this.lane.x) * k,
      y: this.lane.y + (r.y * 0.5 - this.lane.y) * k,
    };
  }
}
