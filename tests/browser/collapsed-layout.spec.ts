import { test, expect } from '@playwright/test';

test('collapsed sections remain compact labelled rows instead of stretched columns', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Collapse visualization' }).click();
  await page.getByRole('button', { name: 'Collapse editor', exact: true }).click();
  await page.getByRole('button', { name: 'Collapse chord details', exact: true }).click();
  await page.screenshot({ path: 'test-results/collapsed-desktop.png', fullPage: true });
  const workspace = (await page.locator('.workspace').boundingBox())!;
  for (const selector of ['.editor-panel', '.learning-panel']) {
    const box = (await page.locator(selector).boundingBox())!;
    expect(box.height, `${selector} must not stretch beside the open chart`).toBeLessThan(110);
    expect(box.width).toBeGreaterThan(workspace.width - 40);
  }
  await expect(page.getByRole('heading', { name: 'Chord details', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand chord details' })).toContainText('Expand');
});

test('every panel combination preserves reading order, bounds and usable toggles', async ({ page }) => {
  test.setTimeout(60000);
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (let mask = 0; mask < 8; mask++) {
      await page.goto('/');
      await page.evaluate(mask => localStorage.setItem('chord-workbench-panels-v1', JSON.stringify({ graph: false, editor: !!(mask & 1), chart: !!(mask & 2), details: !!(mask & 4), playback: false })), mask);
      await page.reload();
      if (width === 320) await page.getByRole('button', { name: 'Learn · C', exact: true }).click();
      const boxes = await page.locator('.workspace > *').evaluateAll(elements => elements.filter(el => getComputedStyle(el).display !== 'none').map(el => {
        const rect = el.getBoundingClientRect();
        const toggle = el.querySelector<HTMLButtonElement>('.panel-toggle')!;
        const button = toggle.getBoundingClientRect();
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, height: rect.height, chart: el.classList.contains('chart-panel'), closed: toggle.getAttribute('aria-expanded') === 'false', button: { x: button.x, right: button.right, height: button.height } };
      }));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `width ${width}, mask ${mask}`).toBe(true);
      for (const [index, box] of boxes.entries()) {
        if (box.closed && !box.chart) expect(box.height).toBeLessThan(110);
        expect(box.button.x).toBeGreaterThanOrEqual(box.x);
        expect(box.button.right).toBeLessThanOrEqual(box.right);
        expect(box.button.height).toBeGreaterThanOrEqual(44);
        if (index) expect(box.y).toBeGreaterThanOrEqual(boxes[index - 1].y);
      }
    }
  }
});

test('mobile chart collapses into two compact cards with reachable restore buttons', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Collapse editor', exact: true }).click();
  await page.getByRole('button', { name: 'Collapse chart', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play chart', exact: true })).toBeVisible();
  await expect(page.locator('#chart-content')).toBeHidden();
  for (const selector of ['.editor-panel']) {
    const box = (await page.locator(selector).boundingBox())!;
    expect(box.height).toBeLessThan(110);
  }
  await page.locator('.workspace').screenshot({ path: 'test-results/collapsed-mobile.png' });
  await page.getByRole('button', { name: 'Expand chart', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'C, occurrence 1', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
