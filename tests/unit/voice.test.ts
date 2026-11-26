import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Fake speech engine that copies Chrome-on-macOS: a speak() right after cancel() is dropped. */
class FakeSynth {
  heard: string[] = [];
  speaking = false;
  pending = false;
  private lastCancel = -Infinity;
  private listeners: (() => void)[] = [];
  voices: { lang: string; localService: boolean; default: boolean; name: string }[] = [];
  getVoices() {
    return this.voices;
  }
  addEventListener(_t: string, fn: () => void) {
    this.listeners.push(fn);
  }
  fireVoicesChanged() {
    this.listeners.forEach((f) => f());
  }
  resume() {}
  cancel() {
    this.lastCancel = Date.now();
    this.speaking = false;
  }
  speak(u: { text: string; volume: number }) {
    if (Date.now() - this.lastCancel < 20) return; // the macOS bug
    if (u.volume > 0 && u.text.trim()) this.heard.push(u.text);
    this.speaking = true;
  }
}

class FakeUtterance {
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: unknown = null;
  onend: unknown = null;
  onerror: unknown = null;
  constructor(public text: string) {}
}

describe('voice on Chrome for macOS', () => {
  let synth: FakeSynth;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    synth = new FakeSynth();
    vi.stubGlobal('window', { speechSynthesis: synth });
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('still speaks an interrupting line after cutting off the last one', async () => {
    const { voice } = await import('../../src/audio/voice');
    voice.setLines({ a: 'first line', b: 'second line' });
    voice.unlock();
    voice.say('a', { interrupt: true });
    voice.say('b', { interrupt: true });
    vi.advanceTimersByTime(200);
    expect(synth.heard).toEqual(['second line']);
  });

  it('picks an on-device US English voice once voices load', async () => {
    const { voice } = await import('../../src/audio/voice');
    voice.setLines({ a: 'hello' });
    synth.voices = [
      { name: 'Google US English', lang: 'en-US', localService: false, default: false },
      { name: 'Samantha', lang: 'en-US', localService: true, default: true },
    ];
    synth.fireVoicesChanged();
    const spoken: FakeUtterance[] = [];
    synth.speak = (u) => void spoken.push(u as unknown as FakeUtterance);
    voice.say('a');
    expect((spoken[0]?.voice as { name: string }).name).toBe('Samantha');
  });
});
