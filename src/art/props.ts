import type Phaser from 'phaser';
import { PALETTE } from '../config';
import { darken, lighten } from './color';
import { bakeParts, type BakedMeta } from './blocks';
import { project } from './isoShapes';
import { drawIcon } from './icons';
import { drawBubble, drawPadBase } from './missionProps';

/** World props. Every texture's grid origin is the prop's ground point. */
export const PROP = {
  cone: 'prop-cone',
  trashcan: 'prop-trashcan',
  trafficLight: 'prop-traffic-light',
  pad: 'prop-minigame-pad',
  donut: 'pickup-donut',
  bubble: 'bubble-donut',
  puff: 'fx-puff',
  bench: 'prop-bench',
  lamp: 'prop-lamp',
  planter: 'prop-planter',
  flowers: 'prop-flowers',
  buoy: 'prop-buoy',
} as const;

export function bakeProps(scene: Phaser.Scene): Record<keyof typeof PROP, BakedMeta> {
  const cone = bakeParts(scene, PROP.cone, [
    {
      type: 'block',
      gx: -0.17,
      gy: -0.17,
      w: 0.34,
      d: 0.34,
      h: 0.08,
      color: PALETTE.coneOrange,
      bevel: 1,
    },
    {
      type: 'custom',
      bounds: [
        { x: -12, y: -34 },
        { x: 12, y: 4 },
      ],
      draw: (g, ox, oy, s) => {
        const b = project(0, 0, 0.08, s);
        const x = b.x + ox;
        const y = b.y + oy;
        const pts = [
          { x: x - 8 * s, y },
          { x: x - 2 * s, y: y - 26 * s },
          { x: x + 2 * s, y: y - 26 * s },
          { x: x + 8 * s, y },
        ];
        // Half-width of the cone at a height above its base.
        const hw = (up: number) => 8 - (6 * up) / 26;
        const bandAt = (u0: number, u1: number) => [
          { x: x - hw(u0) * s, y: y - u0 * s },
          { x: x + hw(u0) * s, y: y - u0 * s },
          { x: x + hw(u1) * s, y: y - u1 * s },
          { x: x - hw(u1) * s, y: y - u1 * s },
        ];
        g.fillStyle(PALETTE.coneOrange, 1);
        g.fillPoints(pts, true);
        g.fillStyle(darken(PALETTE.coneOrange, 0.16), 1);
        g.fillPoints(
          [
            { x: x + 2 * s, y },
            { x: x + 0.5 * s, y: y - 26 * s },
            { x: x + 2 * s, y: y - 26 * s },
            { x: x + 8 * s, y },
          ],
          true,
        );
        g.fillStyle(0xffffff, 1);
        g.fillPoints(bandAt(9, 14), true);
        g.fillPoints(bandAt(18, 21), true);
        g.lineStyle(2 * s, PALETTE.outline, 1);
        g.strokePoints(pts, true);
      },
    },
  ]);

  const trashcan = bakeParts(scene, PROP.trashcan, [
    { type: 'block', gx: -0.16, gy: -0.16, w: 0.32, d: 0.32, h: 0.55, color: 0x6e9a6a, bevel: 2 },
    {
      type: 'block',
      gx: -0.19,
      gy: -0.19,
      gz: 0.55,
      w: 0.38,
      d: 0.38,
      h: 0.08,
      color: darken(0x6e9a6a, 0.15),
      bevel: 1,
    },
  ]);

  const trafficLight = bakeParts(scene, PROP.trafficLight, [
    { type: 'block', gx: -0.05, gy: -0.05, w: 0.1, d: 0.1, h: 1.6, color: 0x4a4e5c, bevel: 1 },
    {
      type: 'block',
      gx: -0.13,
      gy: -0.13,
      gz: 1.6,
      w: 0.26,
      d: 0.26,
      h: 0.8,
      color: 0x3a3d4a,
      bevel: 2,
    },
    {
      type: 'custom',
      bounds: [],
      draw: (g, ox, oy, s) => {
        const colors = [PALETTE.fireRed, PALETTE.coinGold, PALETTE.grass];
        // Lamps on the left face, squashed a little so they lie in the face. Green is lit.
        colors.forEach((c, i) => {
          const p = project(0, 0.13, 2.22 - i * 0.22, s);
          g.fillStyle(i === 2 ? lighten(c, 0.2) : darken(c, 0.3), 1);
          g.fillEllipse(p.x + ox, p.y + oy, 5.6 * s, 6.2 * s);
          g.lineStyle(1.2 * s, PALETTE.outline, 1);
          g.strokeEllipse(p.x + ox, p.y + oy, 5.6 * s, 6.2 * s);
        });
      },
    },
  ]);

  // Minigame pad: a round ground sign with a traffic-light picture. Walk onto it to play.
  const pad = bakeParts(scene, PROP.pad, [
    {
      type: 'custom',
      bounds: [
        { x: -34, y: -40 },
        { x: 34, y: 18 },
      ],
      draw: (g, ox, oy, s) => {
        drawPadBase(g, ox, oy, s);
        drawIcon(g, 'trafficLight', ox, oy - 24 * s, 17 * s, s);
      },
    },
  ]);

  const donut = bakeParts(scene, PROP.donut, [
    {
      type: 'custom',
      bounds: [
        { x: -16, y: -34 },
        { x: 16, y: 6 },
      ],
      draw: (g, ox, oy, s) => {
        g.fillStyle(0x000000, 0.18);
        g.fillEllipse(ox, oy, 24 * s, 9 * s);
        drawIcon(g, 'donut', ox, oy - 16 * s, 15 * s, s);
      },
    },
  ]);

  // Picture speech bubble with a donut in it.
  const bubble = bakeParts(scene, PROP.bubble, [
    {
      type: 'custom',
      bounds: [
        { x: -30, y: -62 },
        { x: 30, y: 2 },
      ],
      draw: (g, ox, oy, s) => {
        const x = ox;
        const y = oy - 34 * s;
        drawBubble(g, x, y, oy, s);
        drawIcon(g, 'donut', x, y, 16 * s, s);
      },
    },
  ]);

  const puff = bakeParts(scene, PROP.puff, [
    {
      type: 'custom',
      bounds: [
        { x: -26, y: -26 },
        { x: 26, y: 26 },
      ],
      draw: (g, ox, oy, s) => {
        // One soft cloud: the outline is drawn round the whole clump, not round each ball.
        const balls = [
          [-10, 4, 11],
          [10, 4, 11],
          [0, -8, 13],
          [0, 8, 10],
        ] as const;
        g.fillStyle(0xb9c0cc, 1);
        for (const [dx, dy, r] of balls) g.fillCircle(ox + dx * s, oy + dy * s, (r + 1.6) * s);
        g.fillStyle(0xffffff, 1);
        for (const [dx, dy, r] of balls) g.fillCircle(ox + dx * s, oy + dy * s, r * s);
        g.fillStyle(0xe6e9f0, 1);
        g.fillEllipse(ox + 4 * s, oy + 11 * s, 22 * s, 7 * s);
      },
    },
  ]);

  // Street furniture and sea things (spec 008). None of them block the way.
  const wood = 0xb9834d;
  const bench = bakeParts(scene, PROP.bench, [
    { type: 'block', gx: -0.3, gy: -0.1, w: 0.08, d: 0.2, h: 0.2, color: 0x4a4e5c, bevel: 1 },
    { type: 'block', gx: 0.22, gy: -0.1, w: 0.08, d: 0.2, h: 0.2, color: 0x4a4e5c, bevel: 1 },
    {
      type: 'block',
      gx: -0.34,
      gy: -0.13,
      gz: 0.2,
      w: 0.68,
      d: 0.26,
      h: 0.07,
      color: wood,
      bevel: 1,
    },
    {
      type: 'block',
      gx: -0.34,
      gy: -0.16,
      gz: 0.27,
      w: 0.68,
      d: 0.06,
      h: 0.24,
      color: wood,
      bevel: 1,
    },
  ]);
  const lamp = bakeParts(scene, PROP.lamp, [
    { type: 'block', gx: -0.08, gy: -0.08, w: 0.16, d: 0.16, h: 0.12, color: 0x4a4e5c, bevel: 1 },
    {
      type: 'block',
      gx: -0.035,
      gy: -0.035,
      gz: 0.12,
      w: 0.07,
      d: 0.07,
      h: 1.5,
      color: 0x5a5f6b,
      bevel: 1,
    },
    {
      type: 'block',
      gx: -0.12,
      gy: -0.12,
      gz: 1.62,
      w: 0.24,
      d: 0.24,
      h: 0.24,
      color: 0xfff1a8,
      bevel: 2,
    },
    {
      type: 'block',
      gx: -0.15,
      gy: -0.15,
      gz: 1.86,
      w: 0.3,
      d: 0.3,
      h: 0.07,
      color: 0x4a4e5c,
      bevel: 1,
    },
  ]);
  const flowerDots = (
    g: Phaser.GameObjects.Graphics,
    ox: number,
    oy: number,
    s: number,
    z: number,
    spread: number,
  ) => {
    const cols = [PALETTE.fireRed, PALETTE.coinGold, 0xffffff, PALETTE.donutPink, 0xb48cf0];
    // Back row first, so nearer flowers overlap the ones behind them.
    const spots = Array.from({ length: 7 }, (_, i) => {
      const a = i * 2.4;
      const r = (0.08 + (i % 3) * 0.07) * spread;
      return { i, x: Math.cos(a) * r, y: Math.sin(a) * r };
    }).sort((p, q) => p.x + p.y - (q.x + q.y));
    for (const sp of spots) {
      const p = project(sp.x, sp.y, z, s);
      const x = p.x + ox;
      const y = p.y + oy;
      const top = y - (7 + (sp.i % 2) * 2) * s;
      // Stem with a leaf, then five petals round a middle.
      g.lineStyle(3.2 * s, PALETTE.outline, 1);
      g.lineBetween(x, y, x, top);
      g.lineStyle(1.6 * s, PALETTE.leaf, 1);
      g.lineBetween(x, y, x, top);
      g.fillStyle(PALETTE.outline, 1);
      g.fillCircle(x, top, 4.4 * s);
      g.fillStyle(cols[sp.i % cols.length]!, 1);
      g.fillCircle(x, top, 3.3 * s);
      g.fillStyle(sp.i % cols.length === 1 ? 0xffffff : PALETTE.coinGold, 1);
      g.fillCircle(x, top, 1.3 * s);
    }
  };
  const planter = bakeParts(scene, PROP.planter, [
    { type: 'block', gx: -0.3, gy: -0.3, w: 0.6, d: 0.6, h: 0.22, color: 0xc98a5e, bevel: 2 },
    {
      type: 'block',
      gx: -0.24,
      gy: -0.24,
      gz: 0.22,
      w: 0.48,
      d: 0.48,
      h: 0.04,
      color: 0x6b4a2f,
      bevel: 1,
    },
    {
      type: 'custom',
      bounds: [
        { x: -18, y: -30 },
        { x: 18, y: 4 },
      ],
      draw: (g, ox, oy, s) => flowerDots(g, ox, oy, s, 0.26, 0.8),
    },
  ]);
  const flowers = bakeParts(scene, PROP.flowers, [
    {
      type: 'custom',
      bounds: [
        { x: -20, y: -22 },
        { x: 20, y: 12 },
      ],
      draw: (g, ox, oy, s) => flowerDots(g, ox, oy, s, 0, 1.3),
    },
  ]);
  const buoy = bakeParts(scene, PROP.buoy, [
    {
      type: 'custom',
      bounds: [
        { x: -16, y: -44 },
        { x: 16, y: 8 },
      ],
      draw: (g, ox, oy, s) => {
        g.fillStyle(0xffffff, 0.5);
        g.fillEllipse(ox, oy, 30 * s, 12 * s);
        const body = [
          { x: ox - 10 * s, y: oy },
          { x: ox - 6 * s, y: oy - 20 * s },
          { x: ox + 6 * s, y: oy - 20 * s },
          { x: ox + 10 * s, y: oy },
        ];
        g.fillStyle(PALETTE.fireRed, 1);
        g.fillPoints(body, true);
        g.fillStyle(0xffffff, 1);
        g.fillRect(ox - 8 * s, oy - 12 * s, 16 * s, 5 * s);
        g.lineStyle(2 * s, PALETTE.outline, 1);
        g.strokePoints(body, true);
        g.lineBetween(ox, oy - 20 * s, ox, oy - 32 * s);
        g.fillStyle(PALETTE.coinGold, 1);
        g.fillCircle(ox, oy - 35 * s, 4.5 * s);
        g.strokeCircle(ox, oy - 35 * s, 4.5 * s);
      },
    },
  ]);

  return {
    cone,
    trashcan,
    trafficLight,
    pad,
    donut,
    bubble,
    puff,
    bench,
    lamp,
    planter,
    flowers,
    buoy,
  };
}
