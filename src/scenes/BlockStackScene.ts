import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { iconKey } from '../art/menu';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W, PALETTE } from '../config';
import { BlockStackModel, type BSEvent } from '../systems/builderMinigames';
import { BIG_TEXT, MinigameScene } from './minigameKit';

const GROUND = 660;
const BLOCK_H = 46;
const HOOK_Y = 150;
const COLORS = [PALETTE.fireRed, PALETTE.builderYellow, PALETTE.harborTeal, PALETTE.policeBlue];

/**
 * Block Stack (Builder minigame): a block swings on a crane; tap (or Space) to drop it. Close to
 * the top of the stack: it stacks. Otherwise it bounces off (no penalty). The view scrolls up as
 * the tower grows. ~100 s, pays 5/15/30.
 */
export class BlockStackScene extends MinigameScene {
  private model!: BlockStackModel;
  private hanging!: Phaser.GameObjects.Rectangle;
  private rope!: Phaser.GameObjects.Graphics;
  private stack!: Phaser.GameObjects.Container;
  private scoreText!: Phaser.GameObjects.Text;

  constructor() {
    super('BlockStack');
  }

  protected defaultId(): string {
    return 'block-stack';
  }

  protected get score(): number {
    return this.model.score;
  }

  protected set score(v: number) {
    this.model.score = v;
  }

  override init(data: { id?: string; plays?: number; durationSec?: number }): void {
    super.init(data);
    this.model = new BlockStackModel(
      data.durationSec ?? this.def.durationSec,
      this.plays,
      this.def.difficultyStepPerReplay,
    );
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x9fd8f5, 1).fillRect(0, 0, GAME_W, GAME_H);
    // The crane jib across the top.
    g.fillStyle(PALETTE.builderYellow, 1).fillRect(100, 60, GAME_W - 200, 30);
    g.lineStyle(5, PALETTE.outline, 1).strokeRect(100, 60, GAME_W - 200, 30);
    this.stack = this.add.container(GAME_W / 2, 0);
    const ground = this.add
      .rectangle(0, GROUND, 360, 30, 0xb98a5a)
      .setStrokeStyle(4, PALETTE.outline);
    this.stack.add(ground);
    this.rope = this.add.graphics();
    this.hanging = this.add
      .rectangle(GAME_W / 2, HOOK_Y, 150, BLOCK_H, COLORS[0]!)
      .setStrokeStyle(4, PALETTE.outline);
    this.add.image(60, 50, iconKey('crane')).setScale(0.45 / RS);
    this.scoreText = this.add.text(100, 50, '0', BIG_TEXT).setOrigin(0, 0.5);
    voice.say('bs-intro', { interrupt: true });
    this.input.on('pointerdown', () => this.handle(this.model.drop()));
    this.input.keyboard?.on('keydown-SPACE', () => this.handle(this.model.drop()));
  }

  private topY(h: number): number {
    return GROUND - 15 - BLOCK_H / 2 - (h - 1) * BLOCK_H;
  }

  private handle(e: BSEvent | null): void {
    if (!e || e.type === 'finished') return;
    const x = GAME_W / 2 + e.x;
    const falling = this.add
      .rectangle(x, HOOK_Y, 150, BLOCK_H, this.hanging.fillColor)
      .setStrokeStyle(4, PALETTE.outline);
    this.hanging.setFillStyle(COLORS[(this.model.score + 1) % COLORS.length]!);
    if (e.type === 'stacked') {
      const y = this.topY(e.height) + this.stack.y;
      this.tweens.add({
        targets: falling,
        y,
        duration: 320,
        ease: 'Quad.easeIn',
        onComplete: () => {
          falling.destroy();
          const b = this.add
            .rectangle(e.x, this.topY(e.height), 150, BLOCK_H, falling.fillColor)
            .setStrokeStyle(4, PALETTE.outline);
          this.stack.add(b);
          sfx.play('thunk');
          this.scoreText.setText(`${this.model.score}`);
          // Scroll the tower down so the top stays in view.
          const want = Math.max(0, (e.height - 6) * BLOCK_H);
          this.tweens.add({ targets: this.stack, y: want, duration: 300 });
        },
      });
      voice.say('bs-stack', { minGapMs: 2500 });
    } else {
      this.tweens.add({
        targets: falling,
        y: GAME_H + 80,
        angle: e.x > 0 ? 160 : -160,
        x: x + (e.x > 0 ? 160 : -160),
        duration: 700,
        ease: 'Quad.easeIn',
        onComplete: () => falling.destroy(),
      });
      sfx.play('boing', 1.2, 0.6);
      voice.say('bs-bounce', { minGapMs: 4000 });
    }
  }

  update(_t: number, deltaMs: number): void {
    if (this.done) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    for (const e of this.model.update(dt)) if (e.type === 'finished') this.finish();
    const x = GAME_W / 2 + this.model.blockX;
    this.hanging.setPosition(x, HOOK_Y);
    this.rope
      .clear()
      .lineStyle(4, PALETTE.outline, 1)
      .lineBetween(x, 90, x, HOOK_Y - BLOCK_H / 2);
  }
}
