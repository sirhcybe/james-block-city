/**
 * Who Took It? (Cop minigame, pure model). Five suspects stand in a line-up; one of them has the
 * clue (frosting on his face, a feather in his hair, a sock on his head). Tap him. A wrong tap gets
 * a funny "not me!" shrug and nothing else: no fail, no lost points. About 2 minutes; the score is
 * how many rounds you solved. On replay the clue gets smaller and the suspects shuffle sooner.
 */
export const CLUES = ['frosting', 'feather', 'sock'] as const;
export type Clue = (typeof CLUES)[number];

export const WTI = {
  suspects: 5,
  /** Clue size (1 = big) at the first play, and the smallest it ever gets. */
  clueScale: 1,
  minClueScale: 0.45,
  /** Seconds the line-up stands still before they shuffle places (0 = never). */
  shuffleAfter: 0,
  minShuffleAfter: 3,
  /** Seconds between rounds (cheer time). */
  betweenSec: 1.2,
};

export interface Round {
  clue: Clue;
  /** Index (0..4) of the suspect with the clue. */
  culprit: number;
  /** Look id per suspect. */
  looks: string[];
}

export type WTIEvent =
  | { type: 'round'; round: Round }
  | { type: 'right'; suspect: number }
  | { type: 'wrong'; suspect: number }
  | { type: 'shuffle'; order: number[] }
  | { type: 'finished' };

const SUSPECT_LOOKS = [
  'pickles',
  'smudge',
  'walkerRed',
  'walkerGreen',
  'walkerBlue',
  'walkerPurple',
];

export class WhoTookItModel {
  score = 0;
  wrong = 0;
  elapsed = 0;
  round: Round | null = null;
  finished = false;
  readonly clueScale: number;
  readonly shuffleAfter: number;
  private betweenLeft = 0;
  private sinceRound = 0;
  private shuffled = false;

  constructor(
    readonly durationSec: number,
    readonly plays: number,
    readonly step: number,
    private readonly rand: () => number = Math.random,
  ) {
    const d = Math.min(1, plays * step);
    this.clueScale = WTI.clueScale - (WTI.clueScale - WTI.minClueScale) * d;
    // First plays: no shuffling. Later: they shuffle after a while, sooner each replay.
    this.shuffleAfter = plays === 0 ? 0 : Math.max(WTI.minShuffleAfter, 9 - plays * 1.5);
  }

  /** Start the next line-up. */
  nextRound(): Round {
    const clue = CLUES[Math.floor(this.rand() * CLUES.length)]!;
    const pool = [...SUSPECT_LOOKS];
    const looks: string[] = [];
    for (let i = 0; i < WTI.suspects; i++) {
      const k = Math.floor(this.rand() * pool.length);
      looks.push(pool.splice(k, 1)[0]!);
    }
    this.round = { clue, culprit: Math.floor(this.rand() * WTI.suspects), looks };
    this.sinceRound = 0;
    this.shuffled = false;
    return this.round;
  }

  /** The player tapped suspect i. */
  tap(i: number): WTIEvent | null {
    if (this.finished || !this.round || this.betweenLeft > 0) return null;
    if (i === this.round.culprit) {
      this.score++;
      this.betweenLeft = WTI.betweenSec;
      return { type: 'right', suspect: i };
    }
    this.wrong++;
    return { type: 'wrong', suspect: i };
  }

  update(dt: number): WTIEvent[] {
    if (this.finished) return [];
    const out: WTIEvent[] = [];
    this.elapsed += dt;
    if (!this.round) out.push({ type: 'round', round: this.nextRound() });
    if (this.betweenLeft > 0) {
      this.betweenLeft -= dt;
      if (this.betweenLeft <= 0) {
        this.betweenLeft = 0;
        if (this.elapsed >= this.durationSec) {
          this.finished = true;
          out.push({ type: 'finished' });
          return out;
        }
        out.push({ type: 'round', round: this.nextRound() });
      }
      return out;
    }
    this.sinceRound += dt;
    if (
      this.shuffleAfter > 0 &&
      !this.shuffled &&
      this.sinceRound >= this.shuffleAfter &&
      this.round
    ) {
      // Swap places: the culprit moves, so you have to look again.
      this.shuffled = true;
      const order = [...Array(WTI.suspects).keys()];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1));
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      const r = this.round;
      r.looks = order.map((k) => r.looks[k]!);
      r.culprit = order.indexOf(r.culprit);
      out.push({ type: 'shuffle', order });
    }
    // Time is up: finish after the current line-up is solved, or right away if it runs long.
    if (this.elapsed >= this.durationSec + 15) {
      this.finished = true;
      out.push({ type: 'finished' });
    }
    return out;
  }
}
