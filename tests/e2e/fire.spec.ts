import { expect, test, type Page } from '@playwright/test';

/**
 * Spec 004 (Job Center + Firefighter): Job Center (AC1, AC2), one flow per Fire mission (AC6),
 * the badge (AC7), the kitchen (AC9) and both minigames (AC10). State-driven, like 002/003.
 */

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

/** A fresh save that is already a firefighter (Cop badge earned, job switched). */
async function bootAsFirefighter(page: Page, extra: Record<string, unknown> = {}): Promise<void> {
  await page.goto('./?play');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
  await page.evaluate((x) => {
    window.__jbc!.grant({ badges: ['cop'], ...(x as object) });
    window.__jbc!.openMenu('JobCenter');
  }, extra);
  await until(page, "window.__jbc.scenes().includes('JobCenter')");
  await page.evaluate(() => window.__jbc!.pickJob('fire'));
  await until(
    page,
    "window.__jbc.scenes().includes('City') && window.__jbc.player().job === 'fire'",
  );
  await page.waitForTimeout(400);
}

/** Keep pressing the hose until the current goal changes. */
const hoseUntil = (page: Page, cond: string) =>
  until(page, `(() => { window.__jbc.hose(); return ${cond}; })()`);

test.describe.configure({ timeout: 240_000 });

test('Job Center: locked before a badge; after it, the red uniform makes you a firefighter', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('./?play');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
  await page.evaluate(() => window.__jbc!.walkTo('job-center'));
  await until(page, "window.__jbc.scenes().includes('JobCenter')");
  expect(await page.evaluate(() => window.__jbc!.pickJob('fire'))).toBe(false);
  expect(await page.evaluate(() => window.__jbc!.voiceLog())).toContain('job-locked');
  await page.evaluate(() => window.__jbc!.closeMenu());
  await until(page, "window.__jbc.scenes().includes('City')");
  expect((await st(page)).job).toBe('cop');

  await page.evaluate(() => {
    window.__jbc!.grant({ badges: ['cop'] });
    window.__jbc!.openMenu('JobCenter');
  });
  await until(page, "window.__jbc.scenes().includes('JobCenter')");
  expect(await page.evaluate(() => window.__jbc!.pickJob('fire'))).toBe(true);
  await until(
    page,
    "window.__jbc.scenes().includes('City') && window.__jbc.player().job === 'fire'",
  );
  const s = await st(page);
  expect(s.offer).toBe('siren-school'); // the fire chief now offers missions
  const saved = (await page.evaluate(() => window.__jbc!.saved())) as { job: string };
  expect(saved.job).toBe('fire');
  await expect
    .poll(() => page.evaluate(() => window.__jbc!.voiceLog()), LONG)
    .toContain('job-fire');
  expect(await page.evaluate(() => document.body.innerText.trim())).toBe('');
  expect(errors).toEqual([]);
});

test('Siren School: helmet, 3 flags in the truck, siren, spray the practice fire', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await bootAsFirefighter(page);
  await page.evaluate(() => window.__jbc!.walkTo('fire-chief'));
  await expect.poll(async () => (await st(page)).mission?.id, LONG).toBe('siren-school');
  expect((await st(page)).owned).toContain('helmet-fire');
  await page.evaluate(() => window.__jbc!.ride('fire-truck'));
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('checkpoints');
  for (const f of ['fflag-1', 'fflag-2', 'fflag-3']) {
    await page.evaluate((m) => window.__jbc!.driveTo(m), f);
    await until(
      page,
      `(() => { const m = window.__jbc.player().mission; return m.goal !== 'checkpoints' || m.parts.includes('${f}'); })()`,
    );
  }
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('siren');
  await page.keyboard.press('KeyQ');
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('spray');
  expect((await st(page)).fires).toEqual(['practice-fire']);
  // On foot, next to the practice fire: the Action button becomes the hose.
  await page.evaluate(() => {
    window.__jbc!.exitCar();
    window.__jbc!.teleport(27.5, 28.2);
  });
  await expect.poll(async () => (await st(page)).hoseAim, LONG).toBe('practice-fire');
  await hoseUntil(page, 'window.__jbc.player().mission === null');
  expect((await st(page)).stars['siren-school']).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('Kitty on Floor 10: park by the tower, the ladder goes up, the kitten comes down', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await bootAsFirefighter(page, { done: ['siren-school'] });
  await page.evaluate(() => {
    window.__jbc!.startMission('kitty-floor-10');
    window.__jbc!.ride('fire-truck');
  });
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('rescue');
  await page.evaluate(() => window.__jbc!.driveTo('kitty-at'));
  await expect.poll(async () => (await st(page)).mission, LONG).toBeNull();
  expect(await page.evaluate(() => window.__jbc!.voiceLog())).toContain('ladder-up');
  expect(errors).toEqual([]);
});

test('Toaster Trouble: walk into the kitchen, put out 3 flames, come back out (AC9)', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await bootAsFirefighter(page, { done: ['siren-school', 'kitty-floor-10'] });
  await page.evaluate(() => window.__jbc!.startMission('toaster-trouble'));
  await page.evaluate(() => window.__jbc!.walkTo('toaster-door'));
  await until(page, "window.__jbc.scenes().includes('Interior')");
  expect(await page.evaluate(() => window.__jbc!.scenes())).not.toContain('Hud');
  expect(await page.evaluate(() => window.__jbc!.interiorDone())).toBe(true);
  await until(
    page,
    "window.__jbc.scenes().includes('City') && window.__jbc.scenes().includes('Hud')",
  );
  await expect.poll(async () => (await st(page)).mission, LONG).toBeNull();
  // Third Rookie mission: the Fire badge (AC7).
  await expect.poll(async () => (await st(page)).badges, LONG).toEqual(['cop', 'fire']);
  await expect.poll(() => page.evaluate(() => window.__jbc!.voiceLog()), LONG).toContain('badge');
  expect(errors).toEqual([]);
});

test('Barbecue Blaze and Fireworks Fiasco: spray every fire from the truck', async ({ page }) => {
  const errors = watchErrors(page);
  await bootAsFirefighter(page, {
    done: ['siren-school', 'kitty-floor-10', 'toaster-trouble'],
    badges: ['cop', 'fire'],
    owned: ['long-ladder'],
  });
  await page.evaluate(() => {
    window.__jbc!.startMission('barbecue-blaze');
    window.__jbc!.ride('fire-truck');
  });
  await expect.poll(async () => (await st(page)).fires.length, LONG).toBe(3);
  // Walk from fire to fire on foot (they are on the ground in the park strip).
  let left = 3;
  for (const at of [
    [27.5, 22.8],
    [31.5, 22.2],
    [34.5, 22.8],
  ]) {
    await page.evaluate(([x, y]) => {
      if (window.__jbc!.player()!.mode === 'car') window.__jbc!.exitCar();
      window.__jbc!.teleport(x!, y!);
    }, at);
    await page.waitForTimeout(300);
    left--;
    await hoseUntil(
      page,
      `(window.__jbc.player().mission === null || window.__jbc.player().fires.length <= ${left})`,
    );
  }
  await hoseUntil(page, 'window.__jbc.player().mission === null');
  expect((await st(page)).stars['barbecue-blaze']).toBeGreaterThanOrEqual(1);

  await page.evaluate(() => {
    window.__jbc!.startMission('fireworks-fiasco');
    window.__jbc!.ride('fire-truck');
  });
  await expect.poll(async () => (await st(page)).fires.length, LONG).toBe(4);
  // High window fires: drive up to each one in the truck and hose it.
  for (const f of ['fw-1', 'fw-2', 'fw-3', 'fw-4']) {
    await page.evaluate((id) => window.__jbc!.driveTo(id), f);
    await hoseUntil(page, `!window.__jbc.player().fires.includes('${f}')`);
  }
  await expect.poll(async () => (await st(page)).mission, LONG).toBeNull();
  expect((await st(page)).stars['fireworks-fiasco']).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('The Tallest Tower: too high without the long ladder; with it, fire out + parrot rescue', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await bootAsFirefighter(page, {
    done: ['siren-school', 'kitty-floor-10', 'toaster-trouble'],
    badges: ['cop', 'fire'],
  });
  expect((await st(page)).offer).toBeNull(); // Pro needs the ladder (AC8)
  await page.evaluate(() => {
    window.__jbc!.grant({ owned: ['long-ladder'] });
    window.__jbc!.startMission('tallest-tower');
    window.__jbc!.ride('fire-truck');
  });
  await page.evaluate(() => window.__jbc!.driveTo('tallest-at'));
  await hoseUntil(page, "window.__jbc.player().mission?.goal === 'rescue'");
  await expect.poll(async () => (await st(page)).mission, LONG).toBeNull();
  expect((await st(page)).stars['tallest-tower']).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('Window Splash and Ladder Rescue run from their pads and pay by tier (AC10)', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await bootAsFirefighter(page);
  for (const [pad, score, coins] of [
    ['window-splash', 46, 30],
    ['ladder-rescue', 6, 15],
  ] as const) {
    const before = (await st(page)).coins;
    await page.evaluate((m) => window.__jbc!.walkTo(m), pad);
    await until(
      page,
      `window.__jbc.scenes().some(s => s === 'WindowSplash' || s === 'LadderRescue')`,
    );
    await page.evaluate((x) => window.__jbc!.finishMinigame(x), score);
    await page.keyboard.press('Space');
    await until(page, "window.__jbc.scenes().includes('Hud')");
    expect((await st(page)).coins).toBe(before + coins);
    await page.evaluate(() => window.__jbc!.teleport(25.5, 32.5));
    await page.waitForTimeout(300);
  }
  expect(errors).toEqual([]);
});
