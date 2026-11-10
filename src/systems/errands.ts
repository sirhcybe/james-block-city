import { z } from 'zod';

export const Errand = z.object({
  id: z.string(),
  kind: z.enum(['find', 'deliver', 'return']),
  giver: z.string(),
  icon: z.string(),
  item: z.string(),
  destination: z.string().optional(),
  reward: z.number().int().positive(),
  job: z.enum(['cop', 'fire', 'builder']).optional(),
});
export type Errand = z.infer<typeof Errand>;
export const ErrandList = z.array(Errand);

export type ErrandStatus = 'hidden' | 'offered' | 'done';

/** What the player is carrying (picked-up items). */
export type Inventory = Record<string, number>;

/**
 * Errand lifecycle: hidden -> offered (the giver shows a picture bubble) -> done.
 * A "return" errand completes when the player brings at least one of the item back to the giver;
 * all carried items of that kind are handed over.
 */
export class ErrandBook {
  private status = new Map<string, ErrandStatus>();
  private readonly byId: Map<string, Errand>;

  constructor(errands: Errand[]) {
    this.byId = new Map(errands.map((e) => [e.id, e]));
    for (const e of errands) this.status.set(e.id, 'hidden');
  }

  get(id: string): Errand {
    const e = this.byId.get(id);
    if (!e) throw new Error(`no errand ${id}`);
    return e;
  }

  statusOf(id: string): ErrandStatus {
    return this.status.get(id) ?? 'hidden';
  }

  /** Make the errand available (again). Done errands can be re-offered when new loot appears. */
  offer(id: string): void {
    this.get(id);
    this.status.set(id, 'offered');
  }

  canComplete(id: string, inv: Inventory): boolean {
    const e = this.get(id);
    if (this.statusOf(id) !== 'offered') return false;
    if (e.kind === 'return' || e.kind === 'deliver' || e.kind === 'find')
      return (inv[e.item] ?? 0) > 0;
    return false;
  }

  /** Complete the errand: removes the items from the inventory and returns the coin reward. */
  complete(id: string, inv: Inventory): { reward: number; handedOver: number } | null {
    if (!this.canComplete(id, inv)) return null;
    const e = this.get(id);
    const handedOver = inv[e.item] ?? 0;
    inv[e.item] = 0;
    this.status.set(id, 'done');
    return { reward: e.reward, handedOver };
  }

  /** Errands offered by a given townsperson. */
  offeredBy(giver: string): Errand[] {
    return [...this.byId.values()].filter(
      (e) => e.giver === giver && this.statusOf(e.id) === 'offered',
    );
  }
}
