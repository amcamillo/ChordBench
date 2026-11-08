import { test, expect } from '@playwright/test';

test('root and chord tones retain their visual roles across the fifths, structure and piano views', async ({ page }) => {
  await page.goto('/');
  const timeNotes = page.getByLabel('Notes in C');
  await expect(timeNotes.getByRole('button', { name: 'C root' })).toHaveClass(/orbital-root/);
  await expect(timeNotes.getByRole('button', { name: 'E 3M' })).toHaveClass(/orbital-tone/);
  await page.getByRole('button', { name: 'Chord structure', exact: true }).click();
  const root = page.getByRole('button', { name: 'Structure C, Root, 1P' });
  const third = page.getByRole('button', { name: 'Structure E, Major third, 3M' });
  await expect(root).toHaveClass(/orbital-root/);
  await expect(third).toHaveClass(/orbital-tone/);
  const toneColor = await third.evaluate(el => getComputedStyle(el, '::before').backgroundImage);
  await third.click();
  expect(await third.evaluate(el => getComputedStyle(el, '::before').backgroundImage)).toBe(toneColor);
  await expect(page.getByRole('button', { name: 'Piano C4, chord note' })).toHaveClass(/orbital-root/);
  await expect(page.getByRole('button', { name: 'Piano E4, chord note, selected in chord structure' })).toHaveClass(/orbital-tone/);
});
