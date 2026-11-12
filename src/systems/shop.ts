import { z } from 'zod';
import { requirementMet, type Progress } from './missions';

export const ShopItem = z.object({
  id: z.string(),
  /** Picture on the card (an IconName). */
  icon: z.string(),
  price: z.number().int().positive(),
  job: z.enum(['cop', 'fire', 'builder']).optional(),
  /** Which Shop tab it's on (spec 006). */
  tab: z.enum(['job', 'hats', 'car', 'home']).default('job'),
  /** `badge:<job>` / `owned:<item>` / mission ids that must hold before it shows in the Shop. */
  requires: z.array(z.string()).default([]),
});
export type ShopItem = z.infer<typeof ShopItem>;
export const ShopList = z.array(ShopItem);

/** Average coins a minigame pays, for the "not yet" picture count of minigames still to play. */
export const COINS_PER_MINIGAME = 15;

/** Items on the shelf right now (unlocked; already-owned ones stay, marked as owned). */
export function shelf(items: readonly ShopItem[], p: Progress): ShopItem[] {
  return items.filter((i) => i.requires.every((r) => requirementMet(r, p)));
}

/** How many more minigames (pictures) the player needs to afford an item; 0 if affordable. */
export function minigamesShort(price: number, coins: number): number {
  return price <= coins ? 0 : Math.ceil((price - coins) / COINS_PER_MINIGAME);
}
