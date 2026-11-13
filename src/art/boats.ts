import type Phaser from 'phaser';
import { PALETTE } from '../config';
import { darken, lighten } from './color';
import {
  bakeParts,
  drawOrientedBlock,
  drawOrientedWindow,
  type BakedMeta,
  type Part,
} from './blocks';
import { orientedAxes, orientedFacePoint, project, type OrientedBox } from './isoShapes';
import { drawIcon } from './icons';

/**
 * Boats (spec 008). Same chunky look as the road vehicles: smooth oriented blocks, thick outline,
 * eight headings. No wheels; the second frame rides a little higher with a bigger wake, so a
 * moving boat bobs.
 */
export interface BoatLook {
  name: string;
  hull: number;
  band: number;
  cabin: number | null;
  /** A mast and sail instead of a cabin (the sailboat to tow). */
  sail?: number;
}

export const RESCUE_BOAT: BoatLook = {
  name: 'rescue-boat',
  hull: PALETTE.buildingWhite,
  band: PALETTE.fireRed,
  cabin: PALETTE.coneOrange,
};

export const SAILBOAT: BoatLook = {
  name: 'sailboat',
  hull: PALETTE.harborTeal,
  band: PALETTE.buildingWhite,
  cabin: null,
  sail: 0xfff3d6,
};

export const BOAT_DIRS = 8;
export const boatFrameKey = (name: string, dir8: number, frame: 0 | 1) =>
  `${name}-d${dir8}-${frame}`;

const FRAME_BOUNDS = [
  { x: -70, y: -110 },
  { x: 70, y: 44 },
];

function drawBoat(
  g: Phaser.GameObjects.Graphics,
  ox: number,
  oy: number,
  s: number,
  v: BoatLook,
  dir8: number,
  frame: 0 | 1,
): void {
  const angle = (dir8 * Math.PI) / 4;
  const { f } = orientedAxes(angle);
  const lift = frame === 1 ? 0.03 : 0;
  const at = (k: number) => ({ cx: f.x * k, cy: f.y * k });

  // Wake: foam behind and a ring round the hull.
  const foam = (k: number, w: number, h: number, a: number) => {
    const p = project(f.x * k, f.y * k, 0, s);
    g.fillStyle(0xffffff, a);
    g.fillEllipse(p.x + ox, p.y + oy, w * s, h * s);
  };
  foam(0, 96, 40, 0.28);
  foam(-0.75, frame === 1 ? 44 : 34, frame === 1 ? 20 : 16, 0.6);
  foam(-1.05, frame === 1 ? 26 : 20, frame === 1 ? 12 : 10, 0.45);

  // Hull pieces, drawn back to front (far ones first).
  const z0 = -0.06 + lift;
  const z1 = 0.24 + lift;
  const boxes: { box: OrientedBox; color: number; bevel: number; kind: string }[] = [
    {
      box: { ...at(-0.12), halfL: 0.52, halfW: 0.34, z0, z1, angle },
      color: v.hull,
      bevel: 3,
      kind: 'hull',
    },
    {
      box: { ...at(0.52), halfL: 0.14, halfW: 0.26, z0, z1, angle },
      color: v.hull,
      bevel: 3,
      kind: 'bow',
    },
    {
      box: { ...at(0.74), halfL: 0.09, halfW: 0.15, z0, z1: z1 - 0.02, angle },
      color: v.hull,
      bevel: 2,
      kind: 'tip',
    },
  ];
  if (v.cabin !== null)
    boxes.push({
      box: { ...at(-0.2), halfL: 0.26, halfW: 0.24, z0: z1, z1: z1 + 0.3, angle },
      color: v.cabin,
      bevel: 3,
      kind: 'cabin',
    });
  boxes.sort(
    (a, b) => a.box.cx + a.box.cy + a.box.z0 * 0.01 - (b.box.cx + b.box.cy + b.box.z0 * 0.01),
  );
  // The cabin sits on the hull, so it must come after it whatever the heading.
  boxes.sort((a, b) => Number(a.kind === 'cabin') - Number(b.kind === 'cabin'));
  for (const b of boxes) {
    const sides = drawOrientedBlock(g, b.box, { color: b.color, bevel: b.bevel }, ox, oy, s);
    for (const fc of sides) {
      if (!fc.visible) continue;
      if (b.kind === 'hull' && (fc.side === 'left' || fc.side === 'right'))
        drawOrientedWindow(g, fc, 0.02, 0.98, z0 + 0.14, z0 + 0.22, ox, oy, v.band, s, false);
      if (b.kind === 'cabin')
        drawOrientedWindow(g, fc, 0.14, 0.86, z1 + 0.1, z1 + 0.24, ox, oy, PALETTE.windowBlue, s);
    }
    if (b.kind === 'hull') {
      // A life ring on a side we can see.
      const side = sides.find((fc) => fc.visible && (fc.side === 'left' || fc.side === 'right'));
      if (side) {
        const c = orientedFacePoint(side, 0.82, z0 + 0.16, s);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(c.x + ox, c.y + oy, 5 * s);
        g.lineStyle(2.4 * s, PALETTE.fireRed, 1);
        g.strokeCircle(c.x + ox, c.y + oy, 4 * s);
        g.lineStyle(1.2 * s, PALETTE.outline, 1);
        g.strokeCircle(c.x + ox, c.y + oy, 5.6 * s);
      }
    }
  }
  if (v.cabin !== null) {
    // A little beacon on the cabin roof.
    drawOrientedBlock(
      g,
      { ...at(-0.2), halfL: 0.07, halfW: 0.07, z0: z1 + 0.3, z1: z1 + 0.4, angle },
      { color: PALETTE.coinGold, bevel: 1 },
      ox,
      oy,
      s,
    );
  }
  if (v.sail !== undefined) {
    // Mast and a triangular sail that always faces the camera (it reads best that way).
    const foot = project(f.x * 0.05, f.y * 0.05, z1, s);
    const top = project(f.x * 0.05, f.y * 0.05, z1 + 1.5, s);
    g.lineStyle(4 * s, PALETTE.outline, 1);
    g.lineBetween(foot.x + ox, foot.y + oy, top.x + ox, top.y + oy);
    g.lineStyle(2 * s, PALETTE.trunk, 1);
    g.lineBetween(foot.x + ox, foot.y + oy, top.x + ox, top.y + oy);
    const sail = [
      { x: top.x + ox + 2 * s, y: top.y + oy + 3 * s },
      { x: foot.x + ox + 30 * s, y: foot.y + oy - 8 * s },
      { x: foot.x + ox + 2 * s, y: foot.y + oy - 8 * s },
    ];
    g.fillStyle(v.sail, 1);
    g.fillPoints(sail, true);
    g.lineStyle(2 * s, PALETTE.outline, 1);
    g.strokePoints(sail, true);
    g.lineStyle(3 * s, PALETTE.fireRed, 1);
    g.lineBetween(
      sail[2]!.x + 2 * s,
      foot.y + oy - 24 * s,
      sail[2]!.x + 16 * s,
      foot.y + oy - 24 * s,
    );
  }
}

function parts(v: BoatLook, dir8: number, frame: 0 | 1): Part[] {
  return [
    { type: 'custom', bounds: FRAME_BOUNDS, draw: () => {} },
    { type: 'custom', bounds: [], draw: (g, ox, oy, s) => drawBoat(g, ox, oy, s, v, dir8, frame) },
  ];
}

export const SEA = {
  floaty: 'sea-floaty',
  floatyEmpty: 'sea-floaty-empty',
  castaway: 'sea-castaway',
  beam: 'fx-beam',
  waves: 'sea-waves',
} as const;

export function bakeBoat(scene: Phaser.Scene, v: BoatLook): BakedMeta[] {
  const metas: BakedMeta[] = [];
  for (let d = 0; d < BOAT_DIRS; d++)
    for (const frame of [0, 1] as const)
      metas.push(bakeParts(scene, boatFrameKey(v.name, d, frame), parts(v, d, frame)));
  return metas;
}

/** Everything else on the water: ducklings on floaties, the beam over a flag, the wave tile. */
export function bakeSeaArt(scene: Phaser.Scene): void {
  for (const v of [RESCUE_BOAT, SAILBOAT]) bakeBoat(scene, v);
  const ring = (g: Phaser.GameObjects.Graphics, ox: number, oy: number, s: number) => {
    g.fillStyle(0xffffff, 0.45);
    g.fillEllipse(ox, oy + 2 * s, 54 * s, 22 * s);
    g.fillStyle(PALETTE.donutPink, 1);
    g.fillEllipse(ox, oy - 4 * s, 40 * s, 20 * s);
    g.lineStyle(2.5 * s, PALETTE.outline, 1);
    g.strokeEllipse(ox, oy - 4 * s, 40 * s, 20 * s);
    g.fillStyle(lighten(PALETTE.water, 0.15), 1);
    g.fillEllipse(ox, oy - 5 * s, 18 * s, 8 * s);
    g.strokeEllipse(ox, oy - 5 * s, 18 * s, 8 * s);
    g.fillStyle(0xffffff, 1);
    for (const dx of [-15, 15]) g.fillEllipse(ox + dx * s, oy - 4 * s, 5 * s, 8 * s);
  };
  bakeParts(scene, SEA.floaty, [
    {
      type: 'custom',
      bounds: [
        { x: -30, y: -44 },
        { x: 30, y: 16 },
      ],
      draw: (g, ox, oy, s) => {
        ring(g, ox, oy, s);
        drawIcon(g, 'rubberDuck', ox + 1 * s, oy - 18 * s, 13 * s, s * 0.8);
      },
    },
  ]);
  bakeParts(scene, SEA.floatyEmpty, [
    {
      type: 'custom',
      bounds: [
        { x: -30, y: -44 },
        { x: 30, y: 16 },
      ],
      draw: (g, ox, oy, s) => ring(g, ox, oy, s),
    },
  ]);
  // A tall soft beam of light over a flag, so it shows from far away.
  bakeParts(scene, SEA.beam, [
    {
      type: 'custom',
      bounds: [
        { x: -14, y: -260 },
        { x: 14, y: 0 },
      ],
      draw: (g, ox, oy, s) => {
        const steps = 26;
        for (let i = 0; i < steps; i++) {
          const k = i / steps;
          g.fillStyle(0xfff3a0, 0.5 * (1 - k));
          const w = (20 - 10 * k) * s;
          g.fillRect(ox - w / 2, oy - (i + 1) * 10 * s, w, 10 * s + 1);
        }
      },
    },
  ]);
  // One seamless tile of wave marks for the moving sea (drawn straight, not through bakeParts,
  // because a TileSprite needs an exact repeating size).
  if (!scene.textures.exists(SEA.waves)) {
    const size = 256;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const mark = (x: number, y: number, w: number, color: number, a: number) => {
      g.lineStyle(3, color, a);
      for (const [ddx, ddy] of [
        [0, 0],
        [-size, 0],
        [size, 0],
        [0, -size],
        [0, size],
      ] as const) {
        g.beginPath();
        g.moveTo(x + ddx - w, y + ddy);
        g.lineTo(x + ddx - w / 2, y + ddy - 4);
        g.lineTo(x + ddx, y + ddy);
        g.lineTo(x + ddx + w / 2, y + ddy - 4);
        g.lineTo(x + ddx + w, y + ddy);
        g.strokePath();
      }
    };
    const light = lighten(PALETTE.water, 0.45);
    const dark = darken(PALETTE.water, 0.12);
    const spots: [number, number, number][] = [
      [40, 36, 14],
      [150, 70, 18],
      [226, 150, 12],
      [90, 140, 16],
      [30, 214, 12],
      [176, 226, 16],
    ];
    for (const [x, y, w] of spots) mark(x, y, w, light, 0.7);
    for (const [x, y, w] of spots) mark((x + 110) % size, (y + 60) % size, w * 0.8, dark, 0.35);
    g.generateTexture(SEA.waves, size, size);
    g.destroy();
  }
}
