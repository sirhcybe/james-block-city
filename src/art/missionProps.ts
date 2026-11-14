import type Phaser from 'phaser';
import { PALETTE } from '../config';
import { darken, lighten } from './color';
import { bakeParts, type BakedMeta, type Part } from './blocks';
import { drawFlame, drawIcon, type IconName } from './icons';

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

/** The white speech bubble: a circle and its tail drawn as one outlined shape. */
export function drawBubble(g: G, x: number, y: number, tipY: number, s: number): void {
  const tail = [
    { x: x - 9 * s, y: y + 19 * s },
    { x: x + 5 * s, y: y + 22 * s },
    { x: x - 6 * s, y: tipY - 1.5 * s },
  ];
  g.lineStyle(5 * s, PALETTE.outline, 1);
  g.strokeCircle(x, y, 25 * s);
  g.strokePoints(tail, true);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(x, y, 25 * s);
  g.fillPoints(tail, true);
  // A soft shade along the bottom so the bubble reads as round.
  g.lineStyle(2.5 * s, 0xdfe3ec, 1);
  g.beginPath();
  g.arc(x, y, 21.5 * s, Math.PI * 0.12, Math.PI * 0.62, false);
  g.strokePath();
}

/** A picture speech bubble with an icon in it (origin = just above the speaker's head). */
export function bakeBubble(scene: Phaser.Scene, icon: IconName): BakedMeta {
  return bakeParts(scene, bubbleKey(icon), [
    custom([-30, -62, 30, 2], (g, ox, oy, s) => {
      const x = ox;
      const y = oy - 34 * s;
      drawBubble(g, x, y, oy, s);
      drawIcon(g, icon, x, y, 16 * s, s);
    }),
  ]);
}

/** The round gold pad on the ground: a rim with a thin edge below it and a bright middle. */
export function drawPadBase(g: G, ox: number, oy: number, s: number): void {
  g.fillStyle(darken(PALETTE.coinGold, 0.22), 1);
  g.fillEllipse(ox, oy + 2.5 * s, 60 * s, 30 * s);
  g.lineStyle(2.5 * s, PALETTE.outline, 1);
  g.strokeEllipse(ox, oy + 2.5 * s, 60 * s, 30 * s);
  g.fillStyle(PALETTE.coinGold, 1);
  g.fillEllipse(ox, oy, 60 * s, 30 * s);
  g.strokeEllipse(ox, oy, 60 * s, 30 * s);
  g.fillStyle(lighten(PALETTE.coinGold, 0.45), 1);
  g.fillEllipse(ox, oy - 1 * s, 44 * s, 20 * s);
  g.lineStyle(1.5 * s, 0xffffff, 0.8);
  g.beginPath();
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * (1.05 + (0.4 * i) / 8);
    const px = ox + Math.cos(a) * 19 * s;
    const py = oy - 1 * s + Math.sin(a) * 8 * s;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.strokePath();
}

/** A round gold ground pad with a standing picture: walk onto it to play / open something. */
export function bakePad(scene: Phaser.Scene, icon: IconName): BakedMeta {
  return bakeParts(scene, padKey(icon), [
    custom([-34, -54, 34, 18], (g, ox, oy, s) => {
      drawPadBase(g, ox, oy, s);
      drawIcon(g, icon, ox, oy - 28 * s, 18 * s, s);
    }),
  ]);
}

function bush(shake: number): Part {
  return custom([-34, -44, 34, 10], (g, ox, oy, s) => {
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(ox, oy, 50 * s, 14 * s);
    // Four leafy balls drawn as one outlined clump; the top one sways when the bush shakes.
    const balls = (
      [
        [-13, -11, 13],
        [13, -11, 13],
        [0, -23, 15],
        [0, -8, 14],
      ] as const
    ).map(([dx, dy, r]) => ({
      x: ox + (dx + shake * (dy < -15 ? 1 : -1)) * s,
      y: oy + dy * s,
      r: r * s,
      top: dy < -15,
    }));
    g.fillStyle(PALETTE.outline, 1);
    for (const b of balls) g.fillCircle(b.x, b.y, b.r + 2.2 * s);
    for (const b of balls) {
      g.fillStyle(b.top ? lighten(PALETTE.leaf, 0.12) : PALETTE.leaf, 1);
      g.fillCircle(b.x, b.y, b.r);
    }
    // Light on the upper left of each ball, a few darker leaves low down.
    for (const b of balls) {
      g.fillStyle(lighten(PALETTE.leaf, 0.35), 0.8);
      g.fillEllipse(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.7, b.r * 0.45);
    }
    g.fillStyle(darken(PALETTE.leaf, 0.18), 1);
    for (const [dx, dy] of [
      [-16, -4],
      [4, -2],
      [17, -6],
    ] as const)
      g.fillEllipse(ox + (dx - shake) * s, oy + dy * s, 7 * s, 4 * s);
  });
}

function flag(color: number): Part {
  return custom([-14, -80, 42, 8], (g, ox, oy, s) => {
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(ox, oy, 20 * s, 7 * s);
    const f = [
      { x: ox, y: oy - 72 * s },
      { x: ox + 36 * s, y: oy - 59 * s },
      { x: ox, y: oy - 46 * s },
    ];
    g.fillStyle(color, 1);
    g.fillPoints(f, true);
    g.fillStyle(darken(color, 0.16), 1);
    g.fillPoints([f[2]!, { x: ox + 36 * s, y: oy - 59 * s }, { x: ox, y: oy - 56 * s }], true);
    g.lineStyle(2.5 * s, PALETTE.outline, 1);
    g.strokePoints(f, true);
    g.lineStyle(4 * s, PALETTE.outline, 1);
    g.lineBetween(ox, oy, ox, oy - 73 * s);
    g.fillStyle(PALETTE.coinGold, 1);
    g.fillCircle(ox, oy - 75 * s, 3.2 * s);
    g.lineStyle(1.6 * s, PALETTE.outline, 1);
    g.strokeCircle(ox, oy - 75 * s, 3.2 * s);
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
      g.fillStyle(lighten(PALETTE.policeBlue, 0.2), 1);
      g.fillRoundedRect(ox - 34 * s, oy - 87.5 * s, 68 * s, 3 * s, 1.5 * s);
      g.fillStyle(darken(PALETTE.policeBlue, 0.2), 1);
      g.fillRoundedRect(ox - 34 * s, oy - 41.5 * s, 68 * s, 3 * s, 1.5 * s);
      g.lineStyle(3 * s, PALETTE.outline, 1);
      g.strokeRoundedRect(ox - 38 * s, oy - 90 * s, 76 * s, 54 * s, 8 * s);
      const icons: IconName[] = ['flag', 'donut', 'duck'];
      icons.forEach((ic, i) => {
        const cx = ox + (i - 1) * 23 * s;
        g.fillStyle(0xffffff, 1);
        g.fillRoundedRect(cx - 10 * s, oy - 82 * s, 20 * s, 28 * s, 3 * s);
        g.lineStyle(1.5 * s, PALETTE.outline, 1);
        g.strokeRoundedRect(cx - 10 * s, oy - 82 * s, 20 * s, 28 * s, 3 * s);
        drawIcon(g, ic, cx, oy - 68 * s, 7.5 * s, s * 0.5);
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
      drawIcon(
        g,
        color === 0xffd23f ? 'rubberDuck' : 'duckHat',
        ox,
        oy - 15 * size * s,
        17 * size * s,
        s,
      );
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
      // A paw print on the ground: one pad and three toes in an arc over it.
      g.fillStyle(0x6b4a2e, 0.75);
      g.fillEllipse(ox, oy + 2.5 * s, 10 * s, 7 * s);
      for (const [dx, dy] of [
        [-5.5, -3],
        [0, -5.2],
        [5.5, -3],
      ] as const)
        g.fillEllipse(ox + dx * s, oy + dy * s, 3.8 * s, 4.6 * s);
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
        drawFlame(g, ox, oy - 26 * s, 24 * s, s, lean === 1);
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
      g.fillStyle(darken(PALETTE.fireRed, 0.25), 1);
      g.fillEllipse(ox, oy + 2.5 * s, 56 * s, 26 * s);
      g.lineStyle(2.5 * s, PALETTE.outline, 1);
      g.strokeEllipse(ox, oy + 2.5 * s, 56 * s, 26 * s);
      g.fillStyle(PALETTE.fireRed, 1);
      g.fillEllipse(ox, oy, 56 * s, 26 * s);
      g.strokeEllipse(ox, oy, 56 * s, 26 * s);
      g.fillStyle(lighten(PALETTE.fireRed, 0.25), 1);
      g.fillEllipse(ox, oy - 1 * s, 40 * s, 16 * s);
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
      g.lineStyle(1.4 * s, 0x3f8fc4, 1);
      g.strokeCircle(ox, oy, 5 * s);
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(ox - 1.6 * s, oy - 1.6 * s, 1.5 * s);
    }),
  ]);

  // Things to pick up (loot and lost things), bobbing on the ground.
  for (const item of [
    'sock',
    'rubberDuck',
    'balloon',
    'cake',
    'wrench',
    'pizza',
    'teddy',
    'flower',
    'iceCream',
    'letter',
    'fish',
    'book',
    'present',
    'apple',
    'shell',
    'kitten',
    'feather',
  ] as IconName[]) {
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
  for (const b of [
    'teddy',
    'flower',
    'iceCream',
    'letter',
    'fish',
    'book',
    'present',
    'apple',
    'shell',
    'feather',
  ] as IconName[])
    bakeBubble(scene, b);
  const pads: IconName[] = [
    'home',
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
