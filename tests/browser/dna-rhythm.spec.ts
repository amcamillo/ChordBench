import { test, expect } from '@playwright/test';

test('whole-song view includes all 240 chords and can inspect the final chord', async ({ page }) => {
  await page.goto('/');
  const source = '[Verse]\n' + Array(120).fill('C').join(' | ') + '\n[Chorus]\n' + Array(119).fill('Am').join(' | ') + ' | G';
  await page.getByLabel('Chords and lyrics').fill(source);
  await page.getByRole('button', { name: 'Whole song', exact: true }).click();
  const canvas = page.locator('.time-canvas');
  await expect(canvas).toHaveAttribute('data-rendered', '240');
  await expect(canvas).toHaveAttribute('data-first', '1');
  await expect(canvas).toHaveAttribute('data-last', '240');
  await page.getByLabel('Jump to chord', { exact: true }).fill('240');
  await expect(page.getByLabel('Chord position')).toHaveValue('240');
  await expect(page.getByRole('button', { name: 'G, occurrence 240', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Chord detail', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-last', '240');
  await expect(page.getByLabel('Notes in G')).toBeVisible();
  await page.getByRole('combobox', { name: 'Jump to section', exact: true }).selectOption('120');
  await expect(page.getByLabel('Chord position')).toHaveValue('121');
  await page.getByRole('button', { name: 'Whole song', exact: true }).click();
  await page.getByRole('combobox', { name: 'Visual groove', exact: true }).selectOption('funk');
  await page.locator('.time-stage').screenshot({ path: 'test-results/dna-whole-song.png' });
});

test('groove examples alter geometry while preserving source and playback settings', async ({ page }) => {
  await page.goto('/');
  const source = await page.getByLabel('Chords and lyrics').inputValue();
  const canvas = page.locator('.time-canvas');
  const snapshots: Buffer[] = [];
  for (const id of ['waltz', 'bolero', 'phonk', 'funk', 'minuet', 'samba', 'rock', 'pop', 'rock-opera', 'rock-opera-ballad', 'jazz']) {
    await page.getByRole('combobox', { name: 'Visual groove', exact: true }).selectOption(id);
    await expect(canvas).toHaveAttribute('data-groove', id);
    snapshots.push(await canvas.screenshot());
  }
  for (let i = 0; i < snapshots.length; i++) for (let j = i + 1; j < snapshots.length; j++) expect(snapshots[i].equals(snapshots[j])).toBe(false);
  await expect(page.getByLabel('Chords and lyrics')).toHaveValue(source);
  await expect(page.getByLabel('Chart tempo in beats per minute')).toHaveValue('90');
  await page.getByRole('combobox', { name: /Meter/ }).selectOption('6/8');
  await expect(canvas).toHaveAttribute('data-meter', '6/8');
  await page.getByText('Rhythm pattern & explanation', { exact: true }).click();
  await expect(page.getByText(/Meter override: the example cell/)).toBeVisible();
  await page.getByRole('button', { name: 'Song journey', exact: true }).click();
  await page.getByRole('button', { name: 'Spatial DNA', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Visual groove', exact: true })).toHaveValue('jazz');
  await expect(page.getByRole('combobox', { name: /Meter/ })).toHaveValue('6/8');
});

test('mobile rhythm controls and overview remain usable with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await page.getByRole('combobox', { name: 'Visual groove', exact: true }).selectOption('waltz');
  await page.getByRole('button', { name: 'Whole song', exact: true }).click();
  await expect(page.locator('.time-canvas')).toHaveAttribute('data-rendered', '12');
  await page.getByLabel('Jump to chord', { exact: true }).focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByLabel('Chord position')).toHaveValue('2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('region', { name: 'Visual rhythm and meter' }).screenshot({ path: 'test-results/dna-rhythm-mobile.png' });
});
