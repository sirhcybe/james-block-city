import { expect, test, type Page } from '@playwright/test';

/**
 * Spec 003 (Cop job) flows: one per mission (AC6), the badge (AC7), Pro lock (AC8), Shop (AC9),
 * net (AC11), Time-Out Tower (AC12), Who Took It? (AC13), the board (AC15) and reload (AC17).
 * Like 002's tests these wait on game state, and use the debug hook to skip long drives.
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

async function boot(page: Page): Promise<void> {
  await page.goto('./?play');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
}

const until = (page: Page, fn: string, timeout = 90_000) =>
  page.waitForFunction(fn, null, { timeout, polling: 300 });

/** Keep pulling up behind fleeing robbers and firing the net until none is fleeing. */
const catchAll = (page: Page) =>
  until(
    page,
    `(() => { const s = window.__jbc.player(); if (!s) return false;
      if (s.robbers.some(r => r.phase === 'fleeing')) { window.__jbc.chaseUp(); window.__jbc.fireNet(); }
      return s.mission === null || s.mission.goal !== 'catch'; })()`,
  );

test.describe.configure({ timeout: 240_000 });

test('First Day: walk to the chief, get the cap, 3 flags, siren, Traffic Helper', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await boot(page);
  expect((await st(page)).offer).toBe('first-day');
  // Walk up to the chief: the mission starts with a voice intro, and you get your cap.
  await page.evaluate(() => window.__jbc!.goTo(7, 4));
  await expect.poll(async () => (await st(page)).mission?.id, LONG).toBe('first-day');
  expect(await page.evaluate(() => window.__jbc!.voiceLog())).toContain('intro-first-day');
  expect((await st(page)).owned).toContain('cap-cop');

  await page.evaluate(() => window.__jbc!.enterCar());
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('checkpoints');
  for (const f of ['flag-1', 'flag-2', 'flag-3'])
    await page.evaluate((m) => window.__jbc!.driveTo(m), f);
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('siren');
  await page.keyboard.press('KeyQ');
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('minigame');

  await page.evaluate(() => window.__jbc!.walkTo('traffic-helper'));
  await until(page, "window.__jbc.scenes().includes('TrafficHelper')");
  await page.evaluate(() => window.__jbc!.finishMinigame(9));
  await page.keyboard.press('Space');
  await expect.poll(async () => (await st(page))?.mission ?? null, LONG).toBeNull();
  const s = await st(page);
  expect(s.stars['first-day']).toBeGreaterThanOrEqual(1);
  expect(s.coins).toBe(15 + 15); // minigame tier 2 + mission
  expect(errors).toEqual([]);
});

test('Donut Dash: one net catches Pickles; he sits in Time-Out Tower, then sneaks out', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await boot(page);
  await page.evaluate(() => {
    window.__jbc!.grant({ done: ['first-day'] });
    window.__jbc!.startMission('donut-dash');
    window.__jbc!.enterCar();
  });
  await until(page, "window.__jbc.player().robbers.some(r => r.phase === 'fleeing')");
  // Net only when he's in range: from far away there's nothing to aim at.
  expect((await st(page)).netAim).toBeNull();
  await until(
    page,
    `(() => { window.__jbc.chaseUp(); return window.__jbc.player().netAim === 'pickles'; })()`,
  );
  const target = await page.evaluate(() => window.__jbc!.fireNet());
  expect(target).toBe('pickles');
  await expect.poll(async () => (await st(page)).mission, LONG).toBeNull();
  const s = await st(page);
  expect(s.chase.bumps).toBeLessThan(3); // the net did it, not three bumps
  expect(s.tower).toEqual(['pickles']);
  expect(s.coins).toBe(20);

  // Replay from the board: at the start of the next robber mission he sneaks out.
  await page.evaluate(() => window.__jbc!.exitCar());
  await page.evaluate(() => window.__jbc!.openMenu('MissionBoard'));
  await until(page, "window.__jbc.scenes().includes('MissionBoard')");
  await page.evaluate(() => window.__jbc!.pickMission('donut-dash'));
  await expect.poll(async () => (await st(page))?.mission?.id ?? null, LONG).toBe('donut-dash');
  await page.evaluate(() => window.__jbc!.enterCar());
  await expect.poll(async () => (await st(page)).tower, LONG).toEqual([]);
  expect(await page.evaluate(() => window.__jbc!.voiceLog())).toContain('tower-sneak');
  expect(errors).toEqual([]);
});

test('Duck Crossing: ducks follow you to the pond, and the Cop badge ceremony plays', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await boot(page);
  await page.evaluate(() => {
    window.__jbc!.grant({ done: ['first-day', 'donut-dash'] });
    window.__jbc!.startMission('duck-crossing');
    window.__jbc!.walkTo('ducks');
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__jbc!.goTo(13, 32));
  await expect.poll(async () => (await st(page)).mission, { timeout: 120_000 }).toBeNull();
  await expect.poll(async () => (await st(page)).badges, LONG).toEqual(['cop']);
  await expect
    .poll(() => page.evaluate(() => window.__jbc!.voiceLog()), LONG)
    .toEqual(expect.arrayContaining(['ducks-follow', 'done-duck-crossing', 'badge']));
  // The badge is saved.
  const saved = (await page.evaluate(() => window.__jbc!.saved())) as { badges: string[] };
  expect(saved.badges).toEqual(['cop']);
  expect(errors).toEqual([]);
});

test('Pro lock + Shop: no bike, no Pro missions; "not yet" costs nothing; 90 coins buys it', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await boot(page);
  await page.evaluate(() =>
    window.__jbc!.grant({ done: ['first-day', 'donut-dash', 'duck-crossing'], badges: ['cop'] }),
  );
  expect((await st(page)).offer).toBeNull(); // the chief needs you to get the bike first

  await page.evaluate(() => window.__jbc!.openMenu('Shop'));
  await until(page, "window.__jbc.scenes().includes('Shop')");
  expect(await page.evaluate(() => window.__jbc!.buy('police-bike'))).toBe(false);
  await page.evaluate(() => window.__jbc!.closeMenu());
  await until(page, "window.__jbc.scenes().includes('City')");
  expect((await st(page)).coins).toBe(0);

  await page.evaluate(() => window.__jbc!.grant({ coins: 100 }));
  await page.evaluate(() => window.__jbc!.openMenu('Shop'));
  await until(page, "window.__jbc.scenes().includes('Shop')");
  expect(await page.evaluate(() => window.__jbc!.buy('police-bike'))).toBe(true);
  await until(
    page,
    "window.__jbc.scenes().includes('City') && window.__jbc.player().bike !== null",
  );
  const s = await st(page);
  expect(s.coins).toBe(10);
  expect(s.owned).toContain('police-bike');
  await expect.poll(async () => (await st(page)).offer, LONG).toBe('rooftop-run');
  expect(await page.evaluate(() => document.body.innerText.trim())).toBe('');
  expect(errors).toEqual([]);
});

test('Rooftop Run: Smudge on his scooter, caught from the police bike, duck back to the mayor', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await boot(page);
  await page.evaluate(() => {
    window.__jbc!.grant({
      done: ['first-day', 'donut-dash', 'duck-crossing'],
      badges: ['cop'],
      owned: ['police-bike'],
    });
    window.__jbc!.startMission('rooftop-run');
    window.__jbc!.ride('police-bike');
  });
  await until(page, "window.__jbc.player().robbers.some(r => r.name === 'smudge')");
  await catchAll(page);
  await expect.poll(async () => (await st(page)).mission?.goalIndex, LONG).toBe(2);
  await page.evaluate(() => window.__jbc!.driveTo('mayor'));
  await expect.poll(async () => (await st(page)).mission, LONG).toBeNull();
  expect((await st(page)).stars['rooftop-run']).toBeGreaterThanOrEqual(1);
  expect((await st(page)).errands['find-rubber-duck']).toBe('offered'); // a new errand appears
  expect(errors).toEqual([]);
});

test('Lost Puppy: two empty bushes, the puppy in the third, home to his family', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await boot(page);
  await page.evaluate(() => {
    window.__jbc!.grant({
      done: ['first-day', 'donut-dash', 'duck-crossing'],
      badges: ['cop'],
      owned: ['police-bike'],
    });
    window.__jbc!.startMission('lost-puppy');
  });
  for (const spot of ['spot-1', 'spot-2']) {
    await page.evaluate((m) => window.__jbc!.walkTo(m), spot);
    await page.waitForTimeout(800);
  }
  expect((await st(page)).mission?.goal).toBe('find');
  await page.evaluate(() => window.__jbc!.walkTo('spot-3'));
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('goTo');
  await page.evaluate(() => window.__jbc!.walkTo('puppy-owner'));
  await expect.poll(async () => (await st(page)).mission, LONG).toBeNull();
  await expect
    .poll(() => page.evaluate(() => window.__jbc!.voiceLog()), LONG)
    .toEqual(expect.arrayContaining(['not-here', 'puppy-found', 'done-lost-puppy']));
  expect(errors).toEqual([]);
});

test('Double Trouble: catch both brothers, then Who Took It? at the station', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await page.evaluate(() => {
    window.__jbc!.grant({
      done: ['first-day', 'donut-dash', 'duck-crossing'],
      badges: ['cop'],
      owned: ['police-bike'],
    });
    window.__jbc!.startMission('double-trouble');
    window.__jbc!.ride('police-car');
  });
  await until(
    page,
    "window.__jbc.player().robbers.filter(r => r.phase === 'fleeing').length === 2",
  );
  await catchAll(page);
  await expect.poll(async () => (await st(page)).mission?.goal, LONG).toBe('minigame');
  await expect.poll(async () => (await st(page)).tower.sort(), LONG).toEqual(['pickles', 'smudge']);

  await page.evaluate(() => window.__jbc!.walkTo('who-took-it'));
  await until(page, "window.__jbc.scenes().includes('WhoTookIt')");
  await until(page, 'window.__jbc.culprit() >= 0');
  // A wrong tap is only a shrug; the right one scores.
  await page.evaluate(() => {
    const c = window.__jbc!.culprit();
    window.__jbc!.tapSuspect((c + 1) % 5);
    window.__jbc!.tapSuspect(c);
  });
  expect(await page.evaluate(() => window.__jbc!.voiceLog())).toEqual(
    expect.arrayContaining(['wti-wrong', 'wti-right']),
  );
  await page.evaluate(() => window.__jbc!.finishMinigame(11));
  await page.keyboard.press('Space');
  await expect.poll(async () => (await st(page)).mission === null, LONG).toBe(true);
  const s = await st(page);
  expect(s.stars['double-trouble']).toBeGreaterThanOrEqual(1);
  expect(s.coins).toBe(30 + 40);
  expect(errors).toEqual([]);
});

test('Reload keeps badges, owned items and stars (AC17)', async ({ page }) => {
  await boot(page);
  await page.evaluate(() =>
    window.__jbc!.grant({
      done: ['first-day', 'donut-dash', 'duck-crossing'],
      badges: ['cop'],
      owned: ['police-bike', 'cap-cop'],
      coins: 12,
    }),
  );
  await page.reload();
  await page.waitForFunction(() => window.__jbc?.scenes().includes('Hud'));
  const s = await st(page);
  expect(s.badges).toEqual(['cop']);
  expect(s.owned).toEqual(expect.arrayContaining(['police-bike', 'cap-cop']));
  expect(s.stars['duck-crossing']).toBe(1);
  expect(s.coins).toBe(12);
  expect(s.bike).not.toBeNull();
  expect(s.offer).toBe('rooftop-run');
});
