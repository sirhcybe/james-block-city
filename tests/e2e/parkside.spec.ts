import { expect, test, type Page } from '@playwright/test';

/** Spec 010: Parkside, the new neighborhood. Driving in (AC2) and its three errands (AC5). */

type Hook = NonNullable<Window['__jbc']>;
type State = NonNullable<ReturnType<Hook['player']>>;
const LONG = { timeout: 90_000 };

async function st(page: Page): Promise<State> {
  const s = await page.evaluate(() => window.__jbc!.player());
  expect(s).not.toBeNull();
  return s!;
}

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?play');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
  return errors;
}

test.describe.configure({ timeout: 180_000 });

test('AC2 a car drives from the old streets down into Parkside', async ({ page }) => {
  const errors = await boot(page);
  // On the old south road where the Heights' middle street crosses it, stick held toward Parkside.
  await page.evaluate(() => {
    const j = window.__jbc!;
    j.ride('police-car');
    j.driveTo('traffic-4');
    j.setMove(-0.7, 0.7);
  });
  await expect.poll(async () => (await st(page)).car.y, LONG).toBeGreaterThan(42);
  await page.evaluate(() => window.__jbc!.clearMove());
  expect((await st(page)).mode).toBe('car');
  expect(errors).toEqual([]);
});

test('AC5 the lost ball: pick it up in a garden, bring it to the kid at the school', async ({
  page,
}) => {
  const errors = await boot(page);
  expect((await st(page)).errands['find-ball']).toBe('offered');
  await page.evaluate(() => window.__jbc!.walkTo('ball-spot'));
  await expect.poll(async () => (await st(page)).inventory.ball ?? 0, LONG).toBe(1);
  const coins = (await st(page)).coins;
  await page.evaluate(() => window.__jbc!.walkTo('school-kid'));
  await expect.poll(async () => (await st(page)).errands['find-ball'], LONG).toBe('done');
  expect((await st(page)).coins).toBe(coins + 10);
  expect(await page.evaluate(() => window.__jbc!.voiceLog())).toContain('errand-done');
  expect(errors).toEqual([]);
});

test('AC5 the kite: grab it from the car on the coast road, take it to the kid in the park', async ({
  page,
}) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    window.__jbc!.ride('police-car');
    window.__jbc!.driveTo('kite-spot');
  });
  await expect.poll(async () => (await st(page)).inventory.kite ?? 0, LONG).toBe(1);
  await page.evaluate(() => window.__jbc!.driveTo('kite-kid'));
  await expect.poll(async () => (await st(page)).errands['find-kite'], LONG).toBe('done');
  expect(errors).toEqual([]);
});

test('AC5 the carrots: the gardener asks and hands them over, the pet shop gets them', async ({
  page,
}) => {
  const errors = await boot(page);
  // Straight up to the gardener: they say where the carrots go as they hand them over.
  await page.evaluate(() => window.__jbc!.walkTo('gardener'));
  await expect.poll(async () => (await st(page)).inventory.carrot ?? 0, LONG).toBe(1);
  expect(await page.evaluate(() => window.__jbc!.voiceLog())).toContain('errand-carrots');
  // And from a car: drive to the pet shop.
  await page.evaluate(() => {
    window.__jbc!.ride('police-car');
    window.__jbc!.driveTo('pet-shop');
  });
  await expect.poll(async () => (await st(page)).errands['deliver-carrots'], LONG).toBe('done');
  expect((await st(page)).inventory.carrot ?? 0).toBe(0);
  expect(errors).toEqual([]);
});
