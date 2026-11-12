/**
 * The apartment layout (spec 006, pure): a 6×4 floor grid where owned furniture can be placed, one
 * item per square. Items not placed wait in the tray. Saved as `apartment: {item, gx, gy}[]`.
 */
export const ROOM = { cols: 6, rows: 4 };

export interface Placed {
  item: string;
  gx: number;
  gy: number;
}

export class ApartmentLayout {
  readonly placed: Placed[];

  constructor(
    saved: readonly Placed[],
    private readonly owned: readonly string[],
  ) {
    // Keep only owned items, inside the room, one per square and one of each item.
    const seen = new Set<string>();
    this.placed = [];
    for (const p of saved) {
      if (!owned.includes(p.item) || seen.has(p.item)) continue;
      if (!this.inRoom(p.gx, p.gy) || this.at(p.gx, p.gy)) continue;
      seen.add(p.item);
      this.placed.push({ ...p });
    }
  }

  inRoom(gx: number, gy: number): boolean {
    return (
      Number.isInteger(gx) &&
      Number.isInteger(gy) &&
      gx >= 0 &&
      gy >= 0 &&
      gx < ROOM.cols &&
      gy < ROOM.rows
    );
  }

  at(gx: number, gy: number): Placed | undefined {
    return this.placed.find((p) => p.gx === gx && p.gy === gy);
  }

  /** Owned furniture not on the floor (shown in the tray), in owned order. */
  tray(furniture: readonly string[]): string[] {
    return furniture.filter(
      (f) => this.owned.includes(f) && !this.placed.some((p) => p.item === f),
    );
  }

  /** Put an item on a square (from the tray or moved). False if it can't go there. */
  place(item: string, gx: number, gy: number): boolean {
    if (!this.owned.includes(item) || !this.inRoom(gx, gy)) return false;
    const there = this.at(gx, gy);
    if (there && there.item !== item) return false;
    const i = this.placed.findIndex((p) => p.item === item);
    if (i >= 0) this.placed.splice(i, 1);
    this.placed.push({ item, gx, gy });
    return true;
  }

  /** Back to the tray. */
  remove(item: string): void {
    const i = this.placed.findIndex((p) => p.item === item);
    if (i >= 0) this.placed.splice(i, 1);
  }

  /** The first free square (for a tap-to-place fallback). */
  free(): { gx: number; gy: number } | null {
    for (let gy = 0; gy < ROOM.rows; gy++)
      for (let gx = 0; gx < ROOM.cols; gx++) if (!this.at(gx, gy)) return { gx, gy };
    return null;
  }

  toSave(): Placed[] {
    return this.placed.map((p) => ({ ...p }));
  }
}
