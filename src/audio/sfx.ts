import { sfxr } from 'jsfxr';

/**
 * Sound effects. Blips are fixed jsfxr presets (checked in here, no audio files); the siren is a
 * two-tone oscillator sweep because that's what a siren is. Everything is silent until unlock()
 * runs inside a user gesture (Android/Chrome autoplay rules).
 */

type SfxrParams = Record<string, number | boolean>;

const BASE: SfxrParams = {
  oldParams: true,
  wave_type: 0,
  p_env_attack: 0,
  p_env_sustain: 0.1,
  p_env_punch: 0,
  p_env_decay: 0.2,
  p_base_freq: 0.3,
  p_freq_limit: 0,
  p_freq_ramp: 0,
  p_freq_dramp: 0,
  p_vib_strength: 0,
  p_vib_speed: 0,
  p_arp_mod: 0,
  p_arp_speed: 0,
  p_duty: 0.5,
  p_duty_ramp: 0,
  p_repeat_speed: 0,
  p_pha_offset: 0,
  p_pha_ramp: 0,
  p_lpf_freq: 1,
  p_lpf_ramp: 0,
  p_lpf_resonance: 0,
  p_hpf_freq: 0,
  p_hpf_ramp: 0,
  sound_vol: 0.25,
  sample_rate: 44100,
  sample_size: 8,
};

/** The slice's sound palette. Waves: 0 square, 1 sawtooth, 2 sine, 3 noise. */
export const PRESETS = {
  coin: {
    wave_type: 1,
    p_base_freq: 0.55,
    p_env_sustain: 0.05,
    p_env_punch: 0.45,
    p_env_decay: 0.3,
    p_arp_speed: 0.6,
    p_arp_mod: 0.35,
  },
  boing: {
    wave_type: 2,
    p_base_freq: 0.25,
    p_freq_ramp: 0.22,
    p_env_sustain: 0.18,
    p_env_decay: 0.3,
    p_vib_strength: 0.45,
    p_vib_speed: 0.55,
    sound_vol: 0.35,
  },
  bump: {
    wave_type: 3,
    p_base_freq: 0.18,
    p_freq_ramp: -0.35,
    p_env_sustain: 0.05,
    p_env_punch: 0.4,
    p_env_decay: 0.22,
  },
  quack: {
    wave_type: 1,
    p_base_freq: 0.3,
    p_freq_ramp: -0.18,
    p_env_sustain: 0.07,
    p_env_decay: 0.14,
    p_lpf_freq: 0.45,
    p_vib_strength: 0.5,
    p_vib_speed: 0.7,
  },
  horn: {
    wave_type: 0,
    p_base_freq: 0.24,
    p_env_sustain: 0.22,
    p_env_decay: 0.08,
    p_duty: 0.35,
    p_arp_mod: -0.25,
    p_arp_speed: 0.55,
    sound_vol: 0.2,
  },
  pop: { wave_type: 0, p_base_freq: 0.6, p_env_sustain: 0.03, p_env_decay: 0.1, p_freq_ramp: 0.2 },
  tada: {
    wave_type: 0,
    p_base_freq: 0.32,
    p_freq_ramp: 0.2,
    p_env_sustain: 0.3,
    p_env_decay: 0.4,
    p_repeat_speed: 0.55,
    p_duty: 0.4,
    sound_vol: 0.22,
  },
  honk: {
    wave_type: 0,
    p_base_freq: 0.2,
    p_env_sustain: 0.15,
    p_env_decay: 0.05,
    p_duty: 0.2,
    sound_vol: 0.15,
  },
  sputter: {
    wave_type: 3,
    p_base_freq: 0.12,
    p_env_sustain: 0.3,
    p_env_decay: 0.3,
    p_repeat_speed: 0.7,
    sound_vol: 0.2,
  },
  woof: {
    wave_type: 1,
    p_base_freq: 0.32,
    p_env_attack: 0.01,
    p_env_sustain: 0.06,
    p_env_decay: 0.12,
    p_freq_ramp: -0.35,
    p_lpf_freq: 0.5,
  },
  whoosh: {
    wave_type: 3,
    p_base_freq: 0.5,
    p_env_attack: 0.05,
    p_env_sustain: 0.1,
    p_env_decay: 0.2,
    p_freq_ramp: -0.2,
    p_lpf_freq: 0.4,
  },
  whistle: {
    wave_type: 2,
    p_base_freq: 0.75,
    p_env_sustain: 0.2,
    p_env_decay: 0.1,
    p_vib_strength: 0.3,
    p_vib_speed: 0.6,
  },
  sparkle: {
    wave_type: 0,
    p_base_freq: 0.7,
    p_env_sustain: 0.05,
    p_env_decay: 0.3,
    p_arp_mod: 0.5,
    p_arp_speed: 0.6,
  },
  shrug: {
    wave_type: 2,
    p_base_freq: 0.35,
    p_env_sustain: 0.08,
    p_env_decay: 0.15,
    p_freq_ramp: 0.15,
    p_vib_strength: 0.2,
    p_vib_speed: 0.5,
  },
  splash: {
    wave_type: 3,
    p_base_freq: 0.6,
    p_env_attack: 0.02,
    p_env_sustain: 0.12,
    p_env_decay: 0.3,
    p_freq_ramp: -0.1,
    p_lpf_freq: 0.6,
  },
  thunk: {
    wave_type: 1,
    p_base_freq: 0.18,
    p_env_sustain: 0.04,
    p_env_decay: 0.14,
    p_freq_ramp: -0.3,
  },
} satisfies Record<string, SfxrParams>;

export type SfxName = keyof typeof PRESETS;

const SIREN_SEC = 1.6;

class SoundBoard {
  private ctx: AudioContext | null = null;
  private buffers = new Map<SfxName, AudioBuffer>();
  private siren: { osc: OscillatorNode; gain: GainNode } | null = null;
  private lastCoinAt = -Infinity;
  private coinStreak = 0;
  muted = false;
  /** Grown-up corner sound level (0 / 0.5 / 1, spec 007). */
  level = 1;
  /** Counts for tests/debugging. */
  readonly played: Record<string, number> = {};

  get unlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Call from inside a user gesture (e.g. the Play tap). Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.render();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null; // no audio available: play silently
    }
  }

  private render(): void {
    const ctx = this.ctx!;
    for (const [name, p] of Object.entries(PRESETS) as [SfxName, SfxrParams][]) {
      const src = sfxr.toWebAudio({ ...BASE, ...p }, ctx) as AudioBufferSourceNode | undefined;
      if (src?.buffer) this.buffers.set(name, src.buffer);
    }
  }

  private count(name: string): void {
    this.played[name] = (this.played[name] ?? 0) + 1;
  }

  play(name: SfxName, rate = 1, volume = 1): void {
    this.count(name);
    const ctx = this.ctx;
    const buf = this.buffers.get(name);
    if (!ctx || !buf || this.muted || this.level <= 0) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = volume * this.level;
    src.connect(gain).connect(ctx.destination);
    src.start();
  }

  /** Coin ding whose pitch rises while coins keep coming (streak). */
  coin(): void {
    const now = performance.now();
    this.coinStreak = now - this.lastCoinAt < 600 ? Math.min(this.coinStreak + 1, 12) : 0;
    this.lastCoinAt = now;
    this.play('coin', 1 + this.coinStreak * 0.06);
  }

  /**
   * Wee-oo! Each press restarts the siren (so spamming never stacks voices): two tones alternating
   * with a short glide, for about 1.6 s.
   */
  sirenBlast(): void {
    this.count('siren');
    const ctx = this.ctx;
    if (!ctx || this.muted || this.level <= 0) return;
    this.stopSiren();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    const t0 = ctx.currentTime;
    const hi = 960;
    const lo = 720;
    osc.frequency.setValueAtTime(hi, t0);
    for (let i = 0; i < 4; i++) {
      const t = t0 + i * 0.4;
      osc.frequency.setValueAtTime(i % 2 === 0 ? hi : lo, t);
      osc.frequency.linearRampToValueAtTime(i % 2 === 0 ? hi * 0.97 : lo * 1.03, t + 0.38);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    const peak = 0.07 * this.level;
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.03);
    gain.gain.setValueAtTime(peak, t0 + SIREN_SEC - 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + SIREN_SEC);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + SIREN_SEC + 0.05);
    this.siren = { osc, gain };
    osc.onended = () => {
      if (this.siren?.osc === osc) this.siren = null;
    };
  }

  private stopSiren(): void {
    if (!this.siren || !this.ctx) return;
    const { osc, gain } = this.siren;
    try {
      gain.gain.cancelScheduledValues(this.ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      osc.stop();
    } catch {
      // already stopped
    }
    this.siren = null;
  }
}

export const sfx = new SoundBoard();
