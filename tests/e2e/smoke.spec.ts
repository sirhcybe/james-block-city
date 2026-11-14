import { expect, test, type Page } from '@playwright/test';

type Hook = NonNullable<Window['__jbc']>;
type PlayerState = NonNullable<ReturnType<Hook['player']>>;

/** Collects console errors and uncaught exceptions for the whole test. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function player(page: Page): Promise<PlayerState> {
  const p = await page.evaluate(() => window.__jbc!.player());
  expect(p).not.toBeNull();
  return p!;
}

/** Boot, press the Play button like James would, and wait for the city. */
async function startGame(page: Page, isMobile: boolean): Promise<void> {
  await page.goto('./');
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Title'));
  // Let the title's pulse tween settle on a frame, then press the icon-only Play button.
  const pt = await page.evaluate(() => window.__jbc!.logicalToClient(640, 250));
  if (isMobile) await page.touchscreen.tap(pt.x, pt.y);
  else await page.mouse.click(pt.x, pt.y);
  await page.waitForFunction(() => window.__jbc?.scenes().includes('City'));
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
}

test('boots to the city with no console errors and no text needed', async ({ page, isMobile }) => {
  const errors = watchErrors(page);
  await startGame(page, isMobile);
  await expect(page.locator('canvas')).toBeVisible();
  // No DOM text is shown to the player (the canvas draws only pictures).
  const visibleText = await page.evaluate(() => document.body.innerText.trim());
  expect(visibleText).toBe('');
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('arrow up walks the player up the screen', async ({ page, isMobile }) => {
  const errors = watchErrors(page);
  await startGame(page, isMobile);
  // Open plaza paving, away from walls (so nothing slides the player sideways).
  await page.evaluate(() => window.__jbc!.teleport(34.5, 13.5));
  await page.waitForTimeout(100);
  const before = await player(page);
  // Hold the key until the player has clearly moved (a slow machine may draw few frames in a
  // fixed wait), then check the direction.
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await player(page)).screen.y).toBeLessThan(before.screen.y - 8);
  await page.keyboard.up('ArrowUp');
  const after = await player(page);
  expect(Math.abs(after.screen.x - before.screen.x)).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test('click / tap a tile walks there around buildings; manual input cancels', async ({
  page,
  isMobile,
}) => {
  const errors = watchErrors(page);
  await startGame(page, isMobile);
  // Plaza: start south of the fountain (tiles 30-31 × 9-10), go round to its west side.
  await page.evaluate(() => window.__jbc!.teleport(31.5, 11.5));
  await page.waitForTimeout(100);
  const target = await page.evaluate(() => window.__jbc!.tileToClient(29, 9));
  expect(target).not.toBeNull();
  if (isMobile) await page.touchscreen.tap(target!.x, target!.y);
  else await page.mouse.click(target!.x, target!.y);
  await expect.poll(async () => (await player(page)).following).toBe(true);
  await expect
    .poll(
      async () => {
        const p = await player(page);
        return [Math.floor(p.gx), Math.floor(p.gy)];
      },
      { timeout: 45_000 },
    )
    .toEqual([29, 9]);

  // A new go-to, then a key press: the path is cancelled immediately.
  await page.evaluate(() => window.__jbc!.goTo(37, 16));
  expect((await player(page)).following).toBe(true);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(100);
  await page.keyboard.up('ArrowLeft');
  expect((await player(page)).following).toBe(false);
  expect(errors).toEqual([]);
});

test('walking behind a tower fades it, walking out restores it', async ({ page, isMobile }) => {
  await startGame(page, isMobile);
  await page.evaluate(() => window.__jbc!.teleport(33.5, 5.5));
  await expect.poll(async () => (await player(page)).faded).toContain('tower-east');
  // The fade is a short tween: wait for it rather than reading the alpha on the same frame.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const city = window.__jbc!.game.scene.getScene('City');
        const img = city.children.getByName('tower-east') as unknown as { alpha: number };
        return img.alpha;
      }),
    )
    .toBeLessThan(0.5);
  await page.evaluate(() => window.__jbc!.teleport(36.5, 8.5));
  await expect.poll(async () => (await player(page)).faded).not.toContain('tower-east');
});

test('touch joystick appears under the thumb, moves the player, and hides on release', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'touch only');
  const errors = watchErrors(page);
  await startGame(page, isMobile);
  const cdp = await page.context().newCDPSession(page);
  const start = await page.evaluate(() => window.__jbc!.logicalToClient(200, 500));
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
    });

  const before = await player(page);
  await touch('touchStart', start.x, start.y);
  for (let i = 1; i <= 10; i++) await touch('touchMove', start.x + i * 6, start.y);
  const js = await page.evaluate(() => window.__jbc!.joystick());
  expect(js?.active).toBe(true);
  await page.waitForTimeout(900);
  await touch('touchEnd', 0, 0);
  const after = await player(page);
  expect(after.screen.x).toBeGreaterThan(before.screen.x + 8); // right on the screen
  expect((await page.evaluate(() => window.__jbc!.joystick()))?.active).toBe(false);
  expect(errors).toEqual([]);
});

test('portrait phone shows the rotate picture', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone only');
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('./');
  await expect(page.locator('#rotate')).toBeVisible();
  await page.setViewportSize({ width: 915, height: 412 });
  await expect(page.locator('#rotate')).toBeHidden();
});
