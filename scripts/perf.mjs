// Perf check: Pixel 7 emulation + CPU throttle (RATE, default 4), walking for 12 s.
// Uses installed Chrome with the real GPU and vsync off, so fps = uncapped throughput.
// Usage: npm run dev, then `node scripts/perf.mjs` (URL=... RATE=... to override).
import { chromium, devices } from 'playwright';
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
await p.waitForFunction(() => window.__jbc?.scenes().includes('City'));
console.log(
  await p.evaluate(() => {
    const gl = window.__jbc.game.renderer.gl;
    const d = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: gl.getParameter(d.UNMASKED_RENDERER_WEBGL),
      rs: window.__jbc.renderScale(),
      dpr: devicePixelRatio,
    };
  }),
);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.RATE ?? 4) });
// Walk a loop that passes behind the towers (occlusion work every frame).
const result = await p.evaluate(async () => {
  const j = window.__jbc;
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
    [1, -1],
    [-1, 1],
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
    await new Promise((r) => setTimeout(r, 1000));
  }
  run = false;
  j.clearMove();
  frames.sort((a, b) => a - b);
  const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
  return {
    frames: frames.length,
    avgFps: 1000 / avg,
    p95ms: frames[Math.floor(frames.length * 0.95)],
    phaserFps: j.fps(),
  };
});
console.log(result);
await b.close();
