import { z } from 'zod';

export const Errand = z.object({
  id: z.string(),
  kind: z.enum(['find', 'deliver', 'return']),
  /** Townsperson id (a map marker) who asks for help. */
  giver: z.string(),
  /** Picture in the giver's bubble. */
  icon: z.string(),
  item: z.string(),
  /** Deliver: who to take the item to (townsperson id). */
  destination: z.string().optional(),
  /** Find: map marker where the lost item lies. */
  spot: z.string().optional(),
  reward: z.number().int().positive(),
  job: z.enum(['cop', 'fire', 'builder']).optional(),
  /** Voice line the giver says when you come near (spec 006). */
  voice: z.string().optional(),
  /** Offered once this mission has been finished (new errands appear after missions). */
  after: z.string().optional(),
});
export type Errand = z.infer<typeof Errand>;
export const ErrandList = z.array(Errand).superRefine((list, ctx) => {
  for (const e of list) {
    if (e.kind === 'deliver' && !e.destination)
      ctx.addIssue({ code: 'custom', message: `${e.id}: deliver needs a destination` });
    if (e.kind === 'find' && !e.spot)
      ctx.addIssue({ code: 'custom', message: `${e.id}: find needs a spot` });
  }
});

export type ErrandStatus = 'hidden' | 'offered' | 'done';

/** What the player is carrying (picked-up items). */
export type Inventory = Record<string, number>;

/**
 * Errand lifecycle: hidden -> offered (the giver shows a picture bubble) -> done.
 * - Return: bring at least one of the item (robber loot) back to the giver.
 * - Find: pick up the lost item at its spot and bring it to the giver.
 * - Deliver: the giver hands you the item; bring it to the destination.
 * All carried items of that kind are handed over.
 */
export class ErrandBook {
  private status = new Map<string, ErrandStatus>();
  private readonly byId: Map<string, Errand>;

  constructor(errands: Errand[]) {
    this.byId = new Map(errands.map((e) => [e.id, e]));
    for (const e of errands) this.status.set(e.id, 'hidden');
  }

  get all(): Errand[] {
    return [...this.byId.values()];
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

  /** Who the player must bring the item to: the destination for Deliver, else the giver. */
  receiver(id: string): string {
    const e = this.get(id);
    return e.kind === 'deliver' ? e.destination! : e.giver;
  }

  canComplete(id: string, inv: Inventory): boolean {
    const e = this.get(id);
    if (this.statusOf(id) !== 'offered') return false;
    return (inv[e.item] ?? 0) > 0;
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
    return this.all.filter((e) => e.giver === giver && this.statusOf(e.id) === 'offered');
  }

  /** Errands that become available once these missions are done (and aren't done yet). */
  unlockedBy(
    missionsDone: Readonly<Record<string, number>>,
    errandsDone: readonly string[],
  ): Errand[] {
    return this.all.filter(
      (e) =>
        e.after !== undefined && (missionsDone[e.after] ?? 0) > 0 && !errandsDone.includes(e.id),
    );
  }
}
