import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { HUD } from '../art/hud';
import type { IconName } from '../art/icons';
import { CARD_H, CARD_W, iconKey, MENU } from '../art/menu';
import { RS } from '../art/renderScale';
import { PAINTS } from '../art/vehicles';
import { GAME_H, GAME_W, PALETTE } from '../config';
import type { GameState } from '../systems/GameState';
import { HATS } from '../systems/jobs';
import { minigamesShort, type ShopItem } from '../systems/shop';
import { STATE_KEY } from './keys';
import { BIG_TEXT, closeMenu } from './minigameKit';

type Tab = ShopItem['tab'];
const TABS: { tab: Tab; icon: IconName }[] = [
  { tab: 'job', icon: 'star' },
  { tab: 'hats', icon: 'pirateHat' },
  { tab: 'car', icon: 'car' },
  { tab: 'home', icon: 'home' },
];
const CARD_SCALE = 0.78;
const COLS = 4;

/**
 * The Shop (spec 003 AC9, spec 006): four picture tabs (job upgrade, hats, your car and paint,
 * furniture). Tap a card to buy it. Too few coins: a "not yet" wobble and a row of minigame
 * pictures for how many more games to play. Tap an owned hat or paint to wear or apply it.
 * No error sound, no words.
 */
export class ShopScene extends Phaser.Scene {
  private state!: GameState;
  private coinText!: Phaser.GameObjects.Text;
  private notYet: Phaser.GameObjects.Image[] = [];
  private page: Phaser.GameObjects.GameObject[] = [];
  private tabImgs = new Map<Tab, Phaser.GameObjects.Image>();
  private cards = new Map<string, Phaser.GameObjects.Image>();
  private tab: Tab = 'job';
  private bought: string | null = null;
  private changed = false;

  constructor() {
    super('Shop');
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    this.state = this.registry.get(STATE_KEY) as GameState;
    this.cards.clear();
    this.tabImgs.clear();
    this.notYet = [];
    this.page = [];
    this.bought = null;
    this.changed = false;
    this.closed = false;
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0xffe9b0, 0.95).setOrigin(0, 0);
    const g = this.add.graphics();
    for (let x = 0; x < GAME_W; x += 80) {
      g.fillStyle((x / 80) % 2 ? 0xffffff : 0xe63946, 1);
      g.fillRect(x, 0, 80, 40);
    }

    // Picture tabs.
    TABS.forEach(({ tab, icon }, i) => {
      const x = 220 + i * 150;
      const bg = this.add
        .image(x, 105, MENU.card)
        .setScale(0.5 / RS, 0.36 / RS)
        .setInteractive({ useHandCursor: true });
      this.add.image(x, 105, iconKey(icon)).setScale(0.55 / RS);
      bg.on('pointerup', () => this.showTab(tab));
      this.tabImgs.set(tab, bg);
    });

    this.add.image(GAME_W - 200, 105, HUD.coin).setScale(1 / RS);
    this.coinText = this.add
      .text(GAME_W - 165, 105, `${this.state.economy.coins}`, BIG_TEXT)
      .setOrigin(0, 0.5);

    const back = this.add
      .image(90, GAME_H - 90, MENU.back)
      .setScale(1 / RS)
      .setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.close());
    this.input.keyboard?.once('keydown-ESC', () => this.close());
    voice.say('shop-hello', { interrupt: true });
    this.showTab('job');
  }

  /** Show one tab's cards. */
  showTab(tab: Tab): void {
    this.tab = tab;
    for (const o of this.page) o.destroy();
    for (const n of this.notYet) n.destroy();
    this.page = [];
    this.notYet = [];
    this.cards.clear();
    for (const [t, img] of this.tabImgs) img.setTexture(t === tab ? MENU.cardOwned : MENU.card);
    const items = this.state.shopTab(tab);
    const w = CARD_W * CARD_SCALE + 40;
    items.forEach((item, i) => {
      const row = Math.floor(i / COLS);
      const inRow = Math.min(COLS, items.length - row * COLS);
      const col = i % COLS;
      const x = GAME_W / 2 + (col - (inRow - 1) / 2) * w;
      const y = 300 + row * (CARD_H * CARD_SCALE + 30);
      this.addCard(item, x, y);
    });
  }

  private isWorn(item: ShopItem): boolean {
    const s = this.state.progress;
    return s.hat === item.id || s.paint === item.id;
  }

  private addCard(item: ShopItem, x: number, y: number): void {
    const owned = this.state.owns(item.id);
    const card = this.add
      .image(x, y, owned ? MENU.cardOwned : MENU.card)
      .setScale(CARD_SCALE / RS)
      .setInteractive({ useHandCursor: true });
    card.setName(`card-${item.id}`);
    this.page.push(card);
    this.page.push(this.add.image(x, y - 30, iconKey(item.icon as IconName)).setScale(0.8 / RS));
    const paint = PAINTS[item.id];
    if (paint !== undefined) {
      const dot = this.add.circle(x + 40, y - 70, 18, paint).setStrokeStyle(4, PALETTE.outline);
      this.page.push(dot);
    }
    if (owned) {
      if (this.isWorn(item))
        this.page.push(this.add.image(x + 55, y - 70, HUD.check).setScale(0.3 / RS));
    } else {
      this.page.push(this.add.image(x - 35, y + 60, HUD.coin).setScale(0.65 / RS));
      this.page.push(this.add.text(x - 10, y + 60, `${item.price}`, BIG_TEXT).setOrigin(0, 0.5));
    }
    card.on('pointerup', () => this.tapCard(item.id));
    this.cards.set(item.id, card);
  }

  private tapCard(id: string): void {
    const item = this.state.content.shop.find((i) => i.id === id);
    if (!item) return;
    if (this.state.owns(id)) this.use(item);
    else this.buy(id);
  }

  /** Wear an owned hat (or take it off), apply an owned paint. */
  private use(item: ShopItem): void {
    if (HATS[item.id]) {
      const off = this.state.progress.hat === item.id;
      this.state.wear(off ? null : item.id);
      voice.say(off ? 'hat-off' : 'hat-on', { interrupt: true });
    } else if (PAINTS[item.id] !== undefined) {
      this.state.applyPaint(item.id);
      voice.say('paint-on', { interrupt: true });
    } else return;
    this.changed = true;
    sfx.play('sparkle');
    this.showTab(this.tab);
  }

  /** Try to buy: hooray, or a gentle "not yet" with a picture count of games to play. */
  buy(id: string): boolean {
    const item = this.state.content.shop.find((i) => i.id === id);
    if (!item) return false;
    if (item.tab !== this.tab) this.showTab(item.tab);
    const card = this.cards.get(id);
    if (!card) return false;
    if (this.state.buy(id)) {
      this.bought = id;
      this.changed = true;
      // A new hat or paint goes on straight away.
      if (HATS[id]) this.state.wear(id);
      if (PAINTS[id] !== undefined) this.state.applyPaint(id);
      this.coinText.setText(`${this.state.economy.coins}`);
      sfx.play('tada');
      sfx.play('sparkle');
      voice.say(id === 'own-car' ? 'car-yours' : 'shop-bought', { interrupt: true });
      this.tweens.add({
        targets: card,
        scale: (CARD_SCALE * 1.12) / RS,
        duration: 200,
        yoyo: true,
      });
      this.time.delayedCall(450, () => this.showTab(this.tab));
      // The job upgrade and the car close the shop so you can try them out.
      if (item.tab === 'job' || id === 'own-car') this.time.delayedCall(1800, () => this.close());
      return true;
    }
    if (this.state.owns(id)) return false;
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
          GAME_W / 2 + (k - (need - 1) / 2) * 70,
          660,
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

  /** Test hook: tap a card (buy, or wear/apply if owned). */
  debugTap(id: string): void {
    const item = this.state.content.shop.find((i) => i.id === id);
    if (item && item.tab !== this.tab) this.showTab(item.tab);
    this.tapCard(id);
  }

  private closed = false;

  close(): void {
    if (this.closed) return;
    this.closed = true;
    const r: Record<string, string> = {};
    if (this.bought) r.bought = this.bought;
    if (this.changed) r.changed = '1';
    closeMenu(this, r);
  }
}
