import { z } from 'zod';

/**
 * Build It! (spec 008, pure): the Builder's build minigame. A blueprint is a picture made of
 * slots; the tray holds one piece per slot. Drag a piece onto a free slot of the same material
 * and size, then pick the tool that fixes that material. Nothing can go wrong for good: a wrong
 * slot or tool just doesn't take, and after two wrong tools the right one is pointed out.
 */
export const Material = z.enum(['wood', 'brick', 'steel']);
export type Material = z.infer<typeof Material>;
export const TOOLS = ['hammer', 'trowel', 'wrench'] as const;
export type Tool = (typeof TOOLS)[number];

/** Wood is nailed, bricks are laid in mortar, steel is bolted. */
export const TOOL_FOR: Record<Material, Tool> = {
  wood: 'hammer',
  brick: 'trowel',
  steel: 'wrench',
};

export const PieceDef = z.object({
  material: Material,
  /** Top-left corner and size on the blueprint, in blueprint units (y grows downward). */
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});
export type PieceDef = z.infer<typeof PieceDef>;

export const Blueprint = z.object({
  /** The build spot this is the picture for. */
  id: z.string(),
  pieces: z.array(PieceDef).min(3).max(8),
});
export type Blueprint = z.infer<typeof Blueprint>;
export const BlueprintList = z.array(Blueprint);

export const BUILD_IT = {
  /** How close (blueprint units, centre to centre) a dropped piece must be to a slot. */
  snap: 1.6,
  /** With the giant mixer drum pieces snap from further away. */
  giantSnap: 3,
  wrongToolsForHint: 2,
};

export type PieceState = 'tray' | 'placed' | 'fixed';

export type BuildEvent =
  | { type: 'placed'; piece: number; slot: number }
  | { type: 'wrongSlot'; piece: number }
  | { type: 'missed'; piece: number }
  | { type: 'fixed'; piece: number; slot: number; done: boolean }
  | { type: 'wrongTool'; tool: Tool; hint: Tool | null };

export class BuildJobModel {
  /** Per piece: where it is. Piece i was cut for slot i, but fits any slot like it. */
  readonly state: PieceState[];
  /** Per slot: the piece in it, or -1. */
  readonly slotPiece: number[];
  /** Wrong tools picked for the piece now waiting to be fixed. */
  wrongTools = 0;
  readonly snap: number;

  constructor(
    readonly pieces: readonly PieceDef[],
    giant = false,
  ) {
    this.state = pieces.map(() => 'tray');
    this.slotPiece = pieces.map(() => -1);
    this.snap = giant ? BUILD_IT.giantSnap : BUILD_IT.snap;
  }

  /** The piece that is in its slot but not fixed yet (only one at a time), or -1. */
  get pending(): number {
    return this.state.indexOf('placed');
  }

  get fixedCount(): number {
    return this.state.filter((s) => s === 'fixed').length;
  }

  get done(): boolean {
    return this.fixedCount === this.pieces.length;
  }

  /** 0..1 how much is built. */
  get progress(): number {
    return this.fixedCount / this.pieces.length;
  }

  /** Whether a piece may be picked up right now. */
  canDrag(piece: number): boolean {
    return this.state[piece] === 'tray' && this.pending < 0;
  }

  private fits(piece: number, slot: number): boolean {
    const p = this.pieces[piece]!;
    const s = this.pieces[slot]!;
    return p.material === s.material && p.w === s.w && p.h === s.h;
  }

  /**
   * Drop a piece with its centre at (x, y) blueprint units. It goes into the nearest free slot it
   * fits within `snap`; over a slot of another kind it bounces back; anywhere else it just
   * returns to the tray.
   */
  drop(piece: number, x: number, y: number): BuildEvent | null {
    if (!this.canDrag(piece)) return null;
    let best = -1;
    let bestD = Infinity;
    let wrong = false;
    this.pieces.forEach((s, slot) => {
      if (this.slotPiece[slot]! >= 0) return;
      const d = Math.hypot(s.x + s.w / 2 - x, s.y + s.h / 2 - y);
      if (d > this.snap) return;
      if (!this.fits(piece, slot)) {
        wrong = true;
        return;
      }
      if (d < bestD) {
        bestD = d;
        best = slot;
      }
    });
    if (best < 0) return { type: wrong ? 'wrongSlot' : 'missed', piece };
    this.state[piece] = 'placed';
    this.slotPiece[best] = piece;
    this.wrongTools = 0;
    return { type: 'placed', piece, slot: best };
  }

  /** Put the next tray piece straight into a slot it fits (keyboard play and tests). */
  placeNext(): BuildEvent | null {
    const piece = this.state.findIndex((s, i) => s === 'tray' && this.canDrag(i));
    if (piece < 0) return null;
    const slot = this.pieces.findIndex((_, i) => this.slotPiece[i]! < 0 && this.fits(piece, i));
    if (slot < 0) return null;
    const s = this.pieces[slot]!;
    return this.drop(piece, s.x + s.w / 2, s.y + s.h / 2);
  }

  /** The tool the waiting piece needs, or null if nothing is waiting. */
  get toolNeeded(): Tool | null {
    const p = this.pending;
    return p < 0 ? null : TOOL_FOR[this.pieces[p]!.material];
  }

  /** Pick a tool for the piece that is waiting. */
  fasten(tool: Tool): BuildEvent | null {
    const piece = this.pending;
    if (piece < 0) return null;
    const need = TOOL_FOR[this.pieces[piece]!.material];
    if (tool !== need) {
      this.wrongTools++;
      return {
        type: 'wrongTool',
        tool,
        hint: this.wrongTools >= BUILD_IT.wrongToolsForHint ? need : null,
      };
    }
    this.state[piece] = 'fixed';
    this.wrongTools = 0;
    return { type: 'fixed', piece, slot: this.slotPiece.indexOf(piece), done: this.done };
  }
}

/** A plain little wall, for a build spot with no blueprint of its own. */
export const DEFAULT_BLUEPRINT: Blueprint = {
  id: 'default',
  pieces: [
    { material: 'brick', x: 0, y: 2, w: 2, h: 1 },
    { material: 'brick', x: 2, y: 2, w: 2, h: 1 },
    { material: 'brick', x: 1, y: 1, w: 2, h: 1 },
    { material: 'wood', x: 0, y: 0.4, w: 4, h: 0.6 },
  ],
};
