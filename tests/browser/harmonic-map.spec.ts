import { test, expect } from '@playwright/test';

test('consolidates repeated chord occurrences and links them back without autoplay', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('C | G | C');
  await expect(page.getByRole('button', { name: 'C, occurrence 3', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Harmonic map', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Harmonic map' })).toBeVisible();
  await page.getByRole('button', { name: 'Map C, 2 occurrences' }).click();
  await expect(page.getByLabel('Occurrences of C')).toBeVisible();
  await page.getByRole('button', { name: 'Occurrence 3 · Chart · C' }).click();
  await expect(page.getByRole('button', { name: 'C, occurrence 3', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Chart / occurrence 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play chart', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'C → G · 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'G → C · 1' })).toBeVisible();
  await page.getByRole('button', { name: 'C → G · 1' }).click();
  await expect(page.getByLabel('Transition occurrences')).toContainText('From 1');
  await page.getByRole('button', { name: 'To 2 · Chart · G' }).click();
  await expect(page.getByRole('button', { name: 'G, occurrence 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('unknowns break transitions and self-loops remain visible', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('C | C | H7 | G | C');
  await expect(page.getByRole('button', { name: 'C, occurrence 5', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Harmonic map', exact: true }).click();
  await expect(page.getByRole('button', { name: 'C → C · 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'G → C · 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'C → G · 1' })).toHaveCount(0);
  await expect(page.getByText('1 unresolved occurrence excluded. Transitions across them are not inferred.')).toBeVisible();
  await page.getByRole('button', { name: 'Occurrence 3 · Chart · H7' }).click();
  await expect(page.getByText('Unresolved symbol')).toBeVisible();
});

test('mobile map retains occurrence selection and supports keyboard list', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('C | Am | F | G');
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await page.getByRole('button', { name: 'Harmonic map', exact: true }).click();
  await page.getByRole('button', { name: 'Fit map width' }).click();
  await expect(page.getByLabel('Harmonic map zoom', { exact: true })).not.toHaveText('100%');
  const chord = page.getByRole('button', { name: 'Am · 1', exact: true });
  await chord.focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Occurrence 2 · Chart · Am' }).click();
  await page.getByRole('button', { name: 'Learn · Am' }).click();
  await expect(page.getByText('A minor', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await page.screenshot({ path: 'test-results/harmonic-mobile.png', fullPage: true });
});

test('large variety uses complete accessible lists instead of an oversized graphic', async ({ page }) => {
  await page.goto('/');
  const symbols = ['C','D','E','F'].flatMap(root => ['', 'm','7','maj7','m7','dim','aug','sus2','sus4'].map(suffix => root + suffix));
  await page.getByLabel('Chords and lyrics').fill(symbols.join(' | '));
  await expect(page.getByText('36 chord occurrences', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Harmonic map', exact: true }).click();
  await expect(page.getByText(/more than 32 distinct chords/)).toBeVisible();
  await expect(page.getByLabel('Chord identities').getByRole('button')).toHaveCount(36);
});
