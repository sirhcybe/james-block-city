import { expect, test, type Page } from '@playwright/test';

/** Spec 006 (Home & Shop): apartment (AC1, AC2), hats (AC4), own car + paint (AC5), Shop (AC3). */

type Hook = NonNullable<Window['__jbc']>;
type State = NonNullable<ReturnType<Hook['player']>>;
const LONG = { timeout: 90_000 };

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function st(page: Page): Promise<State> {
  const s = await page.evaluate(() => window.__jbc!.player());
  expect(s).not.toBeNull();
  return s!;
}

const until = (page: Page, fn: string, timeout = 90_000) =>
  page.waitForFunction(fn, null, { timeout, polling: 300 });

async function boot(page: Page): Promise<void> {
  await page.goto('./?play');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
}

async function shop(page: Page, taps: string[]): Promise<void> {
  await page.evaluate(() => window.__jbc!.openMenu('Shop'));
  await until(page, "window.__jbc.scenes().includes('Shop')");
  for (const id of taps) {
    await page.evaluate((x) => window.__jbc!.shopTap(x), id);
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => window.__jbc!.closeMenu());
  await until(page, "window.__jbc.scenes().includes('City')");
}

test.describe.configure({ timeout: 240_000 });

test('Apartment: walk in, drag the bed from the tray onto the floor; it is still there after a reload', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await boot(page);
  await page.evaluate(() => window.__jbc!.grant({ coins: 60 }));
  await shop(page, ['home-bed', 'home-lamp']);
  expect((await st(page)).coins).toBe(15);
  expect((await st(page)).owned).toEqual(expect.arrayContaining(['home-bed', 'home-lamp']));

  await page.evaluate(() => window.__jbc!.walkTo('home-door'));
  await until(page, "window.__jbc.scenes().includes('Apartment')");
  // Drag the first tray item (the lamp: tray order follows the Shop) to the top-left square.
  const from = await page.evaluate(() => window.__jbc!.logicalToClient(290, 650));
  const to = await page.evaluate(() => window.__jbc!.logicalToClient(325, 296));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++)
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        ((await page.evaluate(() => window.__jbc!.saved())) as { apartment: unknown[] }).apartment,
      LONG,
    )
    .toEqual([{ item: 'home-lamp', gx: 0, gy: 0 }]);
  expect(await page.evaluate(() => window.__jbc!.placeItem('home-bed', 0, 0))).toBe(false); // taken
  expect(await page.evaluate(() => window.__jbc!.placeItem('home-bed', 3, 2))).toBe(true);
  // Leave with Esc; reload; the room is the same.
  await page.keyboard.press('Escape');
  await until(page, "window.__jbc.scenes().includes('City')");
  await page.reload();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
  const saved = (await page.evaluate(() => window.__jbc!.saved())) as { apartment: unknown[] };
  expect(saved.apartment).toEqual([
    { item: 'home-lamp', gx: 0, gy: 0 },
    { item: 'home-bed', gx: 3, gy: 2 },
  ]);
  expect(errors).toEqual([]);
});

test('Hats: buy the pirate hat, it goes on, it stays on in another job and after a reload', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await boot(page);
  await page.evaluate(() => window.__jbc!.grant({ coins: 45, badges: ['cop'] }));
  await shop(page, ['hat-pirate']);
  expect((await st(page)).coins).toBe(0);
  const look = () =>
    page.evaluate(() => {
      const c = window.__jbc!.game.scene.getScene('City') as unknown as {
        children: { list: { texture?: { key: string } }[] };
      };
      return c.children.list.some((o) => o.texture?.key.includes('+pirate'));
    });
  await expect.poll(look, LONG).toBe(true);
  await page.evaluate(() => window.__jbc!.openMenu('JobCenter'));
  await until(page, "window.__jbc.scenes().includes('JobCenter')");
  await page.evaluate(() => window.__jbc!.pickJob('fire'));
  await until(
    page,
    "window.__jbc.scenes().includes('City') && window.__jbc.player().job === 'fire'",
  );
  await expect.poll(look, LONG).toBe(true);
  await page.reload();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
  expect(((await page.evaluate(() => window.__jbc!.saved())) as { hat: string }).hat).toBe(
    'hat-pirate',
  );
  expect(errors).toEqual([]);
});

test('Own car: after a badge, buy it, paint it, and drive it as a firefighter', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await boot(page);
  await page.evaluate(() => window.__jbc!.grant({ coins: 75 }));
  // No badge: the car isn't on the shelf yet.
  await page.evaluate(() => window.__jbc!.openMenu('Shop'));
  await until(page, "window.__jbc.scenes().includes('Shop')");
  await page.evaluate(() => window.__jbc!.shopTap('own-car'));
  await page.evaluate(() => window.__jbc!.closeMenu());
  await until(page, "window.__jbc.scenes().includes('City')");
  expect((await st(page)).owned).not.toContain('own-car');

  await page.evaluate(() => window.__jbc!.grant({ badges: ['cop', 'fire'] }));
  await shop(page, ['own-car']);
  await shop(page, ['paint-pink']);
  const s = await st(page);
  expect(s.owned).toEqual(expect.arrayContaining(['own-car', 'paint-pink']));
  expect(s.coins).toBe(0);
  await page.evaluate(() => {
    const c = window.__jbc!.game.scene.getScene('City') as unknown as {
      state: { switchJob(j: string): boolean };
    };
    c.state.switchJob('fire');
  });
  // The car appears a moment after the Shop closes: keep trying to hop in until it's there.
  await until(
    page,
    `(() => { window.__jbc.ride('own-car'); return window.__jbc.player().riding === 'own-car'; })()`,
  );
  const key = await page.evaluate(() => {
    const c = window.__jbc!.game.scene.getScene('City') as unknown as {
      ownCar: { img: { texture: { key: string } } };
    };
    return c.ownCar.img.texture.key;
  });
  expect(key).toContain('own-car-paint-pink');
  expect(errors).toEqual([]);
});

test('Errands: three people need help from the very start (AC6)', async ({ page }) => {
  await boot(page);
  const e = (await st(page)).errands;
  expect(Object.values(e).filter((x) => x === 'offered').length).toBeGreaterThanOrEqual(3);
  expect(Object.keys(e).length).toBeGreaterThanOrEqual(19);
  expect(await page.evaluate(() => document.body.innerText.trim())).toBe('');
});
