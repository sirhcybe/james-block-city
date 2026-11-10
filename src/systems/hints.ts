/**
 * "Can't get stuck": after `firstAfter` seconds without player input, fire a hint (arrow + voice),
 * then repeat every `repeatEvery` seconds while still idle. Any input resets it.
 */
export class IdleHints {
  idleFor = 0;
  private nextAt: number;

  constructor(
    readonly firstAfter = 20,
    readonly repeatEvery = 15,
  ) {
    this.nextAt = firstAfter;
  }

  /** Returns true on the frame a hint should be given. */
  update(dt: number, hadInput: boolean): boolean {
    if (hadInput) {
      this.reset();
      return false;
    }
    this.idleFor += dt;
    if (this.idleFor >= this.nextAt) {
      this.nextAt += this.repeatEvery;
      return true;
    }
    return false;
  }

  /** True while a hint is showing (from the first hint until the player acts). */
  get showing(): boolean {
    return this.idleFor >= this.firstAfter;
  }

  reset(): void {
    this.idleFor = 0;
    this.nextAt = this.firstAfter;
  }
}
