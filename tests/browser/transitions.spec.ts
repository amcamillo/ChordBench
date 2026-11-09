import { test, expect } from '@playwright/test';

test('transition choices explain exact voices without rewriting the chart and stop chart playback', async ({ page }) => {
  await page.goto('/');
  const panel = page.getByRole('region', { name: 'To the next chord' });
  await expect(panel).toContainText('C → Am');
  await expect(panel.getByLabel('Voice movements')).toContainText('G4 → A4: up 2 semitones');
  const editor = page.getByLabel('Chords and lyrics');
  const source = await editor.inputValue();
  await panel.getByLabel('Reference voicing').selectOption('1');
  await expect(editor).toHaveValue(source);
  await panel.getByLabel('Reference voicing').selectOption('0');
  await page.getByRole('button', { name: 'Play chart', exact: true }).click();
  await panel.getByRole('button', { name: 'Hear transition', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Chart playback stopped for transition preview.' })).toBeVisible();
  await expect(panel.getByRole('status')).toContainText('Reference piano preview');
  await panel.getByRole('button', { name: 'Stop transition audio' }).click();
  await expect(panel.getByRole('status')).toHaveText('Transition audio stopped.');
  await page.getByRole('button', { name: 'Am, occurrence 2', exact: true }).click();
  await expect(panel.getByLabel('Reference voicing')).toHaveValue('0');
  await expect(panel).toContainText('Am → F');
  await page.getByRole('button', { name: 'Transpose up one semitone' }).click();
  await expect(panel).toContainText('A#m → F#');
});

test('mobile keyboard comparison fits and unresolved adjacent chords are not skipped', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Learn · C', exact: true }).click();
  const panel = page.getByRole('region', { name: 'To the next chord' });
  await expect(panel).toBeVisible();
  await panel.getByLabel('Reference voicing').focus();
  await page.keyboard.press('ArrowDown');
  await expect(panel.getByLabel('Reference voicing')).toHaveValue('1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel.screenshot({ path: 'test-results/transition-mobile.png' });
  await page.getByRole('button', { name: 'Chart', exact: true }).click();
  await page.getByLabel('Chords and lyrics').fill('[C] [H7] [Am]');
  await expect(page.getByText('H7', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'C, occurrence 1', exact: true }).click();
  await page.getByRole('button', { name: 'Learn · C', exact: true }).click();
  await expect(panel).toContainText('Both adjacent chords must be recognized');
  await expect(panel.getByRole('button', { name: 'Hear transition' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Chart', exact: true }).click();
  await page.getByRole('button', { name: 'Am, occurrence 3', exact: true }).click();
  await page.getByRole('button', { name: 'Learn · Am', exact: true }).click();
  await expect(panel).toContainText('This is the last written chord.');
});
