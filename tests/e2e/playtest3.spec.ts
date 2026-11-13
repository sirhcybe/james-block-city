import { expect, test, type Page } from '@playwright/test';

/**
 * Spec 008 (playtest round 3): the stuck firefighter mission (AC1), the minigame top bar, hearts
 * and Oops/retry (AC2, AC3), the objective arrow (AC5), the boat (AC6), the lifeguard's rescues
 * (AC7), Build It! by drag-and-drop (AC8) and the home screen (AC9). State-driven, like the rest.
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

/** A fresh save, in the city, wearing a job's uniform. */
async function bootAs(
  page: Page,
  job: 'cop' | 'fire' | 'builder',
  extra: Record<string, unknown> = {},
): Promise<void> {
  await page.goto('./?play');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
  await page.evaluate((x) => window.__jbc!.grant({ badges: ['cop'], ...(x as object) }), extra);
  if (job !== 'cop') {
    await page.evaluate(() => window.__jbc!.openMenu('JobCenter'));
    await until(page, "window.__jbc.scenes().includes('JobCenter')");
    await page.evaluate((j) => window.__jbc!.pickJob(j), job);
    await until(
      page,
      `window.__jbc.scenes().includes('City') && window.__jbc.player().job === '${job}'`,
    );
  }
  await page.waitForTimeout(400);
}

test.describe.configure({ timeout: 240_000 });

test('AC1 firefighter upgrade: the chief asks for the ladder, the arrow goes to the Shop, buying it unlocks Barbecue Blaze', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await bootAs(page, 'fire', {
    badges: ['cop', 'fire'],
    done: ['siren-school', 'kitty-floor-10', 'toaster-trouble'],
    coins: 100,
  });
  expect((await st(page)).offer).toBeNull();
  // Walk up to the fire chief: he names the ladder, never the police bike.
  await page.evaluate(() => window.__jbc!.walkTo('fire-chief'));
  await expect
    .poll(async () => page.evaluate(() => window.__jbc!.voiceLog()), LONG)
    .toContain('chief-need-ladder');
  expect(await page.evaluate(() => window.__jbc!.voiceLog())).not.toContain('chief-need-bike');
  // Standing about: the arrow shows, and it points at the Shop.
  await page.evaluate(() => window.__jbc!.idle(30));
  const hint = await page.evaluate(() => {
    const city = window.__jbc!.game.scene.getScene('City') as unknown as {
      hintTarget(): { at: { x: number; y: number }; line: string } | null;
      marker(id: string): { x: number; y: number };
    };
    return { hint: city.hintTarget(), shop: city.marker('shop') };
  });
  expect(hint.hint?.line).toBe('chief-need-ladder');
  expect(hint.hint?.at).toEqual(hint.shop);
  expect((await st(page)).hintShowing).toBe(true);
  // Buy it: told to go back, and the chief now offers the next mission.
  await page.evaluate(() => window.__jbc!.openMenu('Shop'));
  await until(page, "window.__jbc.scenes().includes('Shop')");
  expect(await page.evaluate(() => window.__jbc!.buy('long-ladder'))).toBe(true);
  await page.evaluate(() => window.__jbc!.closeMenu());
  await until(page, "window.__jbc.scenes().includes('Hud')");
  await expect.poll(async () => (await st(page)).offer, LONG).toBe('barbecue-blaze');
  await expect
    .poll(async () => page.evaluate(() => window.__jbc!.voiceLog()), LONG)
    .toContain('upgrade-bought');
  await page.evaluate(() => window.__jbc!.walkTo('fire-truck'));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__jbc!.walkTo('fire-chief'));
  await expect.poll(async () => (await st(page)).mission?.id, LONG).toBe('barbecue-blaze');
  expect(errors).toEqual([]);
});

test('AC2 minigame top bar: every minigame shows score, star meter and time; six have hearts', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await bootAs(page, 'cop');
  const hearts: Record<string, number> = {};
  for (const id of [
    'traffic-helper',
    'who-took-it',
    'window-splash',
    'ladder-rescue',
    'block-stack',
    'copy-the-build',
    'cement-pour',
  ]) {
    await page.evaluate((m) => window.__jbc!.startMinigame(m), id);
    await until(page, `window.__jbc.round()?.id === '${id}'`);
    const r = (await page.evaluate(() => window.__jbc!.round()))!;
    expect(r.bar, id).toBe(true);
    expect(r.level, id).toBe(1);
    hearts[id] = r.maxHearts;
    await page.keyboard.press('Escape');
    await until(page, "window.__jbc.scenes().includes('Hud')");
  }
  expect(hearts['copy-the-build']).toBe(0);
  expect(Object.values(hearts).filter((h) => h > 0)).toHaveLength(6);
  expect(errors).toEqual([]);
});

test('AC3 Ducks Crossing: green too soon costs a heart; no hearts = Oops, no coins; retry has more hearts', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await bootAs(page, 'cop');
  const coins = (await st(page)).coins;
  await page.evaluate(() => window.__jbc!.startMinigame('traffic-helper'));
  await until(page, "window.__jbc.round()?.id === 'traffic-helper'");
  expect((await page.evaluate(() => window.__jbc!.round()))!.hearts).toBe(3);
  // Hold the cars at red until someone is on the crossing, then let the cars go.
  await page.evaluate(() => window.__jbc!.toggleLight());
  await until(page, 'window.__jbc.traffic().crossing > 0');
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__jbc!.toggleLight());
  await until(page, 'window.__jbc.traffic().scares > 0 || window.__jbc.traffic().crossing === 0');
  const t = (await page.evaluate(() => window.__jbc!.traffic()))!;
  if (t.scares > 0) {
    await expect
      .poll(async () => (await page.evaluate(() => window.__jbc!.round()))!.hearts, LONG)
      .toBe(2);
  }
  // Lose the rest: the round stops with Oops, pays nothing, and the city is not back yet.
  const left = (await page.evaluate(() => window.__jbc!.round()))!.hearts;
  await page.evaluate((n) => {
    for (let i = 0; i < n; i++) window.__jbc!.oops();
  }, left);
  await until(page, 'window.__jbc.round().failed === true');
  expect(await page.evaluate(() => window.__jbc!.scenes())).not.toContain('City');
  expect(await page.evaluate(() => window.__jbc!.voiceLog())).toContain('minigame-oops');
  // Retry: same game, more hearts.
  await page.evaluate(() => window.__jbc!.retry());
  await until(page, 'window.__jbc.round()?.fails === 1 && window.__jbc.round().failed === false');
  expect((await page.evaluate(() => window.__jbc!.round()))!.hearts).toBe(5);
  // Finishing the round still pays, as always.
  await page.evaluate(() => window.__jbc!.finishMinigame(20));
  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await until(page, "window.__jbc.scenes().includes('Hud')");
  expect((await st(page)).coins).toBe(coins + 30);
  expect(errors).toEqual([]);
});

test('AC3 Oops then the back arrow: straight back to the city with no coins', async ({ page }) => {
  await bootAs(page, 'cop');
  const coins = (await st(page)).coins;
  await page.evaluate(() => window.__jbc!.startMinigame('who-took-it'));
  await until(page, "window.__jbc.round()?.id === 'who-took-it'");
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) window.__jbc!.oops();
  });
  await until(page, 'window.__jbc.round().failed === true');
  // The back button on the Oops screen (left of the retry button).
  const pt = await page.evaluate(() => window.__jbc!.logicalToClient(490, 440));
  await page.mouse.click(pt.x, pt.y);
  await until(page, "window.__jbc.scenes().includes('Hud')");
  expect((await st(page)).coins).toBe(coins);
});

test('AC5 objective arrow: driving nowhere for a while shows it; reaching the flag hides it', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await bootAs(page, 'cop');
  await page.evaluate(() => {
    window.__jbc!.startMission('first-day');
    window.__jbc!.ride('police-car');
  });
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('checkpoints');
  expect((await st(page)).guideShowing).toBe(false);
  // Six seconds with no progress toward a flag.
  await page.evaluate(() => window.__jbc!.idle(6));
  expect((await st(page)).guideShowing).toBe(true);
  // The HUD draws the arrow.
  const arrow = await page.evaluate(() => {
    const hud = window.__jbc!.game.scene.getScene('Hud') as unknown as {
      arrow: { visible: boolean };
    };
    return hud.arrow.visible;
  });
  expect(arrow).toBe(true);
  // Drive through the nearest flag: that objective is done, the arrow goes.
  await page.evaluate(() => window.__jbc!.driveTo('flag-1'));
  await expect.poll(async () => (await st(page)).guideShowing, LONG).toBe(false);
  expect(errors).toEqual([]);
});

test('AC6 boat: none before the dock; built dock moors it; sails on water; out only at the dock', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await bootAs(page, 'builder', { badges: ['cop', 'builder'], done: ['hard-hat-day'] });
  expect((await st(page)).boat).toBeNull();
  // Build the dock with Build It! (the test hook finishes it).
  await page.evaluate(() => {
    window.__jbc!.startMission('dock-it');
    window.__jbc!.ride('mixer-truck');
    window.__jbc!.driveTo('dock-at');
  });
  await expect.poll(async () => (await st(page)).blastAim, LONG).toBe('dock');
  await page.evaluate(() => window.__jbc!.blast());
  await until(page, "window.__jbc.scenes().includes('BuildIt')");
  await page.evaluate(() => window.__jbc!.blast());
  await until(page, "window.__jbc.player()?.owned.includes('built:dock')");
  await expect.poll(async () => (await st(page)).boat, LONG).not.toBeNull();
  // Hop in from the dock and sail with the keys.
  await page.evaluate(() => window.__jbc!.ride('rescue-boat'));
  expect((await st(page)).riding).toBe('rescue-boat');
  const before = (await st(page)).boat!;
  await page.keyboard.down('ArrowDown');
  await until(
    page,
    `Math.hypot(window.__jbc.player().boat.x - ${before.x}, window.__jbc.player().boat.y - ${before.y}) > 1.5`,
  );
  await page.keyboard.up('ArrowDown');
  // Far out at sea there is nowhere to stand: Action/exit keeps you aboard.
  await page.evaluate(() => window.__jbc!.driveTo('floaty-2'));
  await page.evaluate(() => window.__jbc!.exitCar());
  expect((await st(page)).mode).toBe('car');
  // Back at the dock you can get out, onto the dock.
  await page.evaluate(() => window.__jbc!.driveTo('dock-landing'));
  await page.evaluate(() => window.__jbc!.exitCar());
  const s = await st(page);
  expect(s.mode).toBe('foot');
  // It is still there after a reload.
  await page.reload();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
  expect((await st(page)).boat).not.toBeNull();
  expect(errors).toEqual([]);
});

for (const [job, ids] of [
  ['fire', ['barge-blaze', 'castaway-cat']],
  ['cop', ['duckling-patrol', 'sailboat-tow']],
] as const) {
  test(`AC7 rescues as ${job}: the lifeguard offers ${ids.join(' then ')}`, async ({ page }) => {
    const errors = watchErrors(page);
    await bootAs(page, job, { badges: ['cop', 'fire'], owned: ['built:dock'] });
    for (const id of ids) {
      await expect.poll(async () => (await st(page)).lifeguard, LONG).toBe(id);
      await page.evaluate(() => window.__jbc!.walkTo('lifeguard'));
      await expect.poll(async () => (await st(page)).mission?.id, LONG).toBe(id);
      await page.evaluate(() => window.__jbc!.ride('rescue-boat'));
      await expect.poll(async () => (await st(page)).mission?.goalIndex, LONG).toBe(1);
      if (id === 'barge-blaze') {
        await page.evaluate(() => window.__jbc!.driveTo('barge-fire-1'));
        await until(
          page,
          `(() => { window.__jbc.hose(); return window.__jbc.player().mission?.goalIndex === 2; })()`,
        );
      } else if (id === 'duckling-patrol') {
        for (const f of ['floaty-1', 'floaty-2', 'floaty-3']) {
          await page.evaluate((m) => window.__jbc!.driveTo(m), f);
          await page.waitForTimeout(500);
        }
      } else {
        await page.evaluate(
          (m) => window.__jbc!.driveTo(m),
          id === 'castaway-cat' ? 'castaway' : 'sailboat',
        );
      }
      await expect.poll(async () => (await st(page)).mission?.goalIndex, LONG).toBe(2);
      await page.evaluate(() => window.__jbc!.driveTo('dock-landing'));
      await until(page, `window.__jbc.player().stars['${id}'] >= 1`);
      // Step away so the lifeguard can offer the next one.
      await page.evaluate(() => window.__jbc!.walkTo('boat-owner'));
    }
    expect((await st(page)).coins).toBe(60);
    expect(errors).toEqual([]);
  });
}

test('AC7 a builder is sent to change uniform; rescues are not on the job board', async ({
  page,
}) => {
  await bootAs(page, 'builder', { badges: ['cop', 'builder'], owned: ['built:dock'] });
  expect((await st(page)).lifeguard).toBeNull();
  await page.evaluate(() => window.__jbc!.walkTo('lifeguard'));
  await expect
    .poll(async () => page.evaluate(() => window.__jbc!.voiceLog()), LONG)
    .toContain('lifeguard-other-job');
  expect((await st(page)).mission).toBeNull();
});

test('AC8 Build It!: drag a piece to its slot with the pointer, pick the wrong then the right tool', async ({
  page,
  isMobile,
}) => {
  const errors = watchErrors(page);
  await bootAs(page, 'builder', { badges: ['cop', 'builder'] });
  await page.evaluate(() => {
    window.__jbc!.startMission('hard-hat-day');
    window.__jbc!.ride('mixer-truck');
  });
  for (const f of ['bflag-1', 'bflag-2', 'bflag-3']) {
    await page.evaluate((m) => window.__jbc!.driveTo(m), f);
    await page.waitForTimeout(400);
  }
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('build');
  await page.evaluate(() => window.__jbc!.driveTo('practice-wall-at'));
  await expect.poll(async () => (await st(page)).blastAim, LONG).toBe('practice-wall');
  await page.evaluate(() => window.__jbc!.blast());
  await until(page, "window.__jbc.scenes().includes('BuildIt')");
  const b0 = (await page.evaluate(() => window.__jbc!.buildIt()))!;
  expect(b0).toMatchObject({ site: 'practice-wall', fixed: 0, total: 6, pending: -1 });

  // Drag the first piece from the tray onto its slot.
  const path = (await page.evaluate(() => window.__jbc!.buildDrag()))!;
  const from = await page.evaluate((p) => window.__jbc!.logicalToClient(p.x, p.y), path.from);
  const to = await page.evaluate((p) => window.__jbc!.logicalToClient(p.x, p.y), path.to);
  if (isMobile) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
      });
    await touch('touchStart', from.x, from.y);
    for (let i = 1; i <= 12; i++) {
      await touch(
        'touchMove',
        from.x + ((to.x - from.x) * i) / 12,
        from.y + ((to.y - from.y) * i) / 12,
      );
      await page.waitForTimeout(40);
    }
    await touch('touchEnd', 0, 0);
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
  }
  await until(page, 'window.__jbc.buildIt().pending >= 0');
  const need = (await page.evaluate(() => window.__jbc!.buildIt()))!.toolNeeded!;
  const wrong = (['hammer', 'trowel', 'wrench'] as const).find((t) => t !== need)!;
  await page.evaluate((t) => window.__jbc!.buildTool(t), wrong);
  expect((await page.evaluate(() => window.__jbc!.buildIt()))!.fixed).toBe(0);
  await page.evaluate((t) => window.__jbc!.buildTool(t), need as 'hammer' | 'trowel' | 'wrench');
  await until(page, 'window.__jbc.buildIt().fixed === 1 && !window.__jbc.buildIt().busy');

  // The rest with the keyboard-style helpers, piece by piece.
  for (let i = 1; i < 6; i++) {
    await page.evaluate(() => window.__jbc!.buildPlace());
    await until(page, 'window.__jbc.buildIt()?.pending >= 0');
    await page.evaluate(() => {
      const b = window.__jbc!.buildIt()!;
      window.__jbc!.buildTool(b.toolNeeded as 'hammer' | 'trowel' | 'wrench');
    });
    if (i < 5)
      await until(
        page,
        `window.__jbc.buildIt()?.fixed === ${i + 1} && !window.__jbc.buildIt().busy`,
      );
  }
  // Back in the city the wall is built and the mission is done.
  await until(page, "window.__jbc.player()?.owned.includes('built:practice-wall')");
  await expect.poll(async () => (await st(page)).mission, LONG).toBeNull();
  expect(errors).toEqual([]);
});

test('AC8 leaving Build It! part-way keeps the build spot waiting', async ({ page }) => {
  await bootAs(page, 'builder', { badges: ['cop', 'builder'], done: ['hard-hat-day'] });
  await page.evaluate(() => {
    window.__jbc!.startMission('dock-it');
    window.__jbc!.ride('mixer-truck');
    window.__jbc!.driveTo('dock-at');
  });
  await expect.poll(async () => (await st(page)).blastAim, LONG).toBe('dock');
  await page.evaluate(() => window.__jbc!.blast());
  await until(page, "window.__jbc.scenes().includes('BuildIt')");
  await page.evaluate(() => window.__jbc!.buildPlace());
  await page.keyboard.press('Escape');
  await until(page, "window.__jbc.scenes().includes('Hud')");
  const s = await st(page);
  expect(s.mission?.goal).toBe('build');
  expect(s.sites.dock!.built).toBe(false);
  expect(s.owned).not.toContain('built:dock');
  await expect.poll(async () => (await st(page)).blastAim, LONG).toBe('dock');
});

test('AC9 home screen: the new title boots clean, shows badges, and Play starts the game', async ({
  page,
  isMobile,
}) => {
  const errors = watchErrors(page);
  await page.goto('./?play');
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
  await page.evaluate(() => window.__jbc!.grant({ badges: ['cop', 'fire'], coins: 40 }));
  await page.goto('./');
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Title'));
  await page.waitForTimeout(800);
  const pt = await page.evaluate(() => window.__jbc!.logicalToClient(640, 250));
  if (isMobile) await page.touchscreen.tap(pt.x, pt.y);
  else await page.mouse.click(pt.x, pt.y);
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
  expect((await st(page)).badges).toEqual(['cop', 'fire']);
  expect(errors).toEqual([]);
});
