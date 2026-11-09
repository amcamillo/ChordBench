import { test, expect } from '@playwright/test';

test('whole-song chord lens names tones and dives into the same occurrence', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Whole song', exact: true }).click();
  const lens = page.getByRole('region', { name: 'Focused chord diagram' });
  await expect(lens.getByRole('img')).toHaveAttribute('aria-label', 'C: C, Root; E, Major third; G, Perfect fifth');
  await lens.getByText('Notes & intervals', { exact: true }).click();
  await expect(lens).toContainText('Major third (3M)');
  await lens.getByRole('button', { name: 'Dive into chord' }).click();
  await expect(page.getByRole('button', { name: 'Chord detail', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Chord position')).toHaveValue('1');
  await expect(page.getByLabel('Follow playback')).not.toBeChecked();
  await expect(page.getByLabel('Notes in C').getByRole('button', { name: 'E 3M' })).toBeEnabled();
  await page.locator('.time-stage').screenshot({ path: 'test-results/dna-dive.png' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await page.getByRole('button', { name: 'Whole song', exact: true }).click();
  await expect(lens).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('background geometry moves continuously through a chord boundary while focus remains pinned', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('.time-canvas');
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
  await page.getByLabel('Chart tempo in beats per minute').fill('240');
  await page.getByRole('button', { name: 'Play chart', exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  const samples = await canvas.evaluate(async el => {
    const results: { position: number; z: number; center: number }[] = [];
    const start = performance.now();
    while (performance.now() - start < 5000) {
      results.push({ position: Number(el.getAttribute('data-position')), z: Number(el.getAttribute('data-background-z')), center: Number(el.getAttribute('data-focus-x')) });
      if (results.length > 12 && results.at(-1)!.position > 1.2) break;
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    return results;
  });
  expect(samples.some(s => s.position > 1.1)).toBe(true);
  expect(new Set(samples.map(s => s.z)).size).toBeGreaterThan(10);
  for (const s of samples) {
    expect(Math.abs(s.z - s.position * 1.45)).toBeLessThan(.003);
    expect(Math.abs(s.center)).toBeLessThan(.001);
  }
  await page.getByRole('button', { name: 'Pause chart', exact: true }).click();
  const paused = await canvas.getAttribute('data-background-z');
  await page.waitForTimeout(150);
  await expect(canvas).toHaveAttribute('data-background-z', paused!);
});

test('chord breakdown preserves slash bass, seventh roles and unresolved symbols', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('C/E | Fmaj7 | H7');
  await page.getByRole('button', { name: 'C/E, occurrence 1', exact: true }).click();
  await page.getByRole('button', { name: 'Whole song', exact: true }).click();
  const lens = page.getByRole('region', { name: 'Focused chord diagram' });
  await lens.getByText('Notes & intervals', { exact: true }).click();
  await expect(lens).toContainText('Requested bass: E');
  await page.getByRole('button', { name: 'Next chord', exact: true }).click();
  await expect(lens).toContainText('Major seventh (7M)');
  await page.getByRole('button', { name: 'Next chord', exact: true }).click();
  await expect(lens).toContainText('Unresolved symbol: no chord tones are invented.');
  await expect(lens.locator('li')).toHaveCount(0);
  await lens.screenshot({ path: 'test-results/dna-lens-unknown.png' });
});
