import { expect, test, type Page } from '@playwright/test';

/**
 * Spec 007: the whole game in one save (AC7, incl. the finale AC1–AC3), glowing stations (AC4),
 * offline play (AC5), the grown-up corner (AC6) and the J key (AC9).
 */

type Hook = NonNullable<Window['__jbc']>;
type State = NonNullable<ReturnType<Hook['player']>>;

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

const until = (page: Page, fn: string, timeout = 120_000) =>
  page.waitForFunction(fn, null, { timeout, polling: 300 });

async function boot(page: Page, play = true): Promise<void> {
  await page.goto(play ? './?play' : './');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForFunction((p) => window.__jbc?.scenes().includes(p ? 'Hud' : 'Title'), play);
}

/** The current goal object of the running mission (from the director). */
const goal = (page: Page) =>
  page.evaluate(() => {
    const c = window.__jbc!.game.scene.getScene('City') as unknown as {
      director: { run: { goal: Record<string, unknown> | null } | null };
    };
    return c.director.run?.goal ?? null;
  });

const VEHICLES = ['police-car', 'police-bike', 'fire-truck', 'mixer-truck'];

/**
 * Play one goal of the running mission with the debug shortcuts (the same moves a child makes,
 * minus the long drives). Returns when the goal has moved on.
 */
async function playGoal(page: Page): Promise<void> {
  const g = (await goal(page)) as {
    type: string;
    target?: string;
    flags?: string[];
    fires?: string[];
    spots?: string[];
    id?: string;
    at?: string;
    spot?: string;
    from?: string;
    to?: string;
  } | null;
  if (!g) return;
  const before = (await st(page)).mission;
  const moved = `(() => { const m = window.__jbc.player()?.mission; return !m || m.id !== '${before?.id}' || m.goalIndex !== ${before?.goalIndex}; })()`;
  switch (g.type) {
    case 'goTo':
      if (VEHICLES.includes(g.target!))
        await page.evaluate((v) => window.__jbc!.ride(v as never), g.target!);
      else if ((await st(page)).mode === 'car')
        await page.evaluate((m) => window.__jbc!.driveTo(m), g.target!);
      else await page.evaluate((m) => window.__jbc!.walkTo(m), g.target!);
      break;
    case 'checkpoints':
      for (const f of g.flags!) {
        await page.evaluate((m) => window.__jbc!.driveTo(m), f);
        await page.waitForTimeout(400);
      }
      break;
    case 'siren':
      await page.keyboard.press('KeyQ');
      break;
    case 'catch':
      await until(
        page,
        `(() => { const s = window.__jbc.player(); if (s.robbers.some(r => r.phase === 'fleeing')) { window.__jbc.chaseUp(); window.__jbc.fireNet(); } return ${moved}; })()`,
      );
      return;
    case 'escort':
      await page.evaluate((m) => window.__jbc!.walkTo(m), g.from!);
      await page.waitForTimeout(500);
      await page.evaluate(() => window.__jbc!.goTo(10, 25));
      break;
    case 'find':
      for (const s of g.spots!) {
        await page.evaluate((m) => window.__jbc!.walkTo(m), s);
        await page.waitForTimeout(800);
      }
      break;
    case 'minigame':
      await page.evaluate((m) => window.__jbc!.walkTo(m), g.id!);
      await until(page, `window.__jbc.finishMinigame(99)`);
      await page.waitForTimeout(300);
      await page.keyboard.press('Space');
      break;
    case 'spray':
      await until(
        page,
        `(() => { const s = window.__jbc.player(); if (s.mode !== 'car') window.__jbc.ride('fire-truck'); if (!s.hoseAim && s.fires.length) window.__jbc.driveTo(s.fires[0]); window.__jbc.hose(); return ${moved}; })()`,
      );
      return;
    case 'rescue':
      await page.evaluate((m) => window.__jbc!.driveTo(m), g.at!);
      break;
    case 'inside':
      await page.evaluate((m) => window.__jbc!.walkTo(m), g.at!);
      await until(page, "window.__jbc.scenes().includes('Interior')");
      await page.evaluate(() => window.__jbc!.interiorDone());
      break;
    case 'build':
      await page.evaluate(() => window.__jbc!.ride('mixer-truck'));
      await page.evaluate((m) => window.__jbc!.driveTo(`${m}-at`), g.spot!);
      await until(page, `(() => { window.__jbc.blast(); return ${moved}; })()`);
      return;
  }
  await until(page, moved);
}

/** Buy a job upgrade (earning the coins first as minigame pay, like playing ~3 minigames). */
async function buyUpgrade(page: Page, id: string): Promise<void> {
  await page.evaluate(() => window.__jbc!.grant({ coins: 90 }));
  await page.evaluate(() => window.__jbc!.openMenu('Shop'));
  await until(page, "window.__jbc.scenes().includes('Shop')");
  await page.evaluate((x) => window.__jbc!.shopTap(x), id);
  await until(page, "window.__jbc.scenes().includes('City')", 30_000);
}

test.describe.configure({ timeout: 1_800_000 });

test('the whole game in one save: 18 job missions, the finale, and the parade (AC7)', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chrome', 'one full playthrough is enough');
  const errors = watchErrors(page);
  await boot(page);
  const order: Record<string, string[]> = {
    cop: [
      'first-day',
      'donut-dash',
      'duck-crossing',
      'rooftop-run',
      'lost-puppy',
      'double-trouble',
    ],
    fire: [
      'siren-school',
      'kitty-floor-10',
      'toaster-trouble',
      'barbecue-blaze',
      'fireworks-fiasco',
      'tallest-tower',
    ],
    builder: [
      'hard-hat-day',
      'dock-it',
      'mixer-mayhem',
      'lighthouse-lights',
      'boat-shop',
      'bridge-to-the-island',
    ],
  };
  const upgrade: Record<string, string> = {
    cop: 'police-bike',
    fire: 'long-ladder',
    builder: 'giant-drum',
  };
  for (const job of ['cop', 'fire', 'builder']) {
    if (job !== 'cop') {
      await page.evaluate(() => window.__jbc!.openMenu('JobCenter'));
      await until(page, "window.__jbc.scenes().includes('JobCenter')");
      expect(await page.evaluate((j) => window.__jbc!.pickJob(j as never), job)).toBe(true);
      await until(
        page,
        `window.__jbc.scenes().includes('City') && window.__jbc.player().job === '${job}'`,
      );
    }
    for (const [i, id] of order[job]!.entries()) {
      if (i === 3) await buyUpgrade(page, upgrade[job]!);
      // The boss offers exactly this mission next; start it as walking up to them would.
      await expect.poll(async () => (await st(page)).offer, { timeout: 60_000 }).toBe(id);
      await page.evaluate((m) => window.__jbc!.startMission(m), id);
      for (let n = 0; n < 8 && (await st(page)).mission; n++) await playGoal(page);
      await expect
        .poll(async () => (await st(page)).stars[id] ?? 0, { timeout: 60_000 })
        .toBeGreaterThanOrEqual(1);
      if ((await st(page)).mode === 'car') await page.evaluate(() => window.__jbc!.exitCar());
      await page.waitForTimeout(4500); // the boss waits a moment after a mission
    }
    expect((await st(page)).badges).toContain(job);
  }

  // The finale: the mayor offers the three parts, each switching the uniform.
  for (const [id, job] of [
    ['finale-tower-fire', 'fire'],
    ['finale-helicopter', 'cop'],
    ['finale-rebuild', 'builder'],
  ] as const) {
    await page.evaluate(() => window.__jbc!.walkTo('mayor'));
    await expect
      .poll(async () => (await st(page)).mission?.id ?? null, { timeout: 60_000 })
      .toBe(id);
    expect((await st(page)).job).toBe(job);
    for (let n = 0; n < 8 && (await st(page)).mission; n++) await playGoal(page);
    if ((await st(page)).mode === 'car') await page.evaluate(() => window.__jbc!.exitCar());
    await page.waitForTimeout(4500);
  }
  await expect
    .poll(async () => (await st(page)).owned.includes('finale-done'), { timeout: 60_000 })
    .toBe(true);
  expect(Object.keys((await st(page)).stars)).toHaveLength(21);
  await expect
    .poll(() => page.evaluate(() => window.__jbc!.voiceLog()), { timeout: 60_000 })
    .toContain('parade');
  // Play forever: after the parade the city carries on, and the boards still replay missions.
  await expect
    .poll(() => page.evaluate(() => window.__jbc!.voiceLog()), { timeout: 120_000 })
    .toContain('morning');
  expect(await page.evaluate(() => window.__jbc!.scenes())).toContain('City');
  expect(errors).toEqual([]);
});

test('glowing job stations switch the job right away once the finale is open (AC4)', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await boot(page);
  // Before the finale: the stations do nothing.
  await page.evaluate(() => window.__jbc!.walkTo('station-fire'));
  await page.waitForTimeout(800);
  expect((await st(page)).job).toBe('cop');
  await page.evaluate(() => {
    const c = window.__jbc!.game.scene.getScene('City') as unknown as {
      state: { content: { missions: { id: string; tier: string }[] } };
    };
    const ids = c.state.content.missions.filter((m) => m.tier !== 'finale').map((m) => m.id);
    window.__jbc!.grant({ done: ids, badges: ['cop', 'fire', 'builder'] });
    window.__jbc!.walkTo('station-builder');
  });
  await expect.poll(async () => (await st(page)).job, { timeout: 60_000 }).toBe('builder');
  await page.evaluate(() => window.__jbc!.walkTo('station-fire'));
  await expect.poll(async () => (await st(page)).job, { timeout: 60_000 }).toBe('fire');
  expect(errors).toEqual([]);
});

test('J opens the uniforms only with all three badges (AC9)', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__jbc!.grant({ badges: ['cop', 'fire'] }));
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__jbc!.scenes())).not.toContain('JobCenter');
  await page.evaluate(() => window.__jbc!.grant({ badges: ['builder'] }));
  await page.keyboard.press('KeyJ');
  await until(page, "window.__jbc.scenes().includes('JobCenter')", 30_000);
});

test('the grown-up corner: a tap does nothing, a 2 s hold opens it; levels, unlock, reset (AC6)', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chrome', 'mouse hold');
  const errors = watchErrors(page);
  await boot(page, false);
  const gear = await page.evaluate(() => window.__jbc!.logicalToClient(1220, 60));
  await page.mouse.click(gear.x, gear.y);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__jbc!.scenes())).not.toContain('GrownUp');
  await page.mouse.move(gear.x, gear.y);
  await page.mouse.down();
  await until(page, "window.__jbc.scenes().includes('GrownUp')", 30_000);
  await page.mouse.up();

  // Sound off, voice quiet: saved apart from the game save and kept after a reload.
  const at = (x: number, y: number) =>
    page.evaluate(([a, b]) => window.__jbc!.logicalToClient(a!, b!), [x, y]);
  let p = await at(420, 170);
  await page.mouse.click(p.x, p.y);
  p = await at(620, 280);
  await page.mouse.click(p.x, p.y);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('jbc.settings') ?? 'null')),
  ).toEqual({
    sound: 0,
    voice: 0.5,
  });
  // Unlock everything.
  p = await at(300, 420);
  await page.mouse.click(p.x, p.y);
  const saved = (await page.evaluate(() => window.__jbc!.saved())) as {
    badges: string[];
    owned: string[];
  };
  expect(saved.badges).toEqual(['cop', 'fire', 'builder']);
  expect(saved.owned).toEqual(expect.arrayContaining(['police-bike', 'long-ladder', 'giant-drum']));
  // Reset needs a 3 s hold, then the game reloads with a fresh save (settings stay).
  p = await at(300, 530);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForEvent('load', { timeout: 60_000 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Title'));
  const fresh = (await page.evaluate(() => window.__jbc!.saved())) as { badges: string[] };
  expect(fresh.badges).toEqual([]);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('jbc.settings') ?? 'null')),
  ).toEqual({
    sound: 0,
    voice: 0.5,
  });
  expect(errors).toEqual([]);
});

test('installable and offline: manifest + service worker; reload with the network off (AC5)', async ({
  page,
  context,
}) => {
  await page.goto('./');
  const manifest = await page.evaluate(() =>
    document.querySelector('link[rel=manifest]')?.getAttribute('href'),
  );
  expect(manifest).toBeTruthy();
  const res = await page.request.get(`./${manifest!.replace('./', '')}`);
  expect(res.ok()).toBe(true);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 60_000 });
  // The worker has cached the game: go offline and reload.
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Title'), null, {
    timeout: 60_000,
  });
  await context.setOffline(false);
});
