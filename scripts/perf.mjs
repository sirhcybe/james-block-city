// Perf check: Pixel 7 emulation (landscape) + CPU throttle (RATE, default 4) for 12 s.
// SCENARIO=walk (spec 001: walking around the plaza), SCENARIO=chase (spec 002, default: in the
// police car chasing Pickles, donuts dropping, pedestrians hopping, siren on), or SCENARIO=double
// (spec 003 AC20: Double Trouble, two getaway cars, socks dropping, 3 town cars, siren on), or
// SCENARIO=fire (spec 004 AC14: fire truck among the Skyscraper Heights towers, 4 fires, hose on),
// or SCENARIO=build (spec 005 AC12: the mixer building the boat shop in the Harbor, horn on).
// Uses the installed Chrome with the real GPU and vsync off, so fps = uncapped throughput.
// Usage: npm run dev, then `node scripts/perf.mjs` (URL=..., RATE=..., SCENARIO=... to override).
import { chromium, devices } from 'playwright';

const RATE = Number(process.env.RATE ?? 4);
const SCENARIO = process.env.SCENARIO ?? 'chase';
const b = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=d3d11',
    '--disable-gpu-vsync',
    '--disable-frame-rate-limit',
  ],
});
const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 915, height: 412 } });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await p.goto(process.env.URL ?? 'http://localhost:5173/?play');
await p.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
console.log(
  await p
    .evaluate(() => {
      const gl = window.__jbc.game.renderer.gl;
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: gl.getParameter(d.UNMASKED_RENDERER_WEBGL),
        rs: window.__jbc.renderScale(),
        dpr: devicePixelRatio,
      };
    })
    .catch(() => null),
);
if (SCENARIO === 'chase' || SCENARIO === 'double') {
  const id = SCENARIO === 'double' ? 'double-trouble' : 'donut-dash';
  await p.evaluate((mission) => {
    window.__jbc.grant({
      done: ['first-day', 'donut-dash', 'duck-crossing'],
      badges: ['cop'],
      owned: ['police-bike'],
    });
    window.__jbc.startMission(mission);
    window.__jbc.enterCar();
  }, id);
  await p.waitForFunction(
    () => window.__jbc.player().robbers.some((r) => r.phase === 'fleeing'),
    null,
    {
      timeout: 30000,
    },
  );
} else if (SCENARIO === 'fire') {
  await p.evaluate(() => {
    const j = window.__jbc;
    j.grant({
      done: ['siren-school', 'kitty-floor-10', 'toaster-trouble'],
      badges: ['cop', 'fire'],
      owned: ['long-ladder'],
    });
    j.game.scene.getScene('City').state.switchJob('fire');
    j.startMission('fireworks-fiasco');
    j.ride('fire-truck');
    j.driveTo('fireworks-at');
  });
} else if (SCENARIO === 'build') {
  await p.evaluate(() => {
    const j = window.__jbc;
    j.grant({
      done: ['hard-hat-day', 'dock-it', 'mixer-mayhem'],
      badges: ['cop', 'builder'],
      owned: ['giant-drum'],
    });
    j.game.scene.getScene('City').state.switchJob('builder');
    j.startMission('boat-shop');
    j.ride('mixer-truck');
    j.driveTo('boat-shop-at');
  });
} else {
  await p.evaluate(() => window.__jbc.teleport(24.5, 9.5));
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
const result = await p.evaluate(async (scenario) => {
  const j = window.__jbc;
  const dirs = [
    [1, 0],
    [0, -1],
    [1, -1],
    [0, 1],
    [-1, 0],
    [1, 1],
  ];
  const frames = [];
  let last = performance.now();
  let run = true;
  const tick = (t) => {
    frames.push(t - last);
    last = t;
    if (run) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  for (let i = 0; i < 12; i++) {
    const [x, y] = dirs[i % dirs.length];
    j.setMove(x, y);
    if (scenario !== 'walk') window.__jbc.game.scene.getScene('City').input2.pressSiren();
    if (scenario === 'fire') j.hose();
    if (scenario === 'build') j.blast();
    await new Promise((r) => setTimeout(r, 1000));
  }
  run = false;
  j.clearMove();
  frames.sort((a, b) => a - b);
  const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
  const s = j.player();
  return {
    frames: frames.length,
    avgFps: Math.round(1000 / avg),
    p95ms: frames[Math.floor(frames.length * 0.95)],
    chase: s?.chase ?? null,
  };
}, SCENARIO);
console.log({ rate: RATE, scenario: SCENARIO, ...result });
await b.close();
