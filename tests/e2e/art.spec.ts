import { expect, test } from '@playwright/test';

/** Spec 009: art polish. Checks on the baked textures themselves. */
test.beforeEach(async ({ page }) => {
  await page.goto('./?play');
  await page.waitForFunction(() => window.__jbc?.scenes().includes('City'));
});

test('AC2 no character frame is cut off, whatever the hat', async ({ page }) => {
  const bad = await page.evaluate(() => {
    const game = window.__jbc!.game;
    const tm = game.textures;
    const keys = Object.keys(tm.list).filter((k) => /-(NE|NW|SE|SW)-[012]$/.test(k));
    const cut: string[] = [];
    for (const key of keys) {
      const src = tm.get(key).getSourceImage() as HTMLCanvasElement;
      const ctx = src.getContext('2d')!;
      const { width: w, height: h } = src;
      const edges = [
        ctx.getImageData(0, 0, w, 1).data, // top row
        ctx.getImageData(0, 0, 1, h).data, // left column
        ctx.getImageData(w - 1, 0, 1, h).data, // right column
      ];
      if (edges.some((d) => d.some((v, i) => i % 4 === 3 && v > 0))) cut.push(key);
    }
    return { n: keys.length, cut };
  });
  expect(bad.n).toBeGreaterThan(200);
  expect(bad.cut).toEqual([]);
});

test('AC2 the tallest hat (chef) fits on the player too', async ({ page }) => {
  const res = await page.evaluate(async () => {
    const j = window.__jbc!;
    j.grant({ coins: 500, owned: ['hat-chef'] });
    j.openMenu('Apartment');
    await new Promise((r) => setTimeout(r, 600));
    j.toggleHat('hat-chef');
    j.closeMenu();
    await new Promise((r) => setTimeout(r, 600));
    const tm = j.game.textures;
    const keys = Object.keys(tm.list).filter((k) => k.includes('+chef-'));
    let cut = 0;
    for (const key of keys) {
      const src = tm.get(key).getSourceImage() as HTMLCanvasElement;
      const d = src.getContext('2d')!.getImageData(0, 0, src.width, 1).data;
      if (d.some((v, i) => i % 4 === 3 && v > 0)) cut++;
    }
    return { n: keys.length, cut };
  });
  expect(res.n).toBeGreaterThan(0);
  expect(res.cut).toBe(0);
});

test('AC4 baked textures use rounded joins and caps', async ({ page }) => {
  const styles = await page.evaluate(() => {
    const tm = window.__jbc!.game.textures;
    return ['icon-star', 'prop-cone', 'player-SE-0', 'police-car-d0-0', 'hud-coin'].map((k) => {
      const ctx = (tm.get(k).getSourceImage() as HTMLCanvasElement).getContext('2d')!;
      return `${ctx.lineJoin}/${ctx.lineCap}`;
    });
  });
  expect(styles).toEqual(Array(5).fill('round/round'));
});

test('AC3 walking shows both step frames', async ({ page }) => {
  const seen = await page.evaluate(async () => {
    const j = window.__jbc!;
    const city = j.game.scene.getScene('City') as unknown as {
      playerImg: { texture: { key: string } };
    };
    const frames = new Set<string>();
    j.setMove(1, 0);
    const until = performance.now() + 4000;
    while (performance.now() < until) {
      frames.add(city.playerImg.texture.key.slice(-1));
      await new Promise((r) => requestAnimationFrame(r));
    }
    j.clearMove();
    return [...frames].sort();
  });
  // On a very slow machine a frame can be skipped between samples; both steps must still show.
  expect(seen).toEqual(expect.arrayContaining(['1', '2']));
});
