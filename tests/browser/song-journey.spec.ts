import { test, expect } from '@playwright/test';

test('graph, chart and inspector share occurrence selection without starting audio', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('C | G | C');
  await page.getByRole('button', { name: 'Song journey', exact: true }).click();
  const third = page.getByRole('button', { name: 'Graph C, occurrence 3', exact: true });
  await expect(third).toBeEnabled();
  await third.click();
  await expect(page.getByRole('button', { name: 'C, occurrence 3', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Chart / occurrence 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play chart' })).toBeVisible();
  await page.getByRole('button', { name: 'G, occurrence 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Graph G, occurrence 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Transpose up one semitone' }).click();
  await expect(page.getByRole('button', { name: 'Graph G#, occurrence 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('sections collapse, fit and keyboard list keep each occurrence selectable', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('[Verse]\nC | Am\n[Verse]\nF | G');
  await page.getByRole('button', { name: 'Song journey', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Graph G, occurrence 4' })).toBeEnabled();
  const verse = page.getByRole('button', { name: '▾ Verse 2 chords' });
  await expect(verse).toHaveCount(2);
  await verse.first().click();
  await expect(page.getByRole('button', { name: 'Graph C, occurrence 1' })).toHaveCount(0);
  await expect(page.getByText('↓ Am → F (next section)')).toBeVisible();
  await page.getByText('Show chord list instead').click();
  const listNode = page.getByRole('button', { name: '1. C', exact: true });
  await listNode.focus(); await page.keyboard.press('Enter');
  await expect(listNode).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Fit width' }).click();
  await expect(page.getByLabel('Graph zoom', { exact: true })).toBeVisible();
});

test('mobile Graph tab retains selection when moving between views', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('C | Am | F | G');
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await page.getByRole('button', { name: 'Song journey', exact: true }).click();
  await page.getByRole('button', { name: 'Graph Am, occurrence 2' }).click();
  await page.getByRole('button', { name: 'Learn · Am' }).click();
  await expect(page.getByText('A minor', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chart', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Am, occurrence 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('playback highlights graph independently of manual exploration', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('C | G | C');
  await page.getByRole('button', { name: 'Song journey', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Graph C, occurrence 3' })).toBeEnabled();
  await page.getByRole('button', { name: 'Graph C, occurrence 3' }).click();
  await page.getByLabel('Chart tempo in beats per minute').fill('240');
  await page.getByRole('button', { name: 'Play chart' }).click();
  await expect(page.getByRole('button', { name: 'Graph C, occurrence 1' })).toHaveClass(/journey-playing/);
  await expect(page.getByRole('button', { name: 'Graph C, occurrence 3' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Graph G, occurrence 2' })).toHaveClass(/journey-playing/, { timeout: 3500 });
  await page.getByRole('button', { name: 'Stop chart' }).click();
  await expect(page.getByRole('button', { name: 'Graph G, occurrence 2' })).not.toHaveClass(/journey-playing/);
});
