import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { HUD } from '../art/hud';
import type { IconName } from '../art/icons';
import { iconKey } from '../art/menu';
import { RS } from '../art/renderScale';
import { darken, lighten } from '../art/color';
import { GAME_H, GAME_W, PALETTE } from '../config';
import { bakeIcon } from '../art/ui';
import {
  BuildJobModel,
  DEFAULT_BLUEPRINT,
  TOOLS,
  type BuildEvent,
  type Material,
  type PieceDef,
  type Tool,
} from '../systems/buildJob';
import type { GameState } from '../systems/GameState';
import { EV, STATE_KEY } from './keys';
import { addQuitButton, drawBackdrop, leaveMinigame } from './minigameKit';

/** Blueprint unit in logical px, and where the blueprint paper sits. */
const U = 78;
const PAPER = { x: 150, y: 96, w: 720, h: 420 };
const TRAY_Y = 618;
const TOOL_X = 1090;
const TOOL_Y = [166, 300, 434];
const TOOL_R = 58;
const BOARD_KEY = 'buildit-board';

const MAT_COLOR: Record<Material, number> = {
  wood: 0xc98a4b,
  brick: 0xd8553f,
  steel: 0x8fa3bd,
};
const SITE_ICON: Record<string, IconName> = {
  'practice-wall': 'brick',
  dock: 'dock',
  lighthouse: 'lighthouse',
  'boat-shop': 'boat',
  bridge: 'bridge',
  'golden-tower': 'tower',
};

interface PieceView {
  box: Phaser.GameObjects.Container;
  def: PieceDef;
  home: { x: number; y: number };
  homeScale: number;
}

/**
 * Build It! (spec 008): the Builder's build minigame, opened by the blaster at a build spot.
 * Drag the planks, bricks and beams from the tray onto the picture, then pick the tool that fixes
 * each one (hammer for wood, trowel for bricks, wrench for steel). No timer and no way to lose:
 * a wrong slot or tool just boings. Leaving part-way keeps the build spot waiting.
 */
export class BuildItScene extends Phaser.Scene {
  private model!: BuildJobModel;
  private site = '';
  private views: PieceView[] = [];
  private slotGhosts: Phaser.GameObjects.Graphics[] = [];
  private tools = new Map<Tool, Phaser.GameObjects.Container>();
  private pips: Phaser.GameObjects.Arc[] = [];
  private origin = { x: 0, y: 0 };
  private closed = false;
  private busy = false;
  private saidTool = false;
  private toolPulse: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('BuildIt');
  }

  init(data: { site?: string; giant?: boolean }): void {
    const state = this.registry.get(STATE_KEY) as GameState;
    this.site = data.site ?? 'practice-wall';
    const bp = state.content.blueprints.find((b) => b.id === this.site) ?? DEFAULT_BLUEPRINT;
    this.model = new BuildJobModel(bp.pieces, !!data.giant);
    this.views = [];
    this.slotGhosts = [];
    this.tools = new Map();
    this.pips = [];
    this.closed = false;
    this.busy = false;
    this.saidTool = false;
    this.toolPulse = null;
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    drawBackdrop(this, 'site');
    // The paper, the tray and the tool board never change: baked once (redrawing them every
    // frame was slow on phones with weak GPUs).
    bakeIcon(this, BOARD_KEY, GAME_W, GAME_H, (g, s) => {
      g.scaleCanvas(s, s);
      // Blueprint paper with a grid.
      g.fillStyle(0x000000, 0.18).fillRoundedRect(PAPER.x + 6, PAPER.y + 10, PAPER.w, PAPER.h, 22);
      g.fillStyle(0x2f6fde, 1).fillRoundedRect(PAPER.x, PAPER.y, PAPER.w, PAPER.h, 22);
      g.lineStyle(2, 0xffffff, 0.16);
      for (let x = PAPER.x + 40; x < PAPER.x + PAPER.w; x += 40)
        g.lineBetween(x, PAPER.y + 8, x, PAPER.y + PAPER.h - 8);
      for (let y = PAPER.y + 40; y < PAPER.y + PAPER.h; y += 40)
        g.lineBetween(PAPER.x + 8, y, PAPER.x + PAPER.w - 8, y);
      g.lineStyle(6, PALETTE.outline, 1).strokeRoundedRect(PAPER.x, PAPER.y, PAPER.w, PAPER.h, 22);
      // Tray shelf.
      g.fillStyle(0x7a5230, 1).fillRoundedRect(140, TRAY_Y - 78, GAME_W - 160, 160, 18);
      g.fillStyle(0x9c6b3f, 1).fillRoundedRect(140, TRAY_Y - 78, GAME_W - 160, 146, 18);
      g.lineStyle(6, PALETTE.outline, 1).strokeRoundedRect(140, TRAY_Y - 78, GAME_W - 160, 160, 18);
      // Tool board.
      g.fillStyle(0xf3e3c0, 1).fillRoundedRect(TOOL_X - 100, 90, 200, 420, 22);
      g.lineStyle(6, PALETTE.outline, 1).strokeRoundedRect(TOOL_X - 100, 90, 200, 420, 22);
    });
    this.add
      .image(0, 0, BOARD_KEY)
      .setOrigin(0, 0)
      .setScale(1 / RS);

    // Centre the picture on the paper.
    const ps = this.model.pieces;
    const minX = Math.min(...ps.map((p) => p.x));
    const maxX = Math.max(...ps.map((p) => p.x + p.w));
    const minY = Math.min(...ps.map((p) => p.y));
    const maxY = Math.max(...ps.map((p) => p.y + p.h));
    this.origin = {
      x: PAPER.x + PAPER.w / 2 - ((minX + maxX) / 2) * U,
      y: PAPER.y + PAPER.h / 2 - ((minY + maxY) / 2) * U,
    };

    // Slots: dashed ghosts tinted with the material they want.
    ps.forEach((p) => {
      const sg = this.add.graphics();
      const x = this.origin.x + p.x * U;
      const y = this.origin.y + p.y * U;
      sg.fillStyle(lighten(MAT_COLOR[p.material], 0.25), 0.55).fillRoundedRect(
        x + 3,
        y + 3,
        p.w * U - 6,
        p.h * U - 6,
        8,
      );
      this.drawPattern(sg, p.material, x + 3, y + 3, p.w * U - 6, p.h * U - 6, 0.25);
      sg.lineStyle(4, 0xffffff, 0.9);
      this.dashedRect(sg, x + 3, y + 3, p.w * U - 6, p.h * U - 6);
      this.slotGhosts.push(sg);
    });

    // Progress: the thing being built, and one pip per piece.
    this.add.image(60, 50, iconKey(SITE_ICON[this.site] ?? 'brick')).setScale(0.5 / RS);
    ps.forEach((_, i) => {
      const pip = this.add
        .circle(124 + i * 44, 50, 16, 0xffffff, 0.35)
        .setStrokeStyle(4, PALETTE.outline);
      this.pips.push(pip);
    });

    // Tray: the pieces, shuffled, a bit smaller than on the picture.
    const order = ps.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const gap = 18;
    const total = ps.reduce((a, p) => a + p.w * U, 0);
    const room = GAME_W - 200 - gap * (ps.length + 1);
    const maxH = Math.max(...ps.map((p) => p.h * U));
    const scale = Math.min(0.8, room / total, 124 / maxH);
    let tx = 160 + gap + (room - total * scale) / 2;
    ps.forEach(() => this.views.push(null as unknown as PieceView));
    for (const i of order) {
      const p = ps[i]!;
      const w = p.w * U;
      const h = p.h * U;
      const home = { x: tx + (w * scale) / 2, y: TRAY_Y - 6 };
      tx += w * scale + gap;
      const box = this.add.container(home.x, home.y).setScale(scale).setDepth(10);
      const pg = this.add.graphics();
      this.drawPiece(pg, p.material, w, h);
      box.add(pg);
      box.setSize(Math.max(w, 90 / scale), Math.max(h, 90 / scale));
      box.setInteractive({ draggable: true, useHandCursor: true });
      this.views[i] = { box, def: p, home, homeScale: scale };
      box.on('dragstart', () => this.onDragStart(i));
      box.on('drag', (_p: unknown, x: number, y: number) => this.onDrag(i, x, y));
      box.on('dragend', () => this.onDrop(i));
    }

    // Tools.
    TOOLS.forEach((tool, k) => {
      const c = this.add.container(TOOL_X, TOOL_Y[k]!).setDepth(12);
      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.2).fillCircle(3, 6, TOOL_R);
      bg.fillStyle(0xffffff, 1).fillCircle(0, 0, TOOL_R);
      bg.lineStyle(6, PALETTE.outline, 1).strokeCircle(0, 0, TOOL_R);
      const dot = this.add.graphics();
      const mat = (['wood', 'brick', 'steel'] as const)[k]!;
      dot.fillStyle(MAT_COLOR[mat], 1).fillRoundedRect(22, 26, 34, 22, 5);
      dot.lineStyle(3, PALETTE.outline, 1).strokeRoundedRect(22, 26, 34, 22, 5);
      c.add([bg, this.add.image(-4, -6, iconKey(tool)).setScale(0.78 / RS), dot]);
      c.setSize(TOOL_R * 2 + 16, TOOL_R * 2 + 16).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => this.pickTool(tool));
      c.setAlpha(0.55);
      this.tools.set(tool, c);
    });

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 3) this.pickTool(TOOLS[n - 1]!);
      if (e.code === 'Space' || e.code === 'Enter') this.debugPlaceNext();
    });
    addQuitButton(this, () => {
      if (this.closed) return;
      this.closed = true;
      leaveMinigame(this);
    });
    voice.say('bi-intro', { interrupt: true });
  }

  // ---------------------------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------------------------

  private dashedRect(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const dash = 14;
    for (let d = 0; d < w; d += dash * 2) {
      g.lineBetween(x + d, y, x + Math.min(w, d + dash), y);
      g.lineBetween(x + d, y + h, x + Math.min(w, d + dash), y + h);
    }
    for (let d = 0; d < h; d += dash * 2) {
      g.lineBetween(x, y + d, x, y + Math.min(h, d + dash));
      g.lineBetween(x + w, y + d, x + w, y + Math.min(h, d + dash));
    }
  }

  /** The marks that make a material readable without colour alone. */
  private drawPattern(
    g: Phaser.GameObjects.Graphics,
    m: Material,
    x: number,
    y: number,
    w: number,
    h: number,
    alpha: number,
  ): void {
    if (m === 'wood') {
      g.lineStyle(3, darken(MAT_COLOR.wood, 0.3), alpha);
      const rows = Math.max(1, Math.round(h / 22));
      for (let i = 1; i <= rows; i++) {
        const yy = y + (h * i) / (rows + 1);
        g.lineBetween(x + 10, yy, x + w * 0.45, yy);
        g.lineBetween(x + w * 0.55, yy + 3, x + w - 10, yy + 3);
      }
    } else if (m === 'brick') {
      g.lineStyle(3, lighten(MAT_COLOR.brick, 0.55), alpha);
      const rows = Math.max(2, Math.round(h / 26));
      for (let i = 1; i < rows; i++)
        g.lineBetween(x, y + (h * i) / rows, x + w, y + (h * i) / rows);
      for (let i = 0; i < rows; i++) {
        const off = i % 2 ? 0.25 : 0.5;
        for (let k = off; k < 1; k += 0.5) {
          const xx = x + w * k;
          g.lineBetween(xx, y + (h * i) / rows, xx, y + (h * (i + 1)) / rows);
        }
      }
    } else {
      g.fillStyle(darken(MAT_COLOR.steel, 0.35), alpha);
      const n = Math.max(2, Math.round(Math.max(w, h) / 50));
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n;
        if (w >= h) {
          g.fillCircle(x + w * k, y + 9, 4);
          g.fillCircle(x + w * k, y + h - 9, 4);
        } else {
          g.fillCircle(x + 9, y + h * k, 4);
          g.fillCircle(x + w - 9, y + h * k, 4);
        }
      }
    }
  }

  /** A solid piece, centred on (0, 0). */
  private drawPiece(g: Phaser.GameObjects.Graphics, m: Material, w: number, h: number): void {
    const c = MAT_COLOR[m];
    g.clear();
    g.fillStyle(0x000000, 0.2).fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, 9);
    g.fillStyle(c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 9);
    g.fillStyle(lighten(c, 0.3), 1).fillRoundedRect(
      -w / 2 + 4,
      -h / 2 + 4,
      w - 8,
      Math.min(10, h / 3),
      5,
    );
    this.drawPattern(g, m, -w / 2, -h / 2, w, h, 0.9);
    g.lineStyle(5, PALETTE.outline, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 9);
  }

  private slotCentre(slot: number): { x: number; y: number } {
    const p = this.model.pieces[slot]!;
    return { x: this.origin.x + (p.x + p.w / 2) * U, y: this.origin.y + (p.y + p.h / 2) * U };
  }

  // ---------------------------------------------------------------------------------------------
  // Play
  // ---------------------------------------------------------------------------------------------

  private onDragStart(i: number): void {
    if (this.busy || !this.model.canDrag(i)) return;
    const v = this.views[i]!;
    this.tweens.killTweensOf(v.box);
    v.box.setDepth(30);
    this.tweens.add({ targets: v.box, scale: 1.06, duration: 100 });
    sfx.play('pop', 1.2, 0.6);
  }

  private onDrag(i: number, x: number, y: number): void {
    if (this.busy || !this.model.canDrag(i)) return;
    this.views[i]!.box.setPosition(x, y);
  }

  private onDrop(i: number): void {
    if (this.busy || !this.model.canDrag(i)) return;
    const v = this.views[i]!;
    const ev = this.model.drop(i, (v.box.x - this.origin.x) / U, (v.box.y - this.origin.y) / U);
    this.handle(ev);
  }

  private goHome(i: number): void {
    const v = this.views[i]!;
    v.box.setDepth(10);
    this.tweens.add({
      targets: v.box,
      x: v.home.x,
      y: v.home.y,
      scale: v.homeScale,
      duration: 260,
      ease: 'Back.easeOut',
    });
  }

  private handle(ev: BuildEvent | null): void {
    if (!ev) return;
    if (ev.type === 'missed') this.goHome(ev.piece);
    else if (ev.type === 'wrongSlot') {
      sfx.play('boing', 1.1, 0.6);
      voice.say('bi-wrong-slot', { minGapMs: 5000 });
      this.goHome(ev.piece);
    } else if (ev.type === 'placed') {
      const v = this.views[ev.piece]!;
      const c = this.slotCentre(ev.slot);
      this.slotGhosts[ev.slot]?.setVisible(false);
      v.box.setDepth(8).disableInteractive();
      this.tweens.add({
        targets: v.box,
        x: c.x,
        y: c.y,
        scale: 1,
        duration: 140,
        ease: 'Quad.easeOut',
      });
      // Loose until it's fixed: it wobbles and the tools wake up.
      this.tweens.add({
        targets: v.box,
        angle: { from: -2.5, to: 2.5 },
        duration: 260,
        yoyo: true,
        repeat: -1,
        delay: 150,
      });
      sfx.play('thunk', 1.2);
      for (const t of this.tools.values()) t.setAlpha(1);
      this.toolPulse?.remove();
      this.toolPulse = this.tweens.add({
        targets: [...this.tools.values()],
        scale: 1.07,
        duration: 420,
        yoyo: true,
        repeat: -1,
      });
      for (const o of this.views) if (o.box.input?.enabled) o.box.setAlpha(0.5);
      voice.say(this.saidTool ? 'bi-tool-short' : 'bi-tool', { interrupt: !this.saidTool });
      this.saidTool = true;
    } else if (ev.type === 'wrongTool') {
      const t = this.tools.get(ev.tool)!;
      sfx.play('boing', 1.2, 0.6);
      voice.say('bi-wrong-tool', { minGapMs: 3500 });
      this.tweens.add({
        targets: t,
        x: TOOL_X + 10,
        duration: 50,
        yoyo: true,
        repeat: 3,
        onComplete: () => t.setX(TOOL_X),
      });
      if (ev.hint) this.glow(ev.hint);
    } else if (ev.type === 'fixed') this.fix(ev.piece, ev.slot, ev.done);
  }

  /** After two wrong tools: a ring round the right one. */
  private glow(tool: Tool): void {
    const t = this.tools.get(tool)!;
    const ring = this.add
      .circle(t.x, t.y, TOOL_R + 10)
      .setStrokeStyle(8, PALETTE.coinGold)
      .setDepth(11);
    this.tweens.add({
      targets: ring,
      scale: 1.25,
      alpha: 0,
      duration: 700,
      repeat: 3,
      onComplete: () => ring.destroy(),
    });
  }

  pickTool(tool: Tool): void {
    if (this.busy || this.closed) return;
    this.handle(this.model.fasten(tool));
  }

  /** The tool flies over, taps three times, and the piece is solid. */
  private fix(piece: number, slot: number, done: boolean): void {
    this.busy = true;
    const v = this.views[piece]!;
    const tool = this.model.pieces[piece]!.material;
    const key = iconKey(tool === 'wood' ? 'hammer' : tool === 'brick' ? 'trowel' : 'wrench');
    this.toolPulse?.remove();
    this.toolPulse = null;
    for (const t of this.tools.values()) t.setScale(1).setAlpha(0.55);
    this.tweens.killTweensOf(v.box);
    v.box.setAngle(0);
    const c = this.slotCentre(slot);
    const img = this.add
      .image(TOOL_X, 300, key)
      .setScale(0.9 / RS)
      .setDepth(40);
    this.tweens.add({
      targets: img,
      x: c.x + 30,
      y: c.y - 46,
      duration: 220,
      ease: 'Quad.easeOut',
    });
    for (let k = 0; k < 3; k++) {
      this.time.delayedCall(240 + k * 150, () => {
        sfx.play(tool === 'brick' ? 'pop' : 'thunk', 1 + k * 0.15, 0.8);
        this.tweens.add({ targets: img, angle: -38, y: c.y - 20, duration: 60, yoyo: true });
        this.tweens.add({ targets: v.box, scaleY: 0.93, duration: 60, yoyo: true });
      });
    }
    this.time.delayedCall(760, () => {
      img.destroy();
      sfx.play('sparkle');
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const st = this.add
          .image(c.x, c.y, HUD.star)
          .setScale(0.22 / RS)
          .setDepth(41);
        this.tweens.add({
          targets: st,
          x: c.x + Math.cos(a) * 80,
          y: c.y + Math.sin(a) * 60,
          alpha: 0,
          duration: 500,
          onComplete: () => st.destroy(),
        });
      }
      const pip = this.pips[this.model.fixedCount - 1];
      if (pip) {
        pip.setFillStyle(PALETTE.coinGold, 1);
        this.tweens.add({ targets: pip, scale: 1.5, duration: 120, yoyo: true });
      }
      for (const o of this.views) if (o.box.input?.enabled) o.box.setAlpha(1);
      this.busy = false;
      if (done) this.finish();
      else voice.say('bi-fixed', { minGapMs: 4000 });
    });
  }

  private finish(): void {
    if (this.closed) return;
    this.busy = true;
    sfx.play('tada');
    voice.say('bi-done', { interrupt: true });
    // The whole picture jumps for joy, then back to the city where the real thing pops up.
    for (const v of this.views)
      this.tweens.add({ targets: v.box, y: v.box.y - 26, duration: 180, yoyo: true, repeat: 1 });
    const big = this.add
      .image(PAPER.x + PAPER.w / 2, PAPER.y + PAPER.h / 2, HUD.check)
      .setScale(0)
      .setDepth(50);
    this.tweens.add({
      targets: big,
      scale: 1.2 / RS,
      delay: 500,
      duration: 300,
      ease: 'Back.easeOut',
    });
    this.time.delayedCall(1500, () => this.close());
  }

  private close(): void {
    if (this.closed) return;
    this.closed = true;
    this.scene.stop();
    this.scene.resume('City');
    this.scene.wake('Hud');
    this.game.events.emit(EV.menuClosed, {});
    this.game.events.emit(EV.buildDone, { spot: this.site });
  }

  // ---------------------------------------------------------------------------------------------
  // Keyboard play and test hooks
  // ---------------------------------------------------------------------------------------------

  /** Put the next piece into its slot (Space on a keyboard). */
  debugPlaceNext(): boolean {
    if (this.busy || this.closed) return false;
    const ev = this.model.placeNext();
    this.handle(ev);
    return !!ev;
  }

  /** Where a tray piece and its slot are (logical px), for drag tests. */
  debugDragPath(): { from: { x: number; y: number }; to: { x: number; y: number } } | null {
    const i = this.model.state.findIndex((_, k) => this.model.canDrag(k));
    if (i < 0) return null;
    return { from: { ...this.views[i]!.home }, to: this.slotCentre(i) };
  }

  debugState() {
    return {
      site: this.site,
      fixed: this.model.fixedCount,
      total: this.model.pieces.length,
      pending: this.model.pending,
      toolNeeded: this.model.toolNeeded,
      busy: this.busy,
    };
  }

  /** Build everything now and go back to the city. */
  debugFinish(): void {
    while (!this.model.done) {
      this.model.placeNext();
      const need = this.model.toolNeeded;
      if (need) this.model.fasten(need);
    }
    this.close();
  }
}
