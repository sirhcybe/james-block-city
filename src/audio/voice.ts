import type { VoiceLines } from '../content';

/** How long to wait after cancel() before speak(). Chrome on macOS drops a speak() that follows a
 * cancel() too closely, so an interrupting line would never be heard. */
const AFTER_CANCEL_MS = 80;

/**
 * Spoken prompts (they replace all on-screen text). Placeholder: Web Speech API, en-US, rate 0.95,
 * pitch 1.2. Later, real recordings at public/voice/<lineId>.mp3 replace these by the same id.
 * The text is never shown on screen.
 */
class VoiceBox {
  private lines: VoiceLines = {};
  private lastSaid = new Map<string, number>();
  /** Chosen English voice; null lets the browser pick from `lang`. */
  private chosen: SpeechSynthesisVoice | null = null;
  /** Utterances queued or speaking. Holding them stops Chrome garbage-collecting one mid-line
   * (it then goes silent and never fires `end`). */
  private live = new Set<SpeechSynthesisUtterance>();
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  /** Line ids spoken, for tests/debugging. */
  readonly log: string[] = [];
  /** Grown-up corner voice level (0 / 0.5 / 1, spec 007). */
  level = 1;

  setLines(lines: VoiceLines): void {
    this.lines = lines;
    this.watchVoices();
  }

  private get synth(): SpeechSynthesis | null {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;
  }

  /** Voices load late in Chrome (empty list at first), so pick again when they arrive. */
  private watchVoices(): void {
    const s = this.synth;
    if (!s) return;
    this.pickVoice();
    try {
      s.addEventListener('voiceschanged', () => this.pickVoice());
    } catch {
      // older engines: lang alone still works
    }
  }

  /** Prefer an on-device US English voice (works offline and starts fast), then any English one. */
  private pickVoice(): void {
    const s = this.synth;
    if (!s) return;
    let voices: SpeechSynthesisVoice[];
    try {
      voices = s.getVoices();
    } catch {
      return;
    }
    if (voices.length === 0) return;
    const isUS = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase() === 'en-us';
    const isEn = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().startsWith('en');
    this.chosen =
      voices.find((v) => isUS(v) && v.localService && v.default) ??
      voices.find((v) => isUS(v) && v.localService) ??
      voices.find((v) => isUS(v)) ??
      voices.find((v) => isEn(v) && v.localService) ??
      voices.find(isEn) ??
      null;
  }

  /** Must run inside a user gesture once (Android and macOS Chrome need it before any speech). */
  unlock(): void {
    const s = this.synth;
    if (!s) return;
    try {
      s.resume();
      // A space, not '': an empty utterance can stall Chrome's speech queue on macOS.
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      this.speakNow(s, u);
    } catch {
      // ignore
    }
  }

  private speakNow(s: SpeechSynthesis, u: SpeechSynthesisUtterance): void {
    this.live.add(u);
    const done = () => this.live.delete(u);
    u.onend = done;
    u.onerror = done;
    // Chrome on macOS can be left "paused" (e.g. after the tab was hidden) and then queues forever.
    s.resume();
    s.speak(u);
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
      if (this.level <= 0) {
        if (opts.interrupt) s.cancel();
        return;
      }
      if (!this.chosen) this.pickVoice();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      if (this.chosen) u.voice = this.chosen;
      u.rate = 0.95;
      u.pitch = 1.2;
      u.volume = this.level;

      const busy = this.pendingTimer !== null || s.speaking || s.pending;
      if (opts.interrupt && busy) {
        // Drop any line still waiting from an earlier interrupt; newest wins.
        if (this.pendingTimer !== null) clearTimeout(this.pendingTimer);
        s.cancel();
        this.live.clear();
        this.pendingTimer = setTimeout(() => {
          this.pendingTimer = null;
          try {
            this.speakNow(s, u);
          } catch {
            // ignore
          }
        }, AFTER_CANCEL_MS);
        return;
      }
      if (this.pendingTimer !== null) {
        // An interrupting line is about to start; queue behind it rather than jump ahead.
        setTimeout(() => {
          try {
            this.speakNow(s, u);
          } catch {
            // ignore
          }
        }, AFTER_CANCEL_MS + 5);
        return;
      }
      this.speakNow(s, u);
    } catch {
      // Speech unavailable: the arrows and pictures still guide the player.
    }
  }
}

export const voice = new VoiceBox();
