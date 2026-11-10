import type { VoiceLines } from '../content';

/**
 * Spoken prompts (they replace all on-screen text). Placeholder: Web Speech API, en-US, rate 0.95,
 * pitch 1.2. Later, real recordings at public/voice/<lineId>.mp3 replace these by the same id.
 * The text is never shown on screen.
 */
class VoiceBox {
  private lines: VoiceLines = {};
  private lastSaid = new Map<string, number>();
  /** Line ids spoken, for tests/debugging. */
  readonly log: string[] = [];

  setLines(lines: VoiceLines): void {
    this.lines = lines;
  }

  private get synth(): SpeechSynthesis | null {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;
  }

  /** Must run inside a user gesture once (Android needs it before any speech). */
  unlock(): void {
    const s = this.synth;
    if (!s) return;
    try {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      s.speak(u);
    } catch {
      // ignore
    }
  }

  /**
   * Say a line by id. `interrupt` cuts off whatever is being said (for urgent prompts).
   * `minGapMs` stops the same line repeating too often (e.g. "whoa!").
   */
  say(id: string, opts: { interrupt?: boolean; minGapMs?: number } = {}): void {
    const text = this.lines[id];
    if (!text) return;
    const now = Date.now();
    const last = this.lastSaid.get(id) ?? -Infinity;
    if (opts.minGapMs !== undefined && now - last < opts.minGapMs) return;
    this.lastSaid.set(id, now);
    this.log.push(id);
    const s = this.synth;
    if (!s) return;
    try {
      if (opts.interrupt) s.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.95;
      u.pitch = 1.2;
      s.speak(u);
    } catch {
      // Speech unavailable: the arrows and pictures still guide the player.
    }
  }
}

export const voice = new VoiceBox();
