import type Phaser from 'phaser';
import { PALETTE } from '../config';
import { lighten } from './color';
import { bakeParts, type BakedMeta, type Part } from './blocks';
import { drawIcon, type IconName } from './icons';

/** World props for missions (spec 003+). Every texture's origin is the thing's ground point. */
export const MPROP = {
  bush: 'prop-bush',
  bushShake: 'prop-bush-shake',
  board: 'prop-board',
  flag: 'prop-flag',
  flagDone: 'prop-flag-done',
  net: 'fx-net',
  netted: 'fx-netted',
  duck: 'char-duck',
  duckling: 'char-duckling',
  puppy: 'char-puppy',
  paw: 'fx-paw',
  sparkle: 'fx-sparkle',
  fire: 'fx-fire',
  fire2: 'fx-fire-2',
  kitten: 'char-kitten',
  parrot: 'char-parrot',
  grill: 'prop-grill',
  door: 'prop-door',
  drop: 'fx-drop',
} as const;

export const bubbleKey = (icon: IconName) => `bubble-${icon}`;
export const padKey = (icon: IconName) => `pad-${icon}`;

type G = Phaser.GameObjects.Graphics;

function custom(
  bounds: [number, number, number, number],
  draw: (g: G, ox: number, oy: number, s: number) => void,
): Part {
  return {
    type: 'custom',
    bounds: [
      { x: bounds[0], y: bounds[1] },
      { x: bounds[2], y: bounds[3] },
    ],
    draw,
  };
}

/** A picture speech bubble with an icon in it (origin = just above the speaker's head). */
export function bakeBubble(scene: Phaser.Scene, icon: IconName): BakedMeta {
  return bakeParts(scene, bubbleKey(icon), [
    custom([-30, -62, 30, 2], (g, ox, oy, s) => {
      const x = ox;
      const y = oy - 34 * s;
      g.fillStyle(0xffffff, 1);
      g.lineStyle(3 * s, PALETTE.outline, 1);
      g.fillCircle(x, y, 25 * s);
      g.strokeCircle(x, y, 25 * s);
      const tail = [
        { x: x - 8 * s, y: y + 20 * s },
        { x: x + 4 * s, y: y + 22 * s },
        { x: x - 6 * s, y: oy },
      ];
      g.fillPoints(tail, true);
      g.lineBetween(tail[0]!.x, tail[0]!.y + 2 * s, tail[2]!.x, tail[2]!.y);
      g.lineBetween(tail[1]!.x, tail[1]!.y + 1 * s, tail[2]!.x, tail[2]!.y);
      drawIcon(g, icon, x, y, 16 * s, s);
    }),
  ]);
}

/** A round gold ground pad with a standing picture: walk onto it to play / open something. */
export function bakePad(scene: Phaser.Scene, icon: IconName): BakedMeta {
  return bakeParts(scene, padKey(icon), [
    custom([-34, -54, 34, 18], (g, ox, oy, s) => {
      g.fillStyle(PALETTE.coinGold, 1);
      g.fillEllipse(ox, oy, 60 * s, 30 * s);
      g.lineStyle(3 * s, PALETTE.outline, 1);
      g.strokeEllipse(ox, oy, 60 * s, 30 * s);
      g.fillStyle(lighten(PALETTE.coinGold, 0.4), 1);
      g.fillEllipse(ox, oy - 2 * s, 44 * s, 20 * s);
      drawIcon(g, icon, ox, oy - 28 * s, 18 * s, s);
    }),
  ]);
}

function duckBody(g: G, x: number, y: number, r: number, s: number, color: number): void {
  g.lineStyle(2.5 * s, PALETTE.outline, 1);
  g.fillStyle(color, 1);
  g.fillEllipse(x - r * 0.1, y + r * 0.25, r * 1.5, r * 1.0);
  g.strokeEllipse(x - r * 0.1, y + r * 0.25, r * 1.5, r * 1.0);
  g.fillCircle(x + r * 0.35, y - r * 0.35, r * 0.45);
  g.strokeCircle(x + r * 0.35, y - r * 0.35, r * 0.45);
  g.fillStyle(PALETTE.coneOrange, 1);
  g.fillTriangle(x + r * 0.75, y - r * 0.4, x + r * 1.1, y - r * 0.25, x + r * 0.75, y - r * 0.1);
  g.fillStyle(PALETTE.outline, 1);
  g.fillCircle(x + r * 0.45, y - r * 0.45, Math.max(1.2 * s, r * 0.09));
}

function bush(shake: number): Part {
  return custom([-34, -44, 34, 10], (g, ox, oy, s) => {
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(ox, oy, 46 * s, 14 * s);
    g.lineStyle(2.5 * s, PALETTE.outline, 1);
    for (const [dx, dy, r] of [
      [-12, -12, 13],
      [12, -12, 13],
      [0, -22, 15],
      [0, -8, 14],
    ] as const) {
      const x = ox + (dx + shake * (dy < -15 ? 1 : -1)) * s;
      g.fillStyle(dy < -15 ? lighten(PALETTE.leaf, 0.12) : PALETTE.leaf, 1);
      g.fillCircle(x, oy + dy * s, r * s);
      g.strokeCircle(x, oy + dy * s, r * s);
    }
  });
}

function flag(color: number): Part {
  return custom([-14, -78, 42, 8], (g, ox, oy, s) => {
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(ox, oy, 20 * s, 7 * s);
    g.lineStyle(4 * s, PALETTE.outline, 1);
    g.lineBetween(ox, oy, ox, oy - 72 * s);
    const f = [
      { x: ox, y: oy - 72 * s },
      { x: ox + 36 * s, y: oy - 60 * s },
      { x: ox, y: oy - 46 * s },
    ];
    g.fillStyle(color, 1);
    g.fillPoints(f, true);
    g.lineStyle(3 * s, PALETTE.outline, 1);
    g.strokePoints(f, true);
  });
}

export function bakeMissionProps(scene: Phaser.Scene): void {
  bakeParts(scene, MPROP.bush, [bush(0)]);
  bakeParts(scene, MPROP.bushShake, [bush(4)]);

  // Mission board: a big blue sign on two legs with three picture cards.
  bakeParts(scene, MPROP.board, [
    custom([-42, -96, 42, 10], (g, ox, oy, s) => {
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(ox, oy, 60 * s, 14 * s);
      g.lineStyle(3 * s, PALETTE.outline, 1);
      g.fillStyle(PALETTE.trunk, 1);
      for (const x of [-26, 20]) {
        g.fillRect(ox + x * s, oy - 40 * s, 6 * s, 40 * s);
        g.strokeRect(ox + x * s, oy - 40 * s, 6 * s, 40 * s);
      }
      g.fillStyle(PALETTE.policeBlue, 1);
      g.fillRoundedRect(ox - 38 * s, oy - 90 * s, 76 * s, 54 * s, 8 * s);
      g.strokeRoundedRect(ox - 38 * s, oy - 90 * s, 76 * s, 54 * s, 8 * s);
      const icons: IconName[] = ['flag', 'donut', 'duck'];
      icons.forEach((ic, i) => {
        const cx = ox + (i - 1) * 23 * s;
        g.fillStyle(0xffffff, 1);
        g.fillRoundedRect(cx - 10 * s, oy - 82 * s, 20 * s, 28 * s, 3 * s);
        drawIcon(g, ic, cx, oy - 68 * s, 8 * s, s * 0.5);
      });
      drawIcon(g, 'star', ox, oy - 46 * s, 6 * s, s * 0.5);
    }),
  ]);

  bakeParts(scene, MPROP.flag, [flag(PALETTE.fireRed)]);
  bakeParts(scene, MPROP.flagDone, [flag(PALETTE.grass)]);

  const net = (size: number) =>
    custom([-size - 4, -size - 4, size + 4, size + 4], (g, ox, oy, s) =>
      drawIcon(g, 'net', ox, oy, size * s, s),
    );
  bakeParts(scene, MPROP.net, [net(18)]);
  bakeParts(scene, MPROP.netted, [net(36)]);

  const duck = (size: number, color: number) =>
    custom([-24 * size, -42 * size, 28 * size, 8], (g, ox, oy, s) => {
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(ox, oy, 26 * size * s, 9 * size * s);
      duckBody(g, ox, oy - 16 * size * s, 15 * size * s, s, color);
    });
  bakeParts(scene, MPROP.duck, [duck(1.5, 0xffd23f)]);
  bakeParts(scene, MPROP.duckling, [duck(1, 0xfff08a)]);

  bakeParts(scene, MPROP.puppy, [
    custom([-24, -42, 24, 8], (g, ox, oy, s) => {
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(ox, oy, 28 * s, 9 * s);
      drawIcon(g, 'puppy', ox, oy - 18 * s, 17 * s, s);
    }),
  ]);
  bakeParts(scene, MPROP.paw, [
    custom([-12, -10, 12, 10], (g, ox, oy, s) => {
      g.fillStyle(0x6b4a2e, 0.75);
      g.fillEllipse(ox, oy + 2 * s, 10 * s, 7 * s);
      for (const dx of [-5, 0, 5]) g.fillCircle(ox + dx * s, oy - 4 * s, 2.2 * s);
    }),
  ]);
  bakeParts(scene, MPROP.sparkle, [
    custom([-20, -20, 20, 20], (g, ox, oy, s) => drawIcon(g, 'star', ox, oy, 14 * s, s * 0.6)),
  ]);

  // A grumpy cartoon flame (two frames for flicker). Friendly foe: it says "pfft" when it's out.
  for (const [key, lean] of [
    [MPROP.fire, 0],
    [MPROP.fire2, 1],
  ] as const) {
    bakeParts(scene, key, [
      custom([-26, -58, 26, 6], (g, ox, oy, s) => {
        g.fillStyle(0x000000, 0.15);
        g.fillEllipse(ox, oy, 34 * s, 10 * s);
        drawIcon(g, 'flame', ox + lean * 2 * s, oy - 26 * s - lean * 2 * s, 24 * s, s);
      }),
    ]);
  }
  bakeParts(scene, MPROP.kitten, [
    custom([-22, -42, 22, 6], (g, ox, oy, s) => drawIcon(g, 'kitten', ox, oy - 18 * s, 17 * s, s)),
  ]);
  bakeParts(scene, MPROP.parrot, [
    custom([-22, -46, 22, 6], (g, ox, oy, s) => drawIcon(g, 'parrot', ox, oy - 20 * s, 18 * s, s)),
  ]);
  bakeParts(scene, MPROP.grill, [
    custom([-30, -50, 30, 8], (g, ox, oy, s) => {
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(ox, oy, 40 * s, 12 * s);
      drawIcon(g, 'grill', ox, oy - 22 * s, 22 * s, s);
    }),
  ]);
  // A door mat with an arrow pointing in: walk onto it to go inside.
  bakeParts(scene, MPROP.door, [
    custom([-34, -50, 34, 18], (g, ox, oy, s) => {
      g.fillStyle(PALETTE.fireRed, 1);
      g.fillEllipse(ox, oy, 56 * s, 26 * s);
      g.lineStyle(3 * s, PALETTE.outline, 1);
      g.strokeEllipse(ox, oy, 56 * s, 26 * s);
      g.fillStyle(0xffffff, 1);
      const pts = [
        { x: ox, y: oy - 44 * s },
        { x: ox + 14 * s, y: oy - 24 * s },
        { x: ox + 6 * s, y: oy - 24 * s },
        { x: ox + 6 * s, y: oy - 8 * s },
        { x: ox - 6 * s, y: oy - 8 * s },
        { x: ox - 6 * s, y: oy - 24 * s },
        { x: ox - 14 * s, y: oy - 24 * s },
      ];
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
    }),
  ]);
  bakeParts(scene, MPROP.drop, [
    custom([-8, -8, 8, 8], (g, ox, oy, s) => {
      g.fillStyle(0x7ec8f2, 1);
      g.fillCircle(ox, oy, 5 * s);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(ox - 1.5 * s, oy - 1.5 * s, 1.6 * s);
    }),
  ]);

  // Things to pick up (loot and lost things), bobbing on the ground.
  for (const item of ['sock', 'rubberDuck', 'balloon', 'cake'] as IconName[]) {
    bakeParts(scene, `pickup-${item}`, [
      custom([-18, -40, 18, 8], (g, ox, oy, s) => {
        g.fillStyle(0x000000, 0.18);
        g.fillEllipse(ox, oy, 24 * s, 9 * s);
        drawIcon(g, item, ox, oy - 18 * s, 13 * s, s * 0.8);
      }),
    ]);
  }

  const bubbles: IconName[] = [
    'star',
    'duck',
    'puppy',
    'sock',
    'rubberDuck',
    'balloon',
    'kitten',
    'pizza',
    'cake',
    'parrot',
    'brick',
    'wrench',
    'flag',
    'donut',
    'scooter',
    'twoRobbers',
    'bike',
    'flame',
    'toaster',
    'grill',
    'firework',
    'tower',
    'dock',
    'mixer',
    'lighthouse',
    'boat',
    'bridge',
    'hardHat',
    'helmet',
    'ladder',
  ];
  for (const b of bubbles) bakeBubble(scene, b);
  const pads: IconName[] = [
    'toaster',
    'trafficLight',
    'magnifier',
    'window',
    'ladder',
    'crane',
    'grid',
    'bucket',
    'uniforms',
  ];
  for (const p of pads) bakePad(scene, p);
}
