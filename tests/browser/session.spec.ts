import { test, expect } from '@playwright/test';

test.use({ hasTouch: true, storageState: { cookies: [], origins: [] } });

for (const [width, height] of [[320, 667], [375, 667], [820, 1180], [1024, 768], [812, 375]]) {
  test(`session controls stay on screen at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Setup', exact: true })).toBeVisible();
    for (const name of ['Chart', 'Instrument', 'Song DNA']) {
      await page.getByRole('navigation', { name: 'Session views' }).getByRole('button', { name, exact: true }).tap();
      for (const label of ['Setup', 'Next session chord', 'Previous session chord', 'Play', 'Stop']) {
        const box = (await page.getByRole('button', { name: label, exact: true }).boundingBox())!;
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(height);
        expect(box.height).toBeGreaterThanOrEqual(48);
      }
      expect(await page.evaluate(() => ({ x: document.documentElement.scrollWidth > innerWidth, y: document.documentElement.scrollHeight > innerHeight }))).toEqual({ x: false, y: false });
      await page.getByRole('button', { name: 'Next session chord', exact: true }).tap();
      await expect(page.locator('.session-chord strong')).toHaveText(name === 'Chart' ? 'Am' : name === 'Instrument' ? 'F' : 'G');
      if (width === 375) await page.screenshot({ path: `test-results/session-${name.replace(' ', '-')}.png` });
    }
    await page.getByRole('button', { name: 'Play', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await page.getByRole('navigation', { name: 'Session views' }).getByRole('button', { name: 'Chart', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Stop', exact: true }).tap();
  });
}

test('setup preserves source and selection; page controls move only the music pane', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Setup', exact: true }).tap();
  await page.getByLabel('Chords and lyrics').fill(Array.from({ length: 40 }, (_, i) => `## Section ${i + 1}\nC | Am | F | G`).join('\n\n'));
  await expect(page.getByRole('heading', { name: 'Section 40', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'C, occurrence 1', exact: true }).click();
  await page.getByRole('button', { name: 'Start session', exact: true }).tap();
  await page.getByRole('button', { name: 'Page forward' }).tap();
  expect(await page.locator('.session-chart .chart-scroll').evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.getByRole('button', { name: 'Next session chord' }).tap();
  await expect(page.locator('.session-chord strong')).toHaveText('Am');
  await page.getByRole('button', { name: 'Setup', exact: true }).tap();
  await expect(page.getByLabel('Chords and lyrics')).toContainText('Section 40');
  await page.getByRole('button', { name: 'Start session', exact: true }).tap();
  await expect(page.locator('.session-chord strong')).toHaveText('Am');
});
