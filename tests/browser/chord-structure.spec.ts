import { test, expect } from '@playwright/test';

test('structure note selection highlights the instrument; comparison draws on demand', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Chord structure', exact: true }).click();
  const third = page.getByRole('button', { name: 'Structure E, Major third, 3M' });
  await third.click();
  await expect(third).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Piano E4, chord note, selected in chord structure' })).toBeVisible();
  await expect(page.getByLabel('Selected chord note')).toContainText('Reference pitch: E4');
  await expect(page.getByRole('button', { name: 'Play chart' })).toBeVisible();
  await expect(page.getByText('C4 to E4: 4 semitones apart in this voicing.')).toBeVisible();
  await page.getByRole('button', { name: 'Show connection' }).click();
  await expect(page.getByRole('button', { name: 'Hide connection' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.structure-edges line[stroke-dasharray]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Hear note' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Playing E4 on reference piano.' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop structure audio' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Stopped.' })).toBeVisible();
});

test('changing chord and transposition updates structure and clears old selection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Chord structure', exact: true }).click();
  await page.getByRole('button', { name: 'Structure E, Major third, 3M' }).click();
  await page.getByRole('button', { name: 'Am, occurrence 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Structure C, Minor third, 3m' })).toBeVisible();
  await expect(page.getByLabel('Selected chord note')).toHaveCount(0);
  await page.getByRole('button', { name: 'Transpose up one semitone' }).click();
  await expect(page.getByRole('button', { name: 'Structure C#, Minor third, 3m' })).toBeVisible();
});

test('structure audio stops chart playback and slash bass is distinguished', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'C/E, occurrence 9', exact: true }).click();
  await page.getByRole('button', { name: 'Chord structure', exact: true }).click();
  await expect(page.getByText(/Requested slash bass: E.*E3/)).toBeVisible();
  await page.getByRole('button', { name: 'Play chart' }).click();
  await expect(page.getByRole('button', { name: 'Pause chart' })).toBeVisible();
  await page.getByRole('button', { name: 'Hear pair' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Chart playback stopped for chord structure audio.' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Playing C4 and E4 on reference piano.' })).toBeVisible();
});

test('mobile structure exposes full-size note list and keyboard controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await page.getByRole('button', { name: 'Chord structure', exact: true }).click();
  await page.getByRole('button', { name: 'Fit structure width' }).click();
  expect(await page.getByLabel('Chord structure graph, scroll horizontally to explore').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const note = page.getByLabel('Chord note list').getByRole('button', { name: 'G · Perfect fifth' });
  await note.focus(); await page.keyboard.press('Enter');
  await expect(note).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Learn · C' }).click();
  await expect(page.getByText('Focused chord tone: G. Dashed outlines mark matching pitches.')).toBeVisible();
  await expect.poll(() => page.getByLabel('Piano keyboard, scroll horizontally for more keys').evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await page.screenshot({ path: 'test-results/chord-structure-mobile.png', fullPage: true });
});
