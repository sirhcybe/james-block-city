import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { addBakedImage, getBaked } from '../art/blocks';
import { buildingTextureKey } from '../art/buildings';
import { CHAR_FOOT_Y, CHAR_H, characterFrameKey } from '../art/characters';
import { RS, WT } from '../art/renderScale';
import { iconKey } from '../art/menu';
import { PLAY_SIZE, UI } from '../art/ui';
import { GAME_H, GAME_W, PALETTE } from '../config';
import type { MapDef } from '../content/schema';
import { gridToScreen } from '../iso/projection';
import { MAP_KEY } from './keys';

/** Picture-only title: a little block skyline and one big Play button. No words. */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0).setBackgroundColor(PALETTE.water);

    // Sky + grass hill.
    const bg = this.add.graphics();
    bg.fillStyle(0x9fdcff, 1);
    bg.fillRect(0, 0, GAME_W, GAME_H);
    bg.fillStyle(PALETTE.grass, 1);
    bg.fillEllipse(GAME_W / 2, GAME_H + 120, GAME_W * 1.5, 520);
    bg.lineStyle(4, PALETTE.outline, 1);
    bg.strokeEllipse(GAME_W / 2, GAME_H + 120, GAME_W * 1.5, 520);

    // A few buildings from the plaza as a skyline.
    const map = this.registry.get(MAP_KEY) as MapDef;
    const showcase: [string, number][] = [
      ['tower-west', 250],
      ['city-hall', 480],
      ['house-east', 800],
      ['tower-east', 1030],
    ];
    const baseline = 650;
    for (const [id, x] of showcase) {
      const b = map.buildings.find((d) => d.id === id);
      if (!b) continue;
      // Texture origin is the north corner; put the south corner on the baseline.
      const south = gridToScreen(b.w, b.d);
      addBakedImage(this, getBaked(buildingTextureKey(b)), x - south.x, baseline - south.y);
    }

    const hero = this.add
      .image(650, baseline + 20, characterFrameKey('player', 'SW', 0))
      .setOrigin(0.5, CHAR_FOOT_Y / CHAR_H)
      .setScale(1.6 / WT)
      .setDepth(5000);
    this.tweens.add({
      targets: hero,
      y: hero.y - 12,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Big Play button (≥ 64 px; here 200 px).
    const play = this.add
      .image(GAME_W / 2, 250, UI.play)
      .setScale(1 / RS)
      .setDepth(10000)
      .setInteractive(
        new Phaser.Geom.Circle(
          (PLAY_SIZE / 2 + 6) * RS,
          (PLAY_SIZE / 2 + 6) * RS,
          (PLAY_SIZE / 2) * RS,
        ),
        Phaser.Geom.Circle.Contains,
      );
    play.setName('play');
    this.tweens.add({
      targets: play,
      scale: { from: 1 / RS, to: 1.08 / RS },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      // Audio and speech must be unlocked inside this tap (Android / Chrome rules).
      sfx.unlock();
      voice.unlock();
      sfx.play('pop');
      this.tweens.killTweensOf(play);
      this.tweens.add({
        targets: play,
        scale: 0.6 / RS,
        duration: 120,
        yoyo: true,
        onComplete: () => this.scene.start('City'),
      });
    };
    play.on('pointerup', start);

    // Grown-up corner (spec 007): hold the small gear for 2 seconds. A tap does nothing.
    const gear = this.add
      .image(GAME_W - 60, 60, iconKey('gear'))
      .setScale(0.5 / RS)
      .setAlpha(0.7)
      .setDepth(10000)
      .setInteractive({ useHandCursor: true });
    gear.setName('gear');
    const ring = this.add.graphics().setDepth(10001);
    let hold: Phaser.Time.TimerEvent | null = null;
    const k = { v: 0 };
    const cancel = () => {
      hold?.remove();
      hold = null;
      this.tweens.killTweensOf(k);
      ring.clear();
    };
    gear.on('pointerdown', () => {
      cancel();
      k.v = 0;
      this.tweens.add({
        targets: k,
        v: 1,
        duration: 2000,
        onUpdate: () => {
          ring.clear().lineStyle(6, 0xffffff, 1);
          ring.beginPath();
          ring.arc(GAME_W - 60, 60, 38, -Math.PI / 2, -Math.PI / 2 + k.v * Math.PI * 2);
          ring.strokePath();
        },
      });
      hold = this.time.delayedCall(2000, () => {
        cancel();
        this.scene.pause();
        this.scene.launch('GrownUp');
      });
    });
    gear.on('pointerup', cancel);
    gear.on('pointerout', cancel);
    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.keyboard?.once('keydown-SPACE', start);
  }
}
