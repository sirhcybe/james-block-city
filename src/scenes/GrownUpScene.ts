import { isJobMission } from '../systems/missions';
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W, PALETTE } from '../config';
import type { GameState } from '../systems/GameState';
import { defaultSave, SAVE_KEY } from '../systems/save';
import {
  LEVELS,
  loadSettings,
  saveSettings,
  unlockEverything,
  type Level,
  type Settings,
} from '../systems/settings';
import { STATE_KEY } from './keys';

const TEXT: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: '30px',
  color: '#ffffff',
  resolution: RS,
};
const LEVEL_NAMES: Record<Level, string> = { 0: 'Off', 0.5: 'Quiet', 1: 'Loud' };

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The grown-up corner (spec 007; GDD "Controls"): reached by holding the gear on the title for
 * 2 seconds. Sound and voice levels, "unlock everything", and a reset that needs a 3-second hold.
 * This page is for grown-ups, so it has short text labels.
 */
export class GrownUpScene extends Phaser.Scene {
  private settings!: Settings;
  private buttons = new Map<string, Phaser.GameObjects.Rectangle>();
  private resetRing!: Phaser.GameObjects.Graphics;
  private resetHold: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('GrownUp');
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    this.settings = loadSettings(storage());
    this.buttons.clear();
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x24304f, 0.97).setOrigin(0, 0);
    this.add.text(60, 40, 'Grown-up corner', { ...TEXT, fontSize: '40px', fontStyle: 'bold' });

    (['sound', 'voice'] as const).forEach((kind, row) => {
      const y = 170 + row * 110;
      this.add.text(60, y, kind === 'sound' ? 'Sound effects' : 'Voice', TEXT).setOrigin(0, 0.5);
      LEVELS.forEach((lvl, i) => {
        this.button(`${kind}-${lvl}`, 420 + i * 200, y, 170, 70, LEVEL_NAMES[lvl], () =>
          this.setLevel(kind, lvl),
        );
      });
    });
    this.refreshLevels();

    this.button('unlock', 300, 420, 480, 80, 'Unlock everything', () => this.unlockAll());
    this.add
      .text(560, 420, 'All three jobs, their upgrades and the finale.', {
        ...TEXT,
        fontSize: '22px',
      })
      .setOrigin(0, 0.5);

    const reset = this.button(
      'reset',
      300,
      530,
      480,
      80,
      'Reset save (hold 3 s)',
      () => undefined,
      0xb03030,
    );
    this.resetRing = this.add.graphics();
    reset.on('pointerdown', () => this.startResetHold());
    reset.on('pointerup', () => this.cancelResetHold());
    reset.on('pointerout', () => this.cancelResetHold());

    this.button('back', 160, 650, 220, 70, 'Back', () => this.close());
    this.input.keyboard?.once('keydown-ESC', () => this.close());
  }

  private button(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onTap: () => void,
    color = 0x3a5a9c,
  ): Phaser.GameObjects.Rectangle {
    const r = this.add
      .rectangle(x, y, w, h, color)
      .setStrokeStyle(4, 0xffffff)
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, TEXT).setOrigin(0.5);
    r.on('pointerup', onTap);
    this.buttons.set(id, r);
    return r;
  }

  private refreshLevels(): void {
    for (const kind of ['sound', 'voice'] as const)
      for (const lvl of LEVELS)
        this.buttons
          .get(`${kind}-${lvl}`)
          ?.setFillStyle(this.settings[kind] === lvl ? PALETTE.grass : 0x3a5a9c);
  }

  setLevel(kind: 'sound' | 'voice', lvl: Level): void {
    this.settings = { ...this.settings, [kind]: lvl };
    saveSettings(storage(), this.settings);
    sfx.level = this.settings.sound;
    voice.level = this.settings.voice;
    sfx.play('pop');
    this.refreshLevels();
  }

  unlockAll(): void {
    const state = this.registry.get(STATE_KEY) as GameState;
    const ids = state.content.missions.filter(isJobMission).map((m) => m.id);
    const u = unlockEverything(ids);
    state.save.update((s) => {
      for (const b of u.badges) if (!s.badges.includes(b)) s.badges.push(b);
      for (const o of u.owned) if (!s.owned.includes(o)) s.owned.push(o);
      for (const d of u.done) s.missionsDone[d] = Math.max(1, s.missionsDone[d] ?? 0);
    });
    state.save.flush();
    sfx.play('tada');
    this.buttons.get('unlock')?.setFillStyle(PALETTE.grass);
  }

  private startResetHold(): void {
    this.cancelResetHold();
    const r = this.buttons.get('reset')!;
    const k = { v: 0 };
    this.tweens.add({
      targets: k,
      v: 1,
      duration: 3000,
      onUpdate: () => {
        this.resetRing.clear().lineStyle(8, 0xffffff, 1);
        this.resetRing.beginPath();
        this.resetRing.arc(
          r.x + r.width / 2 + 50,
          r.y,
          28,
          -Math.PI / 2,
          -Math.PI / 2 + k.v * Math.PI * 2,
        );
        this.resetRing.strokePath();
      },
    });
    this.resetHold = this.time.delayedCall(3000, () => this.resetSave());
  }

  private cancelResetHold(): void {
    this.resetHold?.remove();
    this.resetHold = null;
    this.tweens.killAll();
    this.resetRing?.clear();
  }

  /** Start a fresh save (the volume settings stay) and reload the game. */
  resetSave(): void {
    // The game writes its save when the page unloads, so clear the one in memory too.
    const state = this.registry.get(STATE_KEY) as GameState;
    state.save.data = defaultSave();
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(defaultSave()));
    } catch {
      // nothing saved anyway
    }
    window.location.reload();
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('Title');
  }
}
