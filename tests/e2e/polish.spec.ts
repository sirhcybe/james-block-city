import { expect, test, type Page } from '@playwright/test';

/**
 * Polish round after the 2026-11-11 playtest: bugs found while playing, each pinned by a test.
 */

type Hook = NonNullable<Window['__jbc']>;
type State = NonNullable<ReturnType<Hook['player']>>;

async function st(page: Page): Promise<State> {
  const s = await page.evaluate(() => window.__jbc!.player());
  expect(s).not.toBeNull();
  return s!;
}

async function boot(page: Page): Promise<void> {
  await page.goto('./?play');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
}

const running = (page: Page, key: string) =>
  page.waitForFunction((k) => window.__jbc!.scenes().includes(k), key, { timeout: 20_000 });
const gone = (page: Page, key: string) =>
  page.waitForFunction((k) => !window.__jbc!.scenes().includes(k), key, { timeout: 20_000 });

test.describe.configure({ timeout: 120_000 });

test('walking onto a pad with a key held: no walking on your own after the minigame', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chrome', 'keyboard');
  await boot(page);
  // Two tiles up-left of the Traffic Helper pad (9.5, 5.5); down-right on screen walks onto it.
  await page.evaluate(() => window.__jbc!.teleport(7, 5));
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('ArrowDown');
  await running(page, 'TrafficHelper');
  // The keys come up while the city is paused (so it never hears them).
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowDown');
  await page.evaluate(() => window.__jbc!.finishMinigame(10));
  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await gone(page, 'TrafficHelper');
  await page.waitForTimeout(300);
  const a = await st(page);
  await page.waitForTimeout(1200);
  const b = await st(page);
  expect(Math.hypot(b.gx - a.gx, b.gy - a.gy)).toBeLessThan(0.05);
});

for (const mg of ['traffic-helper', 'window-splash', 'block-stack'] as const) {
  test(`closing ${mg} by tapping the check: no walking on your own`, async ({ page }, info) => {
    await boot(page);
    await page.evaluate((id) => window.__jbc!.startMinigame(id), mg);
    await page.waitForFunction(() => !window.__jbc!.scenes().includes('City'));
    // Play a little: taps/clicks all over the screen.
    for (const [x, y] of [
      [200, 300],
      [640, 360],
      [1000, 500],
      [300, 600],
    ]) {
      const c = await page.evaluate(([lx, ly]) => window.__jbc!.logicalToClient(lx!, ly!), [x, y]);
      if (info.project.name === 'pixel-7') await page.touchscreen.tap(c.x, c.y);
      else await page.mouse.click(c.x, c.y);
      await page.waitForTimeout(150);
    }
    await page.evaluate(() => window.__jbc!.finishMinigame(10));
    await page.waitForTimeout(900);
    const check = await page.evaluate(() => window.__jbc!.logicalToClient(640, 540));
    if (info.project.name === 'pixel-7') await page.touchscreen.tap(check.x, check.y);
    else await page.mouse.click(check.x, check.y);
    await page.waitForFunction(() => window.__jbc!.scenes().includes('City'), null, {
      timeout: 15_000,
    });
    await page.waitForTimeout(300);
    const a = await st(page);
    await page.waitForTimeout(1500);
    const b = await st(page);
    expect(Math.hypot(b.gx - a.gx, b.gy - a.gy)).toBeLessThan(0.05);
  });
}

test('mouse pressed on the world and let go over the Action button: steering stops', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chrome', 'mouse');
  await boot(page);
  const from = await page.evaluate(() => window.__jbc!.logicalToClient(640, 300));
  const action = await page.evaluate(() => window.__jbc!.logicalToClient(1280 - 110, 720 - 110));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.move(action.x, action.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  // The city still thinks the mouse button is down: it would steer the player toward the pointer.
  const held = await page.evaluate(
    () =>
      (window.__jbc!.game.scene.getScene('City') as unknown as { input2: { mouse: unknown } })
        .input2.mouse !== null,
  );
  expect(held).toBe(false);
});

test("another job's minigame pad doesn't start it (the cop can't play Window Splash)", async ({
  page,
}) => {
  await boot(page);
  expect((await st(page)).job).toBe('cop');
  await page.evaluate(() => window.__jbc!.walkTo('window-splash'));
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__jbc!.scenes())).toContain('City');
  expect(await page.evaluate(() => window.__jbc!.scenes())).not.toContain('WindowSplash');
  expect(await page.evaluate(() => window.__jbc!.voiceLog())).toContain('pad-other-job');
  // The cop's own pad still works.
  await page.evaluate(() => window.__jbc!.walkTo('who-took-it'));
  await running(page, 'WhoTookIt');
});

for (const mg of [
  ['traffic-helper', 'TrafficHelper'],
  ['ladder-rescue', 'LadderRescue'],
  ['block-stack', 'BlockStack'],
] as const) {
  test(`the back arrow leaves ${mg[0]} part-way, with no coins`, async ({ page }, info) => {
    await boot(page);
    const coins = (await st(page)).coins;
    await page.evaluate((id) => window.__jbc!.startMinigame(id), mg[0]);
    await running(page, mg[1]);
    await page.waitForTimeout(500);
    const back = await page.evaluate(() => window.__jbc!.logicalToClient(74, 720 - 74));
    if (info.project.name === 'pixel-7') await page.touchscreen.tap(back.x, back.y);
    else await page.mouse.click(back.x, back.y);
    await running(page, 'City');
    expect(await page.evaluate(() => window.__jbc!.scenes())).not.toContain(mg[1]);
    expect((await st(page)).coins).toBe(coins);
  });
}

test('Esc leaves a minigame too', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chrome', 'keyboard');
  await boot(page);
  await page.evaluate(() => window.__jbc!.startMinigame('window-splash'));
  await running(page, 'WindowSplash');
  await page.keyboard.press('Escape');
  await running(page, 'City');
});

test('Window Splash: a tap anywhere on a burning window splashes it', async ({ page }, info) => {
  await boot(page);
  await page.evaluate(() => window.__jbc!.startMinigame('window-splash'));
  await running(page, 'WindowSplash');
  const score = () =>
    page.evaluate<number>(`window.__jbc.game.scene.getScene('WindowSplash').model.score`);
  for (let k = 0; k < 3; k++) {
    const w = await page.waitForFunction(
      `(() => { const s = window.__jbc.game.scene.getScene('WindowSplash');
        const i = s.model.up.findIndex((u) => u > 0); return i >= 0 ? i : false; })()`,
      null,
      { timeout: 20_000 },
    );
    const i = (await w.jsonValue()) as number;
    // Near a corner of the window, away from the flame itself.
    const x = 640 - 190 + (i % 3) * 190 + 60;
    const y = 210 + Math.floor(i / 3) * 150 - 45;
    const before = await score();
    const c = await page.evaluate(([lx, ly]) => window.__jbc!.logicalToClient(lx!, ly!), [x, y]);
    if (info.project.name === 'pixel-7') await page.touchscreen.tap(c.x, c.y);
    else await page.mouse.click(c.x, c.y);
    await expect.poll(score).toBeGreaterThan(before);
  }
});

test('Ladder Rescue: one quick tap sends the ladder up', async ({ page }, info) => {
  await boot(page);
  await page.evaluate(() => window.__jbc!.startMinigame('ladder-rescue'));
  await running(page, 'LadderRescue');
  await page.waitForTimeout(500);
  const c = await page.evaluate(() => window.__jbc!.logicalToClient(640, 360));
  if (info.project.name === 'pixel-7') await page.touchscreen.tap(c.x, c.y);
  else await page.mouse.click(c.x, c.y);
  await page.waitForFunction(
    `window.__jbc.game.scene.getScene('LadderRescue').model.height > 2`,
    null,
    { timeout: 20_000 },
  );
});
