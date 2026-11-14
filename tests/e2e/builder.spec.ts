import { expect, test, type Page } from '@playwright/test';

/** Spec 005 (Builder): job switch + quick change (AC2, AC8), every mission (AC4), building (AC3),
 * the island (AC6), the three minigames (AC7) and built things surviving a reload. */

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

async function bootAsBuilder(page: Page, extra: Record<string, unknown> = {}): Promise<void> {
  await page.goto('./?play');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
  await page.evaluate((x) => {
    window.__jbc!.grant({ badges: ['cop'], ...(x as object) });
    window.__jbc!.openMenu('JobCenter');
  }, extra);
  await until(page, "window.__jbc.scenes().includes('JobCenter')");
  await page.evaluate(() => window.__jbc!.pickJob('builder'));
  await until(
    page,
    "window.__jbc.scenes().includes('City') && window.__jbc.player().job === 'builder'",
  );
  await page.waitForTimeout(400);
}

/** Drive the mixer next to a spot and blast until the goal moves on. */
async function build(page: Page, spot: string): Promise<void> {
  await page.evaluate(() => window.__jbc!.ride('mixer-truck'));
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('build');
  await page.evaluate((s) => window.__jbc!.driveTo(`${s}-at`), spot);
  await until(
    page,
    `(() => { window.__jbc.blast(); const p = window.__jbc.player(); return !!p && p.mission?.goal !== 'build'; })()`,
  );
}

const pro = {
  done: ['hard-hat-day', 'dock-it', 'mixer-mayhem'],
  badges: ['cop', 'builder'],
  owned: ['giant-drum'],
};

test.describe.configure({ timeout: 240_000 });

test('Hard Hat Day: hard hat, 3 cones, build the wall; it stays built after a reload', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await bootAsBuilder(page);
  expect((await st(page)).offer).toBe('hard-hat-day');
  await page.evaluate(() => window.__jbc!.walkTo('foreman'));
  await expect.poll(async () => (await st(page)).mission?.id, LONG).toBe('hard-hat-day');
  expect((await st(page)).owned).toContain('hardhat-builder');
  await page.evaluate(() => window.__jbc!.ride('mixer-truck'));
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('checkpoints');
  for (const f of ['bflag-1', 'bflag-2', 'bflag-3']) {
    await page.evaluate((m) => window.__jbc!.driveTo(m), f);
    await until(
      page,
      `(() => { const m = window.__jbc.player().mission; return m.goal !== 'checkpoints' || m.parts.includes('${f}'); })()`,
    );
  }
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('build');
  // The blaster shows only near the spot.
  expect((await st(page)).blastAim).toBeNull();
  await page.evaluate(() => window.__jbc!.driveTo('practice-wall-at'));
  await expect.poll(async () => (await st(page)).blastAim, LONG).toBe('practice-wall');
  await until(
    page,
    `(() => { window.__jbc.blast(); const p = window.__jbc.player(); return !!p && p.mission === null; })()`,
  );
  expect((await st(page)).owned).toContain('built:practice-wall');
  await page.reload();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
  expect((await st(page)).sites['practice-wall']!.built).toBe(true);
  expect(errors).toEqual([]);
});

test('Dock It and Mixer Mayhem: dock, cement to three places, Cement Pour, Builder badge', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await bootAsBuilder(page, { done: ['hard-hat-day'] });
  await page.evaluate(() => window.__jbc!.startMission('dock-it'));
  await build(page, 'dock');
  await expect.poll(async () => (await st(page)).mission, LONG).toBeNull();

  await page.evaluate(() => window.__jbc!.startMission('mixer-mayhem'));
  await page.evaluate(() => window.__jbc!.ride('mixer-truck'));
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('checkpoints');
  for (const f of ['pour-1', 'pour-2', 'pour-3']) {
    await page.evaluate((m) => window.__jbc!.driveTo(m), f);
    await page.waitForTimeout(400);
  }
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('minigame');
  await page.evaluate(() => window.__jbc!.walkTo('cement-pour'));
  await until(page, "window.__jbc.scenes().includes('CementPour')");
  await page.evaluate(() => window.__jbc!.finishMinigame(30));
  await page.keyboard.press('Space');
  await expect.poll(async () => (await st(page)).mission === null, LONG).toBe(true);
  await expect.poll(async () => (await st(page)).badges, LONG).toEqual(['cop', 'builder']);
  expect(errors).toEqual([]);
});

test('Lighthouse Lights and Boat Shop: build them, then visit the keeper and the boat owner', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await bootAsBuilder(page, pro);
  expect((await st(page)).offer).toBe('lighthouse-lights');
  await page.evaluate(() => window.__jbc!.startMission('lighthouse-lights'));
  await build(page, 'lighthouse');
  await page.evaluate(() => window.__jbc!.walkTo('keeper'));
  await expect.poll(async () => (await st(page)).mission, LONG).toBeNull();

  await page.evaluate(() => window.__jbc!.startMission('boat-shop'));
  await build(page, 'boat-shop');
  await page.evaluate(() => window.__jbc!.walkTo('boat-owner'));
  await expect.poll(async () => (await st(page)).mission, LONG).toBeNull();
  const s = await st(page);
  expect(s.stars['lighthouse-lights']).toBeGreaterThanOrEqual(1);
  expect(s.stars['boat-shop']).toBeGreaterThanOrEqual(1);
  expect(s.errands['deliver-pizza']).toBe('offered');
  expect(errors).toEqual([]);
});

test('Bridge to the Island: build the bridge, then walk across (AC6)', async ({ page }) => {
  const errors = watchErrors(page);
  await bootAsBuilder(page, pro);
  await page.evaluate(() => window.__jbc!.startMission('bridge-to-the-island'));
  await build(page, 'bridge');
  await page.evaluate(() => window.__jbc!.exitCar());
  expect(await page.evaluate(() => window.__jbc!.goTo(58, 32))).toBe(true);
  await expect.poll(async () => (await st(page)).mission, LONG).toBeNull();
  expect((await st(page)).gx).toBeGreaterThan(44);
  expect(errors).toEqual([]);
});

test('Quick change: only with all three badges; it opens the uniforms from anywhere (AC8)', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await bootAsBuilder(page, { badges: ['cop', 'fire'] });
  const btn = await page.evaluate(() => window.__jbc!.logicalToClient(1200, 70));
  await page.mouse.click(btn.x, btn.y);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__jbc!.scenes())).not.toContain('JobCenter');
  await page.evaluate(() => window.__jbc!.grant({ badges: ['builder'] }));
  await page.waitForTimeout(300);
  await page.mouse.click(btn.x, btn.y);
  await until(page, "window.__jbc.scenes().includes('JobCenter')");
  expect(await page.evaluate(() => window.__jbc!.pickJob('fire'))).toBe(true);
  await until(
    page,
    "window.__jbc.scenes().includes('City') && window.__jbc.player().job === 'fire'",
  );
  expect(errors).toEqual([]);
});

test('Block Stack, Copy the Build and Cement Pour run from their pads and pay by tier (AC7)', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await bootAsBuilder(page);
  for (const [pad, score, coins] of [
    ['block-stack', 16, 30],
    ['copy-the-build', 4, 15],
    ['cement-pour', 3, 5],
  ] as const) {
    const before = (await st(page)).coins;
    await page.evaluate((m) => window.__jbc!.walkTo(m), pad);
    await until(
      page,
      `['BlockStack','CopyBuild','CementPour'].some(s => window.__jbc.scenes().includes(s))`,
    );
    await page.evaluate((x) => window.__jbc!.finishMinigame(x), score);
    await page.keyboard.press('Space');
    await until(page, "window.__jbc.scenes().includes('Hud')");
    expect((await st(page)).coins).toBe(before + coins);
    await page.evaluate(() => window.__jbc!.teleport(46.5, 12.5));
    await page.waitForTimeout(300);
  }
  expect(errors).toEqual([]);
});
