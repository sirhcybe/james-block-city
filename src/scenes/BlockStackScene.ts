import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { landSquash } from '../art/anim';
import { RS } from '../art/renderScale';
import { addScenery, jibTexture, slabTexture, stackBlockTexture } from '../art/scenery';
import { GAME_H, GAME_W, PALETTE } from '../config';
import { BlockStackModel, type BSEvent } from '../systems/builderMinigames';
import { drawBackdrop, MinigameScene } from './minigameKit';

const GROUND = 660;
const BLOCK_H = 46;
const HOOK_Y = 176;
const COLORS = [PALETTE.fireRed, PALETTE.builderYellow, PALETTE.harborTeal, PALETTE.policeBlue];

/**
 * Block Stack (Builder minigame): a block swings on a crane; tap (or Space) to drop it. Close to
 * the top of the stack: it stacks. Otherwise it bounces off (no penalty). The view scrolls up as
 * the tower grows. ~100 s, pays 5/15/30.
 */
export class BlockStackScene extends MinigameScene {
  private model!: BlockStackModel;
  private hanging!: Phaser.GameObjects.Image;
  private rope!: Phaser.GameObjects.Graphics;
  private stack!: Phaser.GameObjects.Container;

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
      this.durationSec,
      this.plays,
      this.def.difficultyStepPerReplay,
    );
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    drawBackdrop(this, 'site');
    // The crane jib across the top, with the trolley the block hangs from.
    addScenery(this, jibTexture(this, GAME_W - 350, 24), 250, 92);
    this.stack = this.add.container(GAME_W / 2, 0);
    const ground = this.add.image(0, GROUND, slabTexture(this, 360, 30)).setScale(1 / RS);
    this.stack.add(ground);
    this.rope = this.add.graphics();
    this.hanging = this.add.image(GAME_W / 2, HOOK_Y, this.blockKey(0)).setScale(1 / RS);
    this.addTopBar('crane');
    voice.say('bs-intro', { interrupt: true });
    this.input.on('pointerdown', () => this.handle(this.model.drop()));
    this.input.keyboard?.on('keydown-SPACE', () => this.handle(this.model.drop()));
  }

  /** Texture for the n-th block's colour. */
  private blockKey(n: number): string {
    return stackBlockTexture(this, 150, BLOCK_H, COLORS[n % COLORS.length]!);
  }

  private topY(h: number): number {
    return GROUND - 15 - BLOCK_H / 2 - (h - 1) * BLOCK_H;
  }

  private handle(e: BSEvent | null): void {
    if (!e || e.type === 'finished') return;
    const x = GAME_W / 2 + e.x;
    const fallingKey = this.hanging.texture.key;
    const falling = this.add.image(x, HOOK_Y, fallingKey).setScale(1 / RS);
    this.hanging.setTexture(this.blockKey(this.model.score + 1));
    if (e.type === 'stacked') {
      const y = this.topY(e.height) + this.stack.y;
      this.tweens.add({
        targets: falling,
        y,
        duration: 320,
        ease: 'Quad.easeIn',
        onComplete: () => {
          falling.destroy();
          const b = this.add.image(e.x, this.topY(e.height), fallingKey).setScale(1 / RS);
          this.stack.add(b);
          // The landed block and the stack give a little squash.
          landSquash(this, b, 0.12, 70);
          sfx.play('thunk');
          this.good(x, y - 40);
          // Scroll the tower down so the top stays in view.
          const want = Math.max(0, (e.height - 6) * BLOCK_H);
          this.tweens.add({ ease: 'Quad.easeOut', targets: this.stack, y: want, duration: 300 });
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
      this.oops();
    }
  }

  update(_t: number, deltaMs: number): void {
    if (this.done) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    for (const e of this.model.update(dt)) if (e.type === 'finished') this.finish();
    const x = GAME_W / 2 + this.model.blockX;
    this.hanging.setPosition(x, HOOK_Y);
    // Trolley on the jib, the cable, and a hook plate on the block.
    this.rope
      .clear()
      .fillStyle(PALETTE.outline, 1)
      .fillRoundedRect(x - 22, 112, 44, 16, 5)
      .fillStyle(0xc9ced8, 1)
      .fillRoundedRect(x - 18, 115, 36, 10, 3)
      .lineStyle(4, PALETTE.outline, 1)
      .lineBetween(x, 126, x, HOOK_Y - BLOCK_H / 2 - 4)
      .fillStyle(PALETTE.outline, 1)
      .fillRoundedRect(x - 10, HOOK_Y - BLOCK_H / 2 - 8, 20, 10, 3);
    this.model.level = this.syncTopBar(this.model.elapsed, this.model.durationSec);
  }
}
