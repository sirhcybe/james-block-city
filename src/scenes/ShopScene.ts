import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { HUD } from '../art/hud';
import type { IconName } from '../art/icons';
import { CARD_H, CARD_W, iconKey, MENU } from '../art/menu';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W } from '../config';
import type { GameState } from '../systems/GameState';
import { minigamesShort, type ShopItem } from '../systems/shop';
import { STATE_KEY } from './keys';
import { BIG_TEXT, closeMenu } from './minigameKit';

/**
 * The Shop (AC9): picture cards with a price (number + coin) and a big buy button. Too few coins:
 * a "not yet" wobble and a row of minigame pictures showing how many more games to play. No error
 * sound, no words.
 */
export class ShopScene extends Phaser.Scene {
  private state!: GameState;
  private coinText!: Phaser.GameObjects.Text;
  private notYet: Phaser.GameObjects.Image[] = [];
  private cards = new Map<string, Phaser.GameObjects.Image>();
  private bought: string | null = null;

  constructor() {
    super('Shop');
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    this.state = this.registry.get(STATE_KEY) as GameState;
    this.cards.clear();
    this.notYet = [];
    this.bought = null;
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0xffe9b0, 0.95).setOrigin(0, 0);
    // Awning stripes across the top.
    const g = this.add.graphics();
    for (let x = 0; x < GAME_W; x += 80) {
      g.fillStyle((x / 80) % 2 ? 0xffffff : 0xe63946, 1);
      g.fillRect(x, 0, 80, 70);
    }

    this.add.image(GAME_W - 200, 120, HUD.coin).setScale(1 / RS);
    this.coinText = this.add
      .text(GAME_W - 165, 120, `${this.state.economy.coins}`, BIG_TEXT)
      .setOrigin(0, 0.5);

    const items = this.state.shopShelf();
    items.forEach((item, i) =>
      this.addCard(item, GAME_W / 2 + (i - (items.length - 1) / 2) * (CARD_W + 80)),
    );

    const back = this.add
      .image(90, GAME_H - 90, MENU.back)
      .setScale(1 / RS)
      .setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.close());
    this.input.keyboard?.once('keydown-ESC', () => this.close());
    voice.say('shop-hello', { interrupt: true });
  }

  private addCard(item: ShopItem, x: number): void {
    const y = 330;
    const owned = this.state.owns(item.id);
    const card = this.add.image(x, y, owned ? MENU.cardOwned : MENU.card).setScale(1 / RS);
    this.add.image(x, y - 40, iconKey(item.icon as IconName)).setScale(1 / RS);
    this.add.image(x - 40, y + 70, HUD.coin).setScale(0.8 / RS);
    this.add.text(x - 10, y + 70, `${item.price}`, BIG_TEXT).setOrigin(0, 0.5);
    this.cards.set(item.id, card);
    if (owned) return;
    const buy = this.add
      .image(x, y + CARD_H / 2 + 80, MENU.buy)
      .setScale(1 / RS)
      .setInteractive({ useHandCursor: true });
    buy.on('pointerup', () => this.buy(item.id));
    card.setInteractive().on('pointerup', () => this.buy(item.id));
    this.tweens.add({ targets: buy, scale: 1.06 / RS, duration: 500, yoyo: true, repeat: -1 });
  }

  /** Try to buy: hooray, or a gentle "not yet" with a picture count of games to play. */
  buy(id: string): boolean {
    if (this.bought) return false;
    const item = this.state.content.shop.find((i) => i.id === id);
    const card = this.cards.get(id);
    if (!item || !card) return false;
    if (this.state.buy(id)) {
      this.bought = id;
      this.coinText.setText(`${this.state.economy.coins}`);
      card.setTexture(MENU.cardOwned);
      sfx.play('tada');
      sfx.play('sparkle');
      voice.say('shop-bought', { interrupt: true });
      this.tweens.add({ targets: card, scale: 1.12 / RS, duration: 200, yoyo: true, repeat: 1 });
      this.time.delayedCall(1800, () => this.close());
      return true;
    }
    // Not yet: wobble and show how many more minigames (as pictures).
    this.tweens.add({
      targets: card,
      angle: { from: -4, to: 4 },
      duration: 90,
      yoyo: true,
      repeat: 2,
      onComplete: () => card.setAngle(0),
    });
    for (const n of this.notYet) n.destroy();
    this.notYet = [];
    const need = minigamesShort(item.price, this.state.economy.coins);
    for (let k = 0; k < need; k++) {
      const img = this.add
        .image(
          card.x + (k - (need - 1) / 2) * 70,
          650,
          iconKey(k % 2 ? 'magnifier' : 'trafficLight'),
        )
        .setScale(0);
      this.tweens.add({
        targets: img,
        scale: 0.5 / RS,
        delay: k * 120,
        duration: 250,
        ease: 'Back.easeOut',
      });
      this.notYet.push(img);
    }
    voice.say('shop-not-yet', { interrupt: true });
    return false;
  }

  private close(): void {
    closeMenu(this, this.bought ? { bought: this.bought } : {});
  }
}
