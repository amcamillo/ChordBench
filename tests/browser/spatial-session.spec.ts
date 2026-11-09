import { test, expect } from '@playwright/test';

test.use({ hasTouch: true, storageState: { cookies: [], origins: [] } });

for (const [width, height] of [[320, 667], [375, 740], [820, 1180], [812, 375]]) {
  test(`3D strand is usable in the session at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Session views' }).getByRole('button', { name: 'Song DNA' }).tap();
    await expect(page.getByRole('button', { name: '3D strand' })).toHaveAttribute('aria-pressed', 'true');
    const canvas = page.locator('.session-dna .time-canvas');
    await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
    await expect(canvas).toHaveAttribute('data-rail-geometry', 'straight-pitch-class');
    await expect(canvas).toHaveAttribute('data-voice-paths', '3');
    await expect(page.locator('.dna-compact-summary')).toContainText('C → Am');
    await expect(page.locator('.dna-compact-summary')).toContainText('G4 → A4');
    const box = (await canvas.boundingBox())!;
    expect(box.width).toBeGreaterThan(200);
    expect(box.height).toBeGreaterThan(100);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const toggle = page.getByRole('button', { name: 'See the whole song DNA' });
    await toggle.tap();
    await expect(canvas).toHaveAttribute('data-scope', 'whole');
    await expect(canvas).toHaveAttribute('data-rendered', '12');
    await expect(canvas).toHaveAttribute('data-first', '1');
    await expect(canvas).toHaveAttribute('data-last', '12');
    await expect(page.getByRole('button', { name: 'Return to chord detail' })).toHaveAttribute('aria-pressed', 'true');
    const ends: number[][] = JSON.parse((await canvas.getAttribute('data-overview-ends'))!);
    for (const [x, y] of ends) { expect(Math.abs(x)).toBeLessThan(1); expect(Math.abs(y)).toBeLessThan(1); }
    await expect(page.locator('.dna-compact-summary')).toContainText('All 12 chords');
    if (width === 375 || width === 820) await page.screenshot({ path: `test-results/whole-dna-${width}.png` });
    await page.getByRole('button', { name: 'Return to chord detail' }).tap();
    await expect(canvas).toHaveAttribute('data-scope', 'detail');
    if (width === 375 || width === 820) await page.screenshot({ path: `test-results/spatial-session-${width}.png` });
    await page.getByRole('button', { name: 'Next session chord' }).tap();
    await expect(page.locator('.dna-compact-summary')).toContainText('Am → F');
    await page.getByRole('button', { name: '3D options' }).tap();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.locator('.dna-compact-options .dna-voice-leading p').first().evaluate(el => getComputedStyle(el).getPropertyValue('-webkit-line-clamp'))).toBe('none');
    await expect(page.getByLabel('Timing guide & beat cues')).not.toBeChecked();
    await page.getByRole('button', { name: 'Close', exact: true }).tap();
    await page.getByRole('button', { name: 'Score', exact: true }).tap();
    await expect(page.getByRole('region', { name: 'Song DNA score' })).toBeVisible();
    await page.getByRole('button', { name: '3D strand' }).tap();
    await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
  });
}

test('3D voicing choice is shared with the score and keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Session views' }).getByRole('button', { name: 'Song DNA' }).tap();
  await page.getByRole('button', { name: '3D options' }).tap();
  await page.getByLabel('DNA piano voicing').selectOption({ index: 1 });
  const selected = await page.getByLabel('DNA piano voicing').inputValue();
  await page.getByLabel('Use suggested voicings for piano playback').check();
  await page.getByRole('button', { name: 'Close', exact: true }).tap();
  await page.getByRole('button', { name: 'Score', exact: true }).tap();
  await page.getByRole('button', { name: 'Score options' }).tap();
  const option = page.getByLabel('Next chord voicing');
  expect(await option.evaluate((element: HTMLSelectElement) => element.selectedIndex)).toBe(Number(selected));
  await expect(page.getByLabel('Use these voicings for piano chart playback')).toBeChecked();
  await page.getByRole('button', { name: 'Close options' }).tap();
  const nextNames = (await page.locator('.score-staff').getAttribute('aria-label'))!.split('next Am ')[1].split(', ');
  await page.getByRole('button', { name: 'Next session chord' }).tap();
  await page.getByRole('button', { name: 'Instrument', exact: true }).tap();
  await expect(page.getByLabel('Piano chord notes').getByRole('button')).toHaveText(nextNames);
});

test('the score and voice summary remain usable without WebGL', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null;
      return original.call(this, type as '2d', ...args as []) as never;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Session views' }).getByRole('button', { name: 'Song DNA' }).tap();
  await expect(page.locator('.session-dna .time-canvas')).toHaveAttribute('data-renderer', 'unavailable');
  await expect(page.locator('.dna-compact-summary')).toContainText('C → Am');
  await expect(page.getByRole('alert')).toContainText('could not start');
  await page.getByRole('button', { name: 'Score', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Hear change', exact: true })).toBeVisible();
});

test('whole-song strand can select the final chord and keep it when returning to detail', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Session views' }).getByRole('button', { name: 'Song DNA' }).tap();
  await page.getByRole('button', { name: 'See the whole song DNA' }).tap();
  const canvas = page.locator('.session-dna .time-canvas');
  await expect(canvas).toHaveAttribute('data-scope', 'whole');
  const ends: number[][] = JSON.parse((await canvas.getAttribute('data-overview-ends'))!);
  const size = (await canvas.boundingBox())!;
  await canvas.tap({ position: { x: (ends[1][0] + 1) * size.width / 2, y: (1 - ends[1][1]) * size.height / 2 } });
  await expect(canvas).toHaveAttribute('data-position', '11.000');
  await page.getByRole('button', { name: 'Return to chord detail' }).tap();
  await expect(page.locator('.dna-compact-summary')).toContainText('End');
  await expect(canvas).toHaveAttribute('data-scope', 'detail');
});

test('session whole-song strand includes every occurrence in a long chart', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Setup', exact: true }).tap();
  await page.getByLabel('Chords and lyrics').fill(Array(239).fill('C').join(' | ') + ' | G');
  await page.getByRole('button', { name: 'Start session', exact: true }).tap();
  await page.getByRole('navigation', { name: 'Session views' }).getByRole('button', { name: 'Song DNA' }).tap();
  await page.getByRole('button', { name: 'See the whole song DNA' }).tap();
  const canvas = page.locator('.session-dna .time-canvas');
  await expect(canvas).toHaveAttribute('data-rendered', '240');
  await expect(canvas).toHaveAttribute('data-first', '1');
  await expect(canvas).toHaveAttribute('data-last', '240');
  await expect(page.locator('.dna-compact-summary')).toContainText('All 240 chords');
});

test('whole-song view supports unrestricted orbit, buttons, wheel and pinch zoom', async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Session views' }).getByRole('button', { name: 'Song DNA' }).tap();
  await page.getByRole('button', { name: 'See the whole song DNA' }).tap();
  const canvas = page.locator('.session-dna .time-canvas');
  await expect(canvas).toHaveAttribute('data-scope', 'whole');
  const box = (await canvas.boundingBox())!;
  const x = box.x + box.width * .5, y = box.y + box.height * .5;
  await page.mouse.move(x, y);
  await page.mouse.down(); await page.mouse.move(x + 150, y + 150, { steps: 5 }); await page.mouse.up();
  expect(Math.abs(Number(await canvas.getAttribute('data-view-yaw')))).toBeGreaterThan(.75);
  expect(Math.abs(Number(await canvas.getAttribute('data-view-tilt')))).toBeGreaterThan(.75);
  for (let i = 0; i < 2; i++) {
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 150, y + 150, { steps: 5 }); await page.mouse.up();
  }
  expect(Number(await canvas.getAttribute('data-view-yaw'))).toBeLessThan(-1);
  expect(Number(await canvas.getAttribute('data-view-tilt'))).toBeLessThan(-1);
  const rotatedEnds: number[][] = JSON.parse((await canvas.getAttribute('data-overview-ends'))!);
  await canvas.tap({ position: { x: (rotatedEnds[1][0] + 1) * box.width / 2, y: (1 - rotatedEnds[1][1]) * box.height / 2 } });
  await expect(canvas).toHaveAttribute('data-position', '11.000');
  const initial = Number(await canvas.getAttribute('data-view-zoom'));
  await page.getByRole('button', { name: 'Zoom in', exact: true }).tap();
  await expect.poll(async () => Number(await canvas.getAttribute('data-view-zoom'))).toBeGreaterThan(initial);
  await page.getByRole('button', { name: 'Zoom out', exact: true }).tap();
  await page.mouse.move(x, y); await page.mouse.wheel(0, -200);
  await expect.poll(async () => Number(await canvas.getAttribute('data-view-zoom'))).toBeGreaterThan(initial);
  const beforePinch = Number(await canvas.getAttribute('data-view-zoom'));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 30, y, id: 1 }, { x: x + 30, y, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 75, y, id: 1 }, { x: x + 75, y, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => Number(await canvas.getAttribute('data-view-zoom'))).toBeGreaterThan(beforePinch * 1.5);
  await page.getByRole('button', { name: 'Reset', exact: true }).tap();
  await expect(canvas).toHaveAttribute('data-view-zoom', '1.1000');
  await expect(canvas).toHaveAttribute('data-view-yaw', '0.1500');
  await page.getByRole('button', { name: 'Return to chord detail' }).tap();
  await expect(canvas).toHaveAttribute('data-view-zoom', '1.5500');
});
