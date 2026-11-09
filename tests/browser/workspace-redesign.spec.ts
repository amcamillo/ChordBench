import { test, expect } from '@playwright/test';

test('desktop visualization spans the workspace above chord details', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const workspace = await page.locator('.workspace').boundingBox();
  const graph = await page.locator('.graph-region').boundingBox();
  const details = await page.locator('.learning-panel').boundingBox();
  expect(workspace && graph && details).toBeTruthy();
  expect(graph!.width).toBeGreaterThan(workspace!.width - 4);
  expect(details!.y).toBeGreaterThanOrEqual(graph!.y + graph!.height - 1);
  await page.getByRole('button', { name: 'Collapse chord details' }).click();
  const collapsedGraph = await page.locator('.graph-region').boundingBox();
  expect(collapsedGraph!.width).toBeGreaterThan(workspace!.width - 4);
});

test('workspace panels collapse independently without losing chart or selection', async ({ page }) => {
  await page.goto('/');
  const source = page.getByLabel('Chords and lyrics');
  await source.fill('C | Am | G');
  await page.getByRole('button', { name: 'Am, occurrence 2', exact: true }).click();
  await page.getByRole('button', { name: 'Collapse editor' }).click();
  await expect(source).toBeHidden();
  await page.getByRole('button', { name: 'Collapse chart', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Am, occurrence 2', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Collapse chord details' }).click();
  await expect(page.getByRole('heading', { name: 'Inside the chord' })).toBeHidden();
  await page.getByRole('button', { name: 'Collapse visualization' }).click();
  await expect(page.getByRole('heading', { name: 'Song DNA' })).toBeHidden();
  await page.getByRole('button', { name: 'Expand editor' }).click();
  await expect(source).toHaveValue('C | Am | G');
  await page.getByRole('button', { name: 'Expand chart', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Am, occurrence 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Expand chord details' }).click();
  await expect(page.getByText('A minor', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expand visualization' }).click();
  await expect(page.getByRole('heading', { name: 'Song DNA' })).toBeVisible();
});

test('collapsing playback settings and visualization preserves active playback', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play chart', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause chart', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Collapse playback settings' }).click();
  await expect(page.getByLabel('Chart playback instrument')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Pause chart', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Collapse visualization' }).click();
  await expect(page.getByRole('button', { name: 'Pause chart', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop chart', exact: true }).click();
  await page.getByRole('button', { name: 'Expand playback settings' }).click();
  await expect(page.getByLabel('Chart playback instrument')).toBeVisible();
});

test('panel preferences survive reload and shortcut reopens visualization', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Collapse editor' }).click();
  await page.getByRole('button', { name: 'Collapse visualization' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('chord-workbench-panels-v1'))).toContain('"graph":false');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Expand editor' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand visualization' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit chart', exact: true }).click();
  await expect(page.getByLabel('Chords and lyrics')).toBeFocused();
  await page.getByRole('button', { name: 'Explore Song DNA' }).click();
  await expect(page.getByRole('heading', { name: 'Song DNA' })).toBeVisible();
});

test('mobile chart, graph and details collapse controls remain keyboard accessible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  const editor = page.getByRole('button', { name: 'Collapse editor' });
  await editor.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Expand editor' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await page.getByRole('button', { name: 'Collapse visualization' }).click();
  await page.getByRole('button', { name: 'Expand visualization' }).click();
  await page.getByRole('button', { name: 'Learn · C' }).click();
  await page.getByRole('button', { name: 'Collapse chord details' }).click();
  await page.getByRole('button', { name: 'Expand chord details' }).click();
  await expect(page.getByRole('heading', { name: 'Inside the chord' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/redesign-mobile.png', fullPage: true });
});

test('layout stays within the viewport at compact, intermediate and desktop widths', async ({ page }) => {
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}px`).toBe(true);
    const toggle = page.getByRole('button', { name: 'Collapse editor' });
    const box = await toggle.boundingBox();
    expect(box?.height, `target height at ${width}px`).toBeGreaterThanOrEqual(44);
  }
});
