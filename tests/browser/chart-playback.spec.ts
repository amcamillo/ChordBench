import { test, expect } from '@playwright/test';

test('plays written order, highlights each chord, pauses and resumes, and stops', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('C | G | C');
  await expect(page.getByRole('button', { name: 'G, occurrence 2', exact: true })).toBeEnabled();
  await page.getByLabel('Chart tempo in beats per minute').fill('240');
  await page.getByRole('button', { name: 'Play chart' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Chord 1 of 3: C' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'C, occurrence 1', exact: true })).toHaveClass(/playing-token/);
  await expect(page.getByRole('status').filter({ hasText: 'Chord 2 of 3: G' })).toBeVisible({ timeout: 3500 });
  await page.getByRole('button', { name: 'Pause chart' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Paused.' })).toContainText('Chord 2 of 3: G');
  await page.waitForTimeout(1100);
  await expect(page.getByRole('status').filter({ hasText: 'Paused.' })).toContainText('Chord 2 of 3: G');
  await page.getByRole('button', { name: 'Resume chart' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Chord 3 of 3: C' })).toBeVisible({ timeout: 3500 });
  await page.getByRole('button', { name: 'Stop chart' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Stopped.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'C, occurrence 3', exact: true })).not.toHaveClass(/playing-token/);
});

test('guitar warnings retain silent timing, instrument selection stays shared, and preview stops chart', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('C | Cmaj13 | Am');
  await expect(page.getByRole('button', { name: 'Am, occurrence 3', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'C, occurrence 1', exact: true }).click();
  await page.getByLabel('Chart playback instrument').selectOption('guitar');
  await expect(page.getByText('1 chord occurrence will be silent: Cmaj13 (No compatible guitar shape).')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guitar', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Chart tempo in beats per minute').fill('240');
  await page.getByRole('button', { name: 'Play chart' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Chord 2 of 3: Cmaj13 (silent)' })).toBeVisible({ timeout: 3500 });
  await page.getByRole('button', { name: 'Am, occurrence 3', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause chart' })).toBeVisible();
  await page.getByRole('button', { name: 'Play chord', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Chart playback stopped for instrument preview.' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Playing Am together.' })).toBeVisible();
});

test('editing the chart stops playback and mobile transport remains accessible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Play chart' }).click();
  await expect(page.getByRole('button', { name: 'Pause chart' })).toBeVisible();
  await page.getByLabel('Chords and lyrics').fill('C | Am');
  await expect(page.getByRole('button', { name: 'Play chart' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop chart' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('tempo can be typed digit by digit and invalid values cannot start playback', async ({ page }) => {
  await page.goto('/');
  const tempo = page.getByLabel('Chart tempo in beats per minute');
  await tempo.fill('');
  await page.keyboard.type('120');
  await expect(tempo).toHaveValue('120');
  await expect(page.getByRole('button', { name: 'Play chart' })).toBeEnabled();
  await tempo.fill('10');
  await expect(page.getByText('Enter a tempo from 40 to 240 BPM.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play chart' })).toBeDisabled();
});
