import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { BIG_CHAR_SCALE, bigCharacterKey, CHAR_FOOT_Y, CHAR_H } from '../art/characters';
import { iconKey } from '../art/menu';
import { RS, WT } from '../art/renderScale';
import { GAME_H, GAME_W, PALETTE } from '../config';
import { WhoTookItModel, type Clue, type Round, type WTIEvent } from '../systems/whoTookIt';
import { MinigameScene } from './minigameKit';

const FEET_Y = 600;
const SPACING = 210;
const CLUE_ICON: Record<Clue, 'donut' | 'feather' | 'sock'> = {
  frosting: 'donut',
  feather: 'feather',
  sock: 'sock',
};

/**
 * Who Took It? (Cop minigame): the clue picture is on the card at the top; five suspects stand in
 * a line-up; tap the one who has it. A wrong tap is a funny "not me!" shrug. ~2 minutes, pays
 * 5/15/30, can't be failed, and on replays the clue is smaller and they swap places.
 */
export class WhoTookItScene extends MinigameScene {
  private model!: WhoTookItModel;
  private suspects: Phaser.GameObjects.Container[] = [];
  private clueCard!: Phaser.GameObjects.Image;

  constructor() {
    super('WhoTookIt');
  }

  protected defaultId(): string {
    return 'who-took-it';
  }

  protected get score(): number {
    return this.model.score;
  }

  protected set score(v: number) {
    this.model.score = v;
  }

  override init(data: { id?: string; plays?: number; durationSec?: number }): void {
    super.init(data);
    this.model = new WhoTookItModel(this.durationSec, this.plays, this.def.difficultyStepPerReplay);
    this.suspects = [];
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    // Police station line-up wall: blue with height stripes.
    const g = this.add.graphics();
    g.fillStyle(0x9fc3f0, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    g.lineStyle(4, 0xffffff, 0.6);
    for (let y = 300; y < FEET_Y; y += 60) g.lineBetween(0, y, GAME_W, y);
    // A lighter band behind the top bar.
    g.fillStyle(0xffffff, 0.25).fillRect(0, 0, GAME_W, 88);
    g.fillStyle(0xd9dce3, 1);
    g.fillRect(0, FEET_Y - 10, GAME_W, GAME_H - FEET_Y + 10);
    g.lineStyle(6, PALETTE.outline, 1);
    g.lineBetween(0, FEET_Y - 10, GAME_W, FEET_Y - 10);
    // The clue card ("who has this?").
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(GAME_W / 2 - 90, 96, 180, 150, 20);
    g.lineStyle(6, PALETTE.outline, 1);
    g.strokeRoundedRect(GAME_W / 2 - 90, 96, 180, 150, 20);
    this.add.image(GAME_W / 2 - 52, 171, iconKey('magnifier')).setScale(0.6 / RS);
    this.clueCard = this.add.image(GAME_W / 2 + 28, 171, iconKey('sock')).setScale(0.9 / RS);

    this.addTopBar('magnifier');

    voice.say('wti-intro', { interrupt: true });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 5) this.handle(this.model.tap(n - 1));
    });
  }

  private suspectX(i: number): number {
    return GAME_W / 2 + (i - 2) * SPACING;
  }

  private buildRound(r: Round): void {
    for (const s of this.suspects) s.destroy();
    this.suspects = [];
    this.clueCard.setTexture(iconKey(CLUE_ICON[r.clue]));
    r.looks.forEach((look, i) => {
      const c = this.add.container(this.suspectX(i), FEET_Y + 200);
      const body = this.add
        .image(0, 0, bigCharacterKey(look))
        .setOrigin(0.5, CHAR_FOOT_Y / CHAR_H)
        .setScale(3 / (WT * BIG_CHAR_SCALE));
      c.add(body);
      if (i === r.culprit) c.add(this.clue(r.clue));
      c.setSize(150, 260);
      c.setInteractive(
        new Phaser.Geom.Rectangle(-75, -230, 150, 250),
        Phaser.Geom.Rectangle.Contains,
      );
      c.on('pointerdown', () => this.handle(this.model.tap(this.suspects.indexOf(c))));
      this.tweens.add({
        targets: c,
        y: FEET_Y,
        delay: i * 70,
        duration: 320,
        ease: 'Back.easeOut',
      });
      this.suspects.push(c);
    });
  }

  /** The clue on the culprit: frosting on his face, a feather in his hair, a sock on his head. */
  private clue(clue: Clue): Phaser.GameObjects.GameObject {
    const k = this.model.clueScale;
    if (clue === 'frosting') {
      const blob = this.add.graphics();
      blob.fillStyle(PALETTE.donutPink, 1);
      blob.fillEllipse(10, -118, 34 * k, 16 * k);
      blob.fillEllipse(-4, -112, 18 * k, 12 * k);
      return blob;
    }
    const img = this.add.image(
      clue === 'feather' ? 22 : 0,
      -178,
      iconKey(clue === 'feather' ? 'feather' : 'sock'),
    );
    img.setScale((0.55 * k) / RS).setAngle(clue === 'feather' ? 25 : -10);
    return img;
  }

  private handle(e: WTIEvent | null): void {
    if (!e) return;
    const c = this.suspects[(e as { suspect?: number }).suspect ?? -1];
    if (e.type === 'right' && c) {
      sfx.play('tada', 1.1, 0.7);
      voice.say('wti-right', { interrupt: true });
      this.good(c.x, FEET_Y - 250);
      this.tweens.add({ targets: c, y: FEET_Y - 60, duration: 180, yoyo: true, repeat: 1 });
    } else if (e.type === 'wrong' && c) {
      sfx.play('shrug');
      voice.say('wti-wrong', { minGapMs: 1500 });
      this.oops();
      this.tweens.add({
        targets: c,
        angle: { from: -8, to: 8 },
        duration: 90,
        yoyo: true,
        repeat: 2,
        onComplete: () => c.setAngle(0),
      });
    }
  }

  update(_t: number, deltaMs: number): void {
    if (this.done) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    for (const e of this.model.update(dt)) {
      if (e.type === 'round') this.buildRound(e.round);
      else if (e.type === 'shuffle') {
        const old = [...this.suspects];
        this.suspects = e.order.map((k) => old[k]!);
        this.suspects.forEach((c, i) =>
          this.tweens.add({
            targets: c,
            x: this.suspectX(i),
            duration: 500,
            ease: 'Sine.easeInOut',
          }),
        );
        sfx.play('whoosh', 1.2, 0.6);
      } else if (e.type === 'finished') this.finish();
    }
    this.model.level = this.syncTopBar(this.model.elapsed, this.model.durationSec);
  }

  /** Test hook: the culprit's index right now. */
  debugCulprit(): number {
    return this.model.round?.culprit ?? -1;
  }

  debugTap(i: number): void {
    this.handle(this.model.tap(i));
  }
}
