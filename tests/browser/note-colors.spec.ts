import { test, expect } from '@playwright/test';
import { noteColor } from '../../src/domain/harmony/noteColor.ts';

test.use({ hasTouch: true, storageState: { cookies: [], origins: [] } });
test('the same suggested pitch has the same color in the strand, score and piano', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Session views' }).getByRole('button', { name: 'Song DNA' }).tap();
  const canvas = page.locator('.session-dna .time-canvas');
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
  const notes = JSON.parse((await canvas.getAttribute('data-note-colors'))!);
  expect(notes.find((note: { midi: number }) => note.midi === 60)?.color).toBe(noteColor(60));
  await page.getByRole('button', { name: '3D options' }).tap();
  await page.getByLabel('Use suggested voicings for piano playback').check();
  await page.getByRole('button', { name: 'Close', exact: true }).tap();
  await page.getByRole('button', { name: 'Score', exact: true }).tap();
  await expect(page.locator('.score-staff [data-note-midi="60"]').first()).toHaveAttribute('data-note-color', noteColor(60));
  await expect(page.locator('.score-staff [data-note-midi="60"]').first()).toHaveAttribute('fill', 'white');
  await page.getByRole('button', { name: 'Instrument', exact: true }).tap();
  await expect(page.locator('.piano-key[data-note-midi="60"]')).toHaveAttribute('data-note-color', noteColor(60));
});
