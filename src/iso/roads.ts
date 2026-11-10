import type { Vec2 } from './projection';

/**
 * Road lane graph for "road assist".
 *
 * Roads are two tiles wide. A node sits on every integer grid point whose four surrounding tiles are
 * all road, which puts nodes on the centre line between the two lanes. Edges join orthogonal
 * neighbours (length 1). A vehicle drives along the centre line, offset half a tile to its right
 * (its lane), and only chooses where to go at nodes.
 */
export interface LaneNode {
  id: string;
  x: number;
  y: number;
  /** Ids of neighbouring nodes. */
  links: string[];
}

export class LaneGraph {
  readonly nodes = new Map<string, LaneNode>();

  static key(x: number, y: number): string {
    return `${x},${y}`;
  }

  get(x: number, y: number): LaneNode | undefined {
    return this.nodes.get(LaneGraph.key(x, y));
  }

  node(id: string): LaneNode {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`no lane node ${id}`);
    return n;
  }

  /** Nodes with three or more branches. */
  intersections(): LaneNode[] {
    return [...this.nodes.values()].filter((n) => n.links.length >= 3);
  }

  /** The node closest to a grid point. */
  nearest(p: Vec2): LaneNode {
    let best: LaneNode | null = null;
    let bestD = Infinity;
    for (const n of this.nodes.values()) {
      const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    if (!best) throw new Error('lane graph is empty');
    return best;
  }

  /** Shortest node path (BFS; all edges are length 1) from `from` to `to`, inclusive. */
  path(from: string, to: string): string[] | null {
    if (from === to) return [from];
    const prev = new Map<string, string>([[from, from]]);
    const queue = [from];
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const next of this.node(id).links) {
        if (prev.has(next)) continue;
        prev.set(next, id);
        if (next === to) {
          const out = [to];
          let cur = to;
          while (cur !== from) {
            cur = prev.get(cur)!;
            out.push(cur);
          }
          return out.reverse();
        }
        queue.push(next);
      }
    }
    return null;
  }
}

/** Build the lane graph from a road predicate over a W×H tile map. */
export function buildLaneGraph(
  isRoad: (x: number, y: number) => boolean,
  width: number,
  height: number,
): LaneGraph {
  const g = new LaneGraph();
  const road = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && isRoad(x, y);
  for (let y = 1; y < height; y++) {
    for (let x = 1; x < width; x++) {
      if (road(x - 1, y - 1) && road(x, y - 1) && road(x - 1, y) && road(x, y)) {
        const id = LaneGraph.key(x, y);
        g.nodes.set(id, { id, x, y, links: [] });
      }
    }
  }
  for (const n of g.nodes.values()) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const m = g.get(n.x + dx, n.y + dy);
      if (m) n.links.push(m.id);
    }
  }
  return g;
}

/** Unit direction from node a to node b. */
export function dirBetween(a: LaneNode, b: LaneNode): Vec2 {
  return { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) };
}

/** A vehicle's lane is to the right of its travel direction: right(d) = (-dy, dx) in grid space. */
export function rightOf(d: Vec2): Vec2 {
  return { x: -d.y, y: d.x };
}
