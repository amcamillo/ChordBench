import { test, expect } from '@playwright/test';

test.use({ hasTouch: true });

for (const width of [320, 375, 820, 1024]) {
  test(`musician companion at ${width}px: all views fit and controls are tappable`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1024 ? 768 : 900 });
    await page.goto('/');
    const check = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const small = await page.locator('button, select, summary').evaluateAll(elements => elements.filter(el => {
        const box = el.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && (box.width < 47 || box.height < 47);
      }).map(el => el.getAttribute('aria-label') || el.textContent));
      expect(small).toEqual([]);
    };
    await check();
    if (width < 1024) {
      const chart = (await page.locator('.chart-panel').boundingBox())!;
      const editor = (await page.locator('.editor-panel').boundingBox())!;
      expect(chart.y).toBeLessThan(editor.y);
      await page.getByRole('button', { name: 'Graph', exact: true }).tap();
    }
    for (const name of ['Song DNA', 'Spatial DNA', 'Song journey', 'Harmonic map', 'Chord structure']) {
      await page.getByRole('button', { name, exact: true }).tap();
      await check();
      if (width === 375 && name === 'Song DNA') await page.screenshot({ path: 'test-results/touch-phone-dna.png', fullPage: true });
    }
    if (width < 1024) await page.getByRole('button', { name: 'Learn · C', exact: true }).tap();
    await check();
    await page.getByRole('button', { name: 'Guitar', exact: true }).tap();
    await check();
    await page.getByRole('button', { name: 'Piano', exact: true }).tap();
    await expect.poll(() => page.locator('.piano-scroll').evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    if (width === 375) await page.screenshot({ path: 'test-results/touch-phone-learn.png', fullPage: true });
    if (width < 1024) await page.getByRole('button', { name: 'Chart', exact: true }).tap();
    await page.getByRole('button', { name: 'Play chart', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Pause chart', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Stop chart', exact: true }).tap();
    if (width === 375 || width === 820) {
      await page.locator('.chart-panel').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/touch-chart-${width}.png`, fullPage: true });
    }
  });
}

test('bottom navigation stays reachable after editing and supports reduced motion and larger text', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit chart', exact: true }).tap();
  await expect(page.getByLabel('Chords and lyrics')).toBeFocused();
  await page.getByLabel('Chords and lyrics').fill('C | Am | F | G');
  await page.getByRole('button', { name: 'Graph', exact: true }).tap();
  await expect(page.getByRole('heading', { name: 'Song DNA', exact: true })).toBeVisible();
  const nav = (await page.locator('.mobile-tabs').boundingBox())!;
  expect(nav.y + nav.height).toBeLessThanOrEqual(667);
  await page.addStyleTag({ content: 'body { font-size: 20px; }' });
  await page.setViewportSize({ width: 812, height: 375 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Chart', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Am, occurrence 2', exact: true })).toBeVisible();
});
