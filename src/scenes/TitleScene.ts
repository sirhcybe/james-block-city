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
import { boatFrameKey, RESCUE_BOAT, SEA } from '../art/boats';
import { HUD } from '../art/hud';
import { PROP } from '../art/props';
import { FIRE_TRUCK, MIXER_TRUCK, POLICE_CAR, vehicleFrameKey } from '../art/vehicles';
import type { GameState } from '../systems/GameState';
import { MAP_KEY, STATE_KEY } from './keys';

/**
 * The home screen (spec 008): the city's skyline on its island, the three heroes by their
 * vehicles, the boat on the sea, the game's name in bouncing blocks, and one big Play button.
 * Nothing needs reading: Play is a picture.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0).setBackgroundColor(PALETTE.water);
    const state = this.registry.get(STATE_KEY) as GameState | undefined;

    // Sky, sun and drifting clouds.
    const bg = this.add.graphics();
    [0x7fcbff, 0x93d5ff, 0xa9dfff, 0xc2eaff].forEach((c, i) =>
      bg.fillStyle(c, 1).fillRect(0, i * 110, GAME_W, 112),
    );
    bg.fillStyle(0xfff3a0, 0.5).fillCircle(150, 190, 86);
    bg.fillStyle(0xffe066, 1).fillCircle(150, 190, 56);
    for (let i = 0; i < 5; i++) {
      const c = this.add.graphics();
      c.fillStyle(0xffffff, 0.95);
      c.fillEllipse(0, 0, 170, 50).fillEllipse(-40, -20, 90, 52).fillEllipse(34, -26, 110, 62);
      c.setPosition(i * 300 - 60, 150 + (i % 3) * 46).setScale(0.6 + (i % 2) * 0.3);
      this.tweens.add({
        targets: c,
        x: c.x + 240,
        duration: 30000 + i * 5000,
        yoyo: true,
        repeat: -1,
      });
    }

    // The sea, with the wave tile sliding by, and the island the city stands on.
    const sea = this.add.graphics();
    sea.fillStyle(PALETTE.water, 1).fillRect(0, 430, GAME_W, GAME_H - 430);
    const waves = this.add.tileSprite(0, 430, GAME_W, GAME_H - 430, SEA.waves).setOrigin(0, 0);
    waves.setTileScale(0.6);
    this.tweens.add({ targets: waves, tilePositionX: 400, duration: 40000, repeat: -1 });
    const land = this.add.graphics();
    land.fillStyle(0xb98a5a, 1).fillEllipse(GAME_W / 2, GAME_H + 96, GAME_W * 1.12, 640);
    land
      .lineStyle(4, PALETTE.outline, 1)
      .strokeEllipse(GAME_W / 2, GAME_H + 96, GAME_W * 1.12, 640);
    land.fillStyle(PALETTE.grass, 1).fillEllipse(GAME_W / 2, GAME_H + 70, GAME_W * 1.12, 640);
    land
      .lineStyle(4, PALETTE.outline, 1)
      .strokeEllipse(GAME_W / 2, GAME_H + 70, GAME_W * 1.12, 640);
    // A plaza in front of the skyline for the team to stand on.
    land.fillStyle(PALETTE.sidewalk, 1).fillEllipse(GAME_W / 2, 640, 980, 150);
    land.fillStyle(PALETTE.plaza, 1).fillEllipse(GAME_W / 2, 636, 900, 120);

    // The skyline: landmarks from every district.
    const map = this.registry.get(MAP_KEY) as MapDef;
    const showcase: [string, number, number][] = [
      ['lighthouse', 150, 560],
      ['tower-west', 290, 570],
      ['police-station', 440, 590],
      ['city-hall', 640, 575],
      ['fire-station', 850, 590],
      ['kitty-tower', 1000, 570],
      ['donut-shop', 1120, 580],
    ];
    for (const [id, x, baseline] of showcase) {
      const b = map.buildings.find((d) => d.id === id);
      if (!b) continue;
      // Texture origin is the north corner; put the south corner on the baseline.
      const south = gridToScreen(b.w, b.d);
      addBakedImage(this, getBaked(buildingTextureKey(b)), x - south.x, baseline - south.y);
    }

    // The team: each hero by their vehicle, engines running (wheels turn, a little bounce).
    const team: [string, typeof POLICE_CAR, number][] = [
      ['player', POLICE_CAR, 330],
      ['playerFire', FIRE_TRUCK, 640],
      ['playerBuilder', MIXER_TRUCK, 950],
    ];
    team.forEach(([look, car, x], i) => {
      const meta = getBaked(vehicleFrameKey(car.name, 0, 0));
      const v = this.add
        .image(x + 30, 668, meta.key)
        .setOrigin(meta.originX, meta.originY)
        .setScale(1.5 / WT)
        .setDepth(5000 + i);
      let frame: 0 | 1 = 0;
      this.time.addEvent({
        delay: 160,
        loop: true,
        callback: () => {
          frame = frame === 0 ? 1 : 0;
          v.setTexture(vehicleFrameKey(car.name, 0, frame));
        },
      });
      this.tweens.add({ targets: v, y: v.y - 4, duration: 240 + i * 30, yoyo: true, repeat: -1 });
      const hero = this.add
        .image(x - 70, 690, characterFrameKey(look, 'SE', 0))
        .setOrigin(0.5, CHAR_FOOT_Y / CHAR_H)
        .setScale(1.7 / WT)
        .setDepth(5100 + i);
      this.tweens.add({
        targets: hero,
        y: hero.y - 14,
        duration: 420,
        delay: i * 140,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    // The rescue boat bobbing by on the right, a buoy on the left.
    const boatMeta = getBaked(boatFrameKey(RESCUE_BOAT.name, 4, 0));
    const boat = this.add
      .image(1236, 486, boatMeta.key)
      .setOrigin(boatMeta.originX, boatMeta.originY)
      .setScale(1.3 / WT);
    this.tweens.add({
      targets: boat,
      y: 480,
      angle: { from: -3, to: 3 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
    this.tweens.add({
      targets: boat,
      x: 1206,
      duration: 6000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const buoy = addBakedImage(this, getBaked(PROP.buoy), 50, 540).setScale(1.4 / WT);
    this.tweens.add({
      targets: buoy,
      y: 534,
      angle: { from: -6, to: 6 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });

    // The name, in bouncing blocks (pictures still say everything you need to play).
    const words = ["JAMES'S", 'BLOCK', 'CITY'];
    const colors = [PALETTE.policeBlue, PALETTE.fireRed, PALETTE.builderYellow, PALETTE.harborTeal];
    const size = 58;
    const gap = 26;
    const widthOf = (ch: string) => (ch === "'" ? 22 : size);
    const total =
      words.reduce((a, w) => a + [...w].reduce((b, ch) => b + widthOf(ch), 0), 0) +
      gap * (words.length - 1);
    let x = GAME_W / 2 - total / 2;
    let n = 0;
    for (const word of words) {
      for (const ch of word) {
        const c = this.add.container(x + widthOf(ch) / 2, -60).setDepth(9000);
        const color = colors[n % colors.length]!;
        const tile = this.add.graphics();
        if (ch !== "'") {
          tile
            .fillStyle(0x000000, 0.2)
            .fillRoundedRect(-size / 2 + 3, -size / 2 + 6, size - 6, size - 6, 12);
          tile
            .fillStyle(color, 1)
            .fillRoundedRect(-size / 2 + 3, -size / 2 + 3, size - 6, size - 6, 12);
          tile
            .fillStyle(0xffffff, 0.3)
            .fillRoundedRect(-size / 2 + 8, -size / 2 + 7, size - 16, 10, 5);
          tile
            .lineStyle(4, PALETTE.outline, 1)
            .strokeRoundedRect(-size / 2 + 3, -size / 2 + 3, size - 6, size - 6, 12);
        }
        const t = this.add
          .text(0, 1, ch, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '40px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#2B2D42',
            strokeThickness: 6,
            resolution: RS,
          })
          .setOrigin(0.5);
        c.add([tile, t]);
        this.tweens.add({
          targets: c,
          y: 64,
          delay: 80 + n * 55,
          duration: 420,
          ease: 'Bounce.easeOut',
        });
        this.tweens.add({
          targets: c,
          y: 56,
          delay: 1600 + n * 90,
          duration: 300,
          yoyo: true,
          repeat: -1,
          repeatDelay: 2600,
        });
        x += widthOf(ch);
        if (ch !== "'") n++;
      }
      x += gap;
    }

    // Badges earned so far and coins, bottom-left (so coming back feels like coming home).
    if (state) {
      state.progress.badges.forEach((b, i) =>
        this.add
          .image(54 + i * 70, GAME_H - 54, HUD.badge(b))
          .setScale(1 / RS)
          .setDepth(9000),
      );
      if (state.economy.coins > 0) {
        const bx = 54 + state.progress.badges.length * 70;
        this.add
          .image(bx, GAME_H - 54, HUD.coin)
          .setScale(1 / RS)
          .setDepth(9000);
        this.add
          .text(bx + 40, GAME_H - 54, `${state.economy.coins}`, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '40px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#2B2D42',
            strokeThickness: 8,
            resolution: RS,
          })
          .setOrigin(0, 0.5)
          .setDepth(9000);
      }
    }

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
