// One-off map migration for spec 008 (playtest 2026-11-12: "make the map ~50% bigger so things
// have more room"). Run once from the repo root: `node scripts/stretch-map.mjs`.
//
// It widens every city block by inserting copies of its sidewalk rows and columns on the road
// side, so roads stay two tiles wide and every landmark keeps its neighbours. All coordinates
// (buildings, markers, props, walkers, perches) are shifted to match. Minigame pads and boards
// move out to the new outer ring, away from the people standing by the doors. It then sprinkles
// street furniture on the new tiles, and writes `sea.json`: the open sea east and south of the
// city, with islands and the markers the boat rescues use.
//
// The script refuses to run twice (it checks the district sizes).
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = 'src/content/';
const PIECES = [
  { file: 'downtown.json', ox: 0, oy: 0 },
  { file: 'plaza.json', ox: 16, oy: 0 },
  { file: 'heights.json', ox: 16, oy: 16 },
  { file: 'harbor.json', ox: 32, oy: 0 },
];

// Cuts in old world coordinates: insert `n` copies of row/column `src` at boundary `p`.
// `src === p` puts the copy before the row (a block's north/west sidewalk); `src === p - 1`
// puts it after (south/east sidewalk). Either way the copy lands on the road side.
const before = (p) => ({ p, src: p, n: 1 });
const after = (src) => ({ p: src + 1, src, n: 1 });
const X_CUTS = [
  before(3),
  after(6),
  before(9),
  after(12),
  after(15),
  before(19),
  after(22),
  before(25),
  after(28),
  after(31),
  before(35),
  after(39),
];
const Y_CUTS = [
  before(3),
  after(6),
  before(9),
  after(12),
  before(15),
  after(18),
  before(21),
  after(28),
];

// Things that sit on the kerb side and so move to the new outer ring.
const PADS = new Set([
  'traffic-helper',
  'who-took-it',
  'window-splash',
  'ladder-rescue',
  'block-stack',
  'copy-the-build',
  'cement-pour',
  'mission-board',
  'fire-board',
  'builder-board',
]);

const localCuts = (cuts, o, size) =>
  cuts
    .filter((c) => c.src >= o && c.src < o + size)
    .map((c) => ({ ...c, p: c.p - o, src: c.src - o }));

/** New coordinate of an old one. `pad` uses the kerb-side rule. */
function shift(v, cuts, pad = false) {
  let d = 0;
  for (const c of cuts) {
    const isBefore = c.src === c.p;
    const at = pad ? (isBefore ? c.p + 1 : c.p - 1) : c.p;
    if (v >= at) d += c.n;
  }
  return v + d;
}

function hash(x, y, k) {
  const n = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function stretch(m, xc, yc) {
  if (m.width !== 16) throw new Error(`${m.id} is already stretched`);
  // Tiles: rows first, then columns.
  let rows = [];
  const newRow = []; // per new row: was it inserted?
  m.tiles.forEach((row, y) => {
    for (const c of yc)
      if (c.src === c.p && c.p === y)
        for (let i = 0; i < c.n; i++) (rows.push(row), newRow.push(true));
    rows.push(row);
    newRow.push(false);
    for (const c of yc)
      if (c.src === c.p - 1 && c.src === y)
        for (let i = 0; i < c.n; i++) (rows.push(row), newRow.push(true));
  });
  const newCol = [];
  rows = rows.map((row, ri) => {
    let out = '';
    [...row].forEach((ch, x) => {
      for (const c of xc)
        if (c.src === c.p && c.p === x)
          for (let i = 0; i < c.n; i++) {
            out += ch;
            if (ri === 0) newCol.push(true);
          }
      out += ch;
      if (ri === 0) newCol.push(false);
      for (const c of xc)
        if (c.src === c.p - 1 && c.src === x)
          for (let i = 0; i < c.n; i++) {
            out += ch;
            if (ri === 0) newCol.push(true);
          }
    });
    return out;
  });
  const pt = (o, pad = false) => ({ ...o, gx: shift(o.gx, xc, pad), gy: shift(o.gy, yc, pad) });
  for (const b of m.buildings) {
    for (const c of xc) if (c.p > b.gx && c.p < b.gx + b.w) throw new Error(`cut through ${b.id}`);
    for (const c of yc) if (c.p > b.gy && c.p < b.gy + b.d) throw new Error(`cut through ${b.id}`);
  }
  const out = {
    ...m,
    width: rows[0].length,
    height: rows.length,
    tiles: rows,
    spawn: pt(m.spawn),
    markers: Object.fromEntries(
      Object.entries(m.markers ?? {}).map(([k, v]) => [k, pt(v, PADS.has(k))]),
    ),
    buildings: m.buildings.map((b) => pt(b)),
    props: (m.props ?? []).map((p) => pt(p, p.kind === 'board')),
    walkers: (m.walkers ?? []).map((w) => ({ ...w, from: pt(w.from), to: pt(w.to) })),
    perches: (m.perches ?? []).map((p) => pt(p)),
  };

  // Street furniture on the new tiles (never on a marker, a walker's line or a building).
  const legend = m.legend;
  const kind = (x, y) => legend[rows[y]?.[x]];
  const taken = (x, y) => {
    const cx = x + 0.5;
    const cy = y + 0.5;
    if (out.buildings.some((b) => x >= b.gx - 0 && x < b.gx + b.w && y >= b.gy && y < b.gy + b.d))
      return true;
    if (Object.values(out.markers).some((p) => Math.hypot(p.gx - cx, p.gy - cy) < 1.2)) return true;
    if (out.props.some((p) => Math.hypot(p.gx - cx, p.gy - cy) < 1.2)) return true;
    if (out.perches.some((p) => Math.hypot(p.gx - cx, p.gy - cy) < 1.2)) return true;
    if (Math.hypot(out.spawn.gx - cx, out.spawn.gy - cy) < 1.5) return true;
    return out.walkers.some((w) => {
      const ax = w.from.gx,
        ay = w.from.gy,
        bx = w.to.gx,
        by = w.to.gy;
      const L2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((cx - ax) * (bx - ax) + (cy - ay) * (by - ay)) / L2));
      return Math.hypot(ax + (bx - ax) * t - cx, ay + (by - ay) * t - cy) < 0.8;
    });
  };
  let n = 0;
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const k = kind(x, y);
      const fresh = newRow[y] || newCol[x];
      if (taken(x, y)) continue;
      const h = hash(x + m.id.length * 13, y, 3);
      if ((k === 'sidewalk' || k === 'plaza') && fresh) {
        const corner = newRow[y] && newCol[x];
        if (corner)
          out.props.push({ id: `${m.id}-lamp-${n++}`, kind: 'lamp', gx: x + 0.5, gy: y + 0.5 });
        else if (h < 0.16)
          out.props.push({ id: `${m.id}-bench-${n++}`, kind: 'bench', gx: x + 0.5, gy: y + 0.5 });
        else if (h < 0.34)
          out.props.push({
            id: `${m.id}-planter-${n++}`,
            kind: 'planter',
            gx: x + 0.5,
            gy: y + 0.5,
          });
      } else if (k === 'grass' && h < 0.12) {
        out.props.push({ id: `${m.id}-flowers-${n++}`, kind: 'flowers', gx: x + 0.5, gy: y + 0.5 });
      }
    }
  }
  return out;
}

const offsets = {};
for (const piece of PIECES) {
  const raw = JSON.parse(readFileSync(DIR + piece.file, 'utf8'));
  const xc = localCuts(X_CUTS, piece.ox, raw.width);
  const yc = localCuts(Y_CUTS, piece.oy, raw.height);
  const out = stretch(raw, xc, yc);
  writeFileSync(DIR + piece.file, JSON.stringify(out, null, 2) + '\n');
  offsets[raw.id] = {
    ox: piece.ox + X_CUTS.filter((c) => c.src < piece.ox).reduce((a, c) => a + c.n, 0),
    oy: piece.oy + Y_CUTS.filter((c) => c.src < piece.oy).reduce((a, c) => a + c.n, 0),
    w: out.width,
    h: out.height,
  };
}
console.log('district offsets', offsets);

// ---------------------------------------------------------------------------------------------
// The sea: a background piece under the districts (they are laid over it), with islands in the
// open water east (x >= 60) and south (y >= 40) of the city. Coordinates here are world tiles.
// ---------------------------------------------------------------------------------------------
const SEA_W = 72;
const SEA_H = 48;
const sea = [...Array(SEA_H)].map(() => Array(SEA_W).fill('w'));
const patch = (x0, y0, lines) =>
  lines.forEach((line, dy) =>
    [...line].forEach((ch, dx) => {
      if (ch !== '.') sea[y0 + dy][x0 + dx] = ch;
    }),
  );
// Castaway Rock (north-east), Picnic Island (east), Sandbar and Duck Rock (south).
patch(66, 10, ['.dd.', 'dddd', '.dd.']);
patch(63, 27, ['.ddd..', 'ddggd.', 'dgggdd', 'ddggd.', '.ddd..']);
patch(9, 43, ['.dddd.', 'dddddd', '.ddd..']);
patch(30, 43, ['dd.', 'ddd']);
const seaMap = {
  id: 'sea',
  width: SEA_W,
  height: SEA_H,
  legend: { g: 'grass', w: 'water', d: 'sand' },
  tiles: sea.map((r) => r.join('')),
  spawn: { gx: 0.5, gy: 0.5 },
  markers: {
    'rescue-boat': { gx: 56.5, gy: 8.7 },
    'dock-landing': { gx: 56.5, gy: 9.4 },
    lifeguard: { gx: 54.5, gy: 8.5 },
    castaway: { gx: 65.2, gy: 11.5 },
    'castaway-perch': { gx: 67.5, gy: 11.3 },
    'floaty-1': { gx: 61.5, gy: 15.5 },
    'floaty-2': { gx: 67.5, gy: 22.5 },
    'floaty-3': { gx: 62.5, gy: 36.5 },
    sailboat: { gx: 69.5, gy: 34.5 },
    barge: { gx: 63, gy: 19.5 },
  },
  buildings: [
    { id: 'barge', kind: 'barge', gx: 63, gy: 19, w: 2, d: 1, h: 0.5, color: 'coneOrange' },
    { id: 'rock-1', kind: 'rock', gx: 68, gy: 11, w: 1, d: 1, h: 0.8, color: 'sidewalk' },
    { id: 'palm-1', kind: 'palm', gx: 67, gy: 10, w: 1, d: 1, h: 2, color: 'leaf' },
    { id: 'palm-2', kind: 'palm', gx: 65, gy: 28, w: 1, d: 1, h: 2, color: 'leaf' },
    { id: 'palm-3', kind: 'palm', gx: 66, gy: 30, w: 1, d: 1, h: 2, color: 'leaf' },
    { id: 'palm-4', kind: 'palm', gx: 11, gy: 44, w: 1, d: 1, h: 2, color: 'leaf' },
    { id: 'rock-2', kind: 'rock', gx: 31, gy: 44, w: 1, d: 1, h: 0.8, color: 'sidewalk' },
    { id: 'rock-3', kind: 'rock', gx: 70, gy: 4, w: 1, d: 1, h: 0.8, color: 'sidewalk' },
    { id: 'rock-4', kind: 'rock', gx: 60, gy: 44, w: 1, d: 1, h: 0.8, color: 'sidewalk' },
  ],
  props: [
    { id: 'buoy-1', kind: 'buoy', gx: 59.5, gy: 11.5 },
    { id: 'buoy-2', kind: 'buoy', gx: 64.5, gy: 15.5 },
    { id: 'buoy-3', kind: 'buoy', gx: 69.5, gy: 18.5 },
    { id: 'buoy-4', kind: 'buoy', gx: 61.5, gy: 24.5 },
    { id: 'buoy-5', kind: 'buoy', gx: 68.5, gy: 38.5 },
    { id: 'buoy-6', kind: 'buoy', gx: 50.5, gy: 43.5 },
    { id: 'buoy-7', kind: 'buoy', gx: 38.5, gy: 45.5 },
    { id: 'buoy-8', kind: 'buoy', gx: 20.5, gy: 43.5 },
    { id: 'buoy-9', kind: 'buoy', gx: 62.5, gy: 3.5 },
  ],
  walkers: [],
  perches: [
    { id: 'barge-fire-1', gx: 63.5, gy: 19.6, z: 0.5 },
    { id: 'barge-fire-2', gx: 64.5, gy: 19.6, z: 0.5 },
  ],
};
writeFileSync(DIR + 'sea.json', JSON.stringify(seaMap, null, 2) + '\n');
console.log('sea', SEA_W, 'x', SEA_H);
