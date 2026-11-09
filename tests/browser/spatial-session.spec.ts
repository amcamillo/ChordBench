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
