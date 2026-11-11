/**
 * Coins. Deliberately, the ONLY way to add coins is award() from a minigame, an errand or a mission.
 * Bumping, smashing or collecting things never pays (GDD "Comic action rules" #3). The only way
 * coins go down is spend() on a Shop item, and it never takes the total below zero.
 */
export const COIN_SOURCES = ['minigame', 'errand', 'mission'] as const;
export type CoinSource = (typeof COIN_SOURCES)[number];

export interface CoinChange {
  coins: number;
  delta: number;
  source: CoinSource | 'shop';
}

export class Economy {
  private _coins: number;
  private listeners = new Set<(c: CoinChange) => void>();

  constructor(startCoins = 0) {
    this._coins = Math.max(0, Math.floor(startCoins));
  }

  get coins(): number {
    return this._coins;
  }

  /** Add coins earned from a minigame, errand or mission. Returns the new total. */
  award(source: CoinSource, amount: number): number {
    if (!COIN_SOURCES.includes(source)) throw new Error(`coins cannot come from '${source}'`);
    if (!Number.isInteger(amount) || amount <= 0) throw new Error(`bad coin amount ${amount}`);
    this._coins += amount;
    this.emit({ coins: this._coins, delta: amount, source });
    return this._coins;
  }

  /** Pay for a Shop item. Returns false (and changes nothing) if there aren't enough coins. */
  spend(amount: number): boolean {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error(`bad price ${amount}`);
    if (amount > this._coins) return false;
    this._coins -= amount;
    this.emit({ coins: this._coins, delta: -amount, source: 'shop' });
    return true;
  }

  onChange(fn: (c: CoinChange) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private readonly emit = (c: CoinChange): void => {
    for (const l of this.listeners) l(c);
  };
}
