import { expect, test, type Page } from '@playwright/test';

/**
 * Spec 002 (vertical slice) flows. Headless Chromium renders slowly and Phaser runs in slow motion
 * rather than skipping frames, so these wait on game state (not wall-clock time) with long timeouts.
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

async function tap(page: Page, isMobile: boolean, p: { x: number; y: number }): Promise<void> {
  if (isMobile) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

/** A fresh save, the city running. */
async function boot(page: Page, play = true): Promise<void> {
  await page.goto(play ? './?play' : './');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForFunction(() =>
    window.__jbc?.scenes().includes(location.search ? 'Hud' : 'Title'),
  );
}

test.describe.configure({ timeout: 180_000 });

test('AC1: Title → driving the police car in 2 taps, no text', async ({ page, isMobile }) => {
  const errors = watchErrors(page);
  await boot(page, false);
  let taps = 0;
  // Tap 1: the Play button.
  await tap(page, isMobile, await page.evaluate(() => window.__jbc!.logicalToClient(640, 250)));
  taps++;
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
  // Let the camera settle, then tap 2: the police car itself (walks over and hops in).
  await page.waitForTimeout(1500);
  const car = (await st(page)).car;
  await tap(
    page,
    isMobile,
    (await page.evaluate(([x, y]) => window.__jbc!.gridToClient(x!, y!, 12), [car.x, car.y]))!,
  );
  taps++;
  await expect.poll(async () => (await st(page)).mode, LONG).toBe('car');
  expect(taps).toBeLessThanOrEqual(3);
  expect(await page.evaluate(() => document.body.innerText.trim())).toBe('');
  expect(errors).toEqual([]);
});

test('AC3: siren plays and lights flash on every press; spamming is fine', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await page.evaluate(() => window.__jbc!.enterCar());
  for (let i = 0; i < 8; i++) await page.keyboard.press('KeyQ');
  await expect.poll(async () => (await st(page)).sirenPresses, LONG).toBe(8);
  expect((await st(page)).car.flashing).toBe(true);
  expect((await page.evaluate(() => window.__jbc!.sfxPlayed())).siren).toBe(8);
  // The on-screen siren button does the same (bottom-right, above Action).
  await page.mouse.click(
    ...(Object.values(await page.evaluate(() => window.__jbc!.logicalToClient(1170, 450))) as [
      number,
      number,
    ]),
  );
  await expect.poll(async () => (await st(page)).sirenPresses, LONG).toBe(9);
  expect(errors).toEqual([]);
});

test('AC2/AC4/AC5: chase on the roads, donuts drop, 3 bumps catch Pickles, mission pays 20', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await boot(page);
  // Spec 003: Donut Dash comes after First Day; start it the way the chief would.
  await page.evaluate(() => {
    window.__jbc!.grant({ done: ['first-day'] });
    window.__jbc!.startMission('donut-dash');
    window.__jbc!.enterCar();
  });
  await expect.poll(async () => (await st(page)).chase.phase, LONG).toBe('fleeing');
  // Donuts drop while he flees; the errand opens.
  await expect.poll(async () => (await st(page)).chase.dropped, LONG).toBeGreaterThanOrEqual(1);
  expect((await st(page)).errand).toBe('offered');
  // Bumping (but not catching yet) pays nothing.
  expect((await st(page)).coins).toBe(0);
  // Pull up behind him until three bumps land.
  await page.waitForFunction(
    () => {
      const s = window.__jbc!.player()!;
      if (s.chase.phase === 'fleeing') window.__jbc!.chaseUp();
      return s.chase.phase !== 'fleeing';
    },
    null,
    { ...LONG, polling: 400 },
  );
  expect((await st(page)).chase.bumps).toBe(3);
  await expect.poll(async () => (await st(page)).mission, LONG).toBeNull();
  const s = await st(page);
  expect(s.coins).toBe(20);
  expect(s.stars['donut-dash']).toBeGreaterThanOrEqual(1);
  await expect
    .poll(() => page.evaluate(() => window.__jbc!.voiceLog()), LONG)
    .toEqual(expect.arrayContaining(['chase-start', 'caught', 'mission-done']));
  expect(errors).toEqual([]);
});

test('AC6/AC7/AC8/AC10: coins only from minigame + errand, and they survive a reload', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await boot(page);

  // Knock over a cone: tumbles, pays nothing, pops back within 5 s of game time.
  const t0 = await page.evaluate(() => {
    const c = window.__jbc!.game.scene.getScene('City') as unknown as {
      bumpables: { bump(p: { x: number; y: number }): boolean; home: { x: number; y: number } }[];
    };
    const b = c.bumpables[0]!;
    b.bump({ x: b.home.x - 0.5, y: b.home.y });
    return window.__jbc!.game.loop.frame;
  });
  await expect.poll(async () => (await st(page)).bumpables[0]!.tumbling, LONG).toBe(false);
  // Game time = frames × 1/60 s (headless Chromium runs the game in slow motion).
  const t1 = await page.evaluate(() => window.__jbc!.game.loop.frame);
  expect(((t1 - t0) * 1000) / 60).toBeLessThan(5000);
  expect((await st(page)).coins).toBe(0);

  // Traffic Helper: walk onto the pad, it runs as its own scene, pays by tier, returns to the city.
  await page.evaluate(() => window.__jbc!.goTo(11, 6));
  await page.waitForFunction(() => window.__jbc!.scenes().includes('TrafficHelper'), null, LONG);
  expect(await page.evaluate(() => window.__jbc!.scenes())).not.toContain('Hud');
  await page.evaluate(() => window.__jbc!.finishMinigame(17));
  await page.keyboard.press('Space'); // the big check button also works
  await page.waitForFunction(
    () =>
      !window.__jbc!.scenes().includes('TrafficHelper') && window.__jbc!.scenes().includes('Hud'),
    null,
    LONG,
  );
  expect((await st(page)).coins).toBe(30);

  // Errand: bring donuts back to the donut shop.
  await page.evaluate(() => {
    const c = window.__jbc!.game.scene.getScene('City') as unknown as {
      state: { errands: { offer(id: string): void }; pickUp(i: string): void };
    };
    c.state.errands.offer('return-donuts');
    c.state.pickUp('donut');
  });
  await page.evaluate(() => window.__jbc!.goTo(13, 7));
  await expect.poll(async () => (await st(page)).errand, LONG).toBe('done');
  expect((await st(page)).coins).toBe(40);

  // Reload: coins, errand and minigame plays are still there.
  await page.reload();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
  expect((await st(page)).coins).toBe(40);
  const saved = (await page.evaluate(() => window.__jbc!.saved())) as {
    coins: number;
    errandsDone: string[];
    minigamePlays: Record<string, number>;
  };
  expect(saved.coins).toBe(40);
  expect(saved.errandsDone).toEqual(['return-donuts']);
  expect(saved.minigamePlays['traffic-helper']).toBe(1);
  expect(errors).toEqual([]);
});

test('AC9: idle 20 s → arrow + voice hint to the current goal', async ({ page }) => {
  await boot(page);
  // Spec 003: before any mission the hint points at the chief.
  await page.evaluate(() => window.__jbc!.idle(21));
  await expect.poll(async () => (await st(page)).hintShowing, LONG).toBe(true);
  expect(await page.evaluate(() => window.__jbc!.voiceLog())).toContain('hint-chief');
  await page.keyboard.press('ArrowLeft');
  // During a mission's "get in the car" goal it points at the car.
  await page.evaluate(() => {
    window.__jbc!.grant({ done: ['first-day'] });
    window.__jbc!.startMission('donut-dash');
    window.__jbc!.idle(21);
  });
  await expect
    .poll(() => page.evaluate(() => window.__jbc!.voiceLog()), LONG)
    .toContain('hint-car');
  // Any input clears it.
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await st(page)).hintShowing, LONG).toBe(false);
});
