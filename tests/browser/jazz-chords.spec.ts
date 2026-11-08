import { test, expect } from '@playwright/test';

test('extended chart chords resolve, transpose, and play on piano and guitar', async ({ page }) => {
  await page.goto('/');
  const source = 'Bm7/b5 | B7/b9 | Bb7/b9 | A7(b13) | Am4 | G#m6/5+ | G(add9) | A7/b9 | G7/b9 | C6/9';
  await page.getByLabel('Chords and lyrics').fill(source);
  await expect(page.getByRole('button', { name: /C6add9, occurrence 10/ })).toBeVisible();
  await expect(page.getByText(/chord occurrences? will be silent/)).toHaveCount(0);
  await page.getByRole('button', { name: /B7b9, occurrence 2/ }).click();
  await expect(page.getByText(/Highlighted keys: B4 · D#5 · F#5 · A5 · C6/)).toBeVisible();
  await page.getByRole('button', { name: 'Play chord', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Playing B7b9 together.' })).toBeVisible();
  await page.getByLabel('Chart playback instrument').selectOption('guitar');
  await expect(page.getByText(/chord occurrences? will be silent/)).toHaveCount(0);
  await expect(page.getByText(/Generated pitch arrangement; fingering and physical playability have not been verified/)).toBeVisible();
  await page.getByRole('button', { name: 'Transpose up one semitone' }).click();
  await expect(page.getByRole('button', { name: /C7b9, occurrence 2/ })).toBeVisible();
  await expect(page.getByLabel('Chords and lyrics')).toHaveValue(source);
});
