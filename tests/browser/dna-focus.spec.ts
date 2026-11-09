import { test, expect } from '@playwright/test';

test('active chord stays centered during playback, pause, navigation and camera changes', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('.time-canvas');
  const centered = async () => {
    await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-focus-x')))).toBeLessThan(.001);
    await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-focus-y')))).toBeLessThan(.001);
  };
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
  await centered();
  await page.getByLabel('Chart tempo in beats per minute').fill('240');
  await page.getByRole('button', { name: 'Play chart', exact: true }).click();
  await expect.poll(async () => Number(await canvas.getAttribute('data-position'))).toBeGreaterThan(.25);
  await centered();
  await expect(page.getByLabel('Chord position')).toHaveValue('2');
  await centered();
  await page.getByRole('button', { name: 'Pause chart', exact: true }).click();
  await centered();
  await page.getByRole('button', { name: 'Next chord', exact: true }).click();
  await centered();
  await page.getByText('View controls', { exact: true }).click();
  await page.getByLabel('View angle').fill('0.5');
  await page.getByLabel('View tilt').fill('-0.5');
  await centered();
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await page.locator('.time-stage').screenshot({ path: 'test-results/dna-centered.png' });
  await page.getByRole('button', { name: 'Whole song', exact: true }).click();
  await centered();
  await page.getByLabel('Jump to chord', { exact: true }).fill('12');
  await centered();
});

test('rhythm explanations and camera sliders stay tucked away until requested', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await page.getByRole('combobox', { name: 'Visual groove', exact: true }).selectOption('samba');
  await expect(page.locator('.dna-rhythm-cell')).toBeHidden();
  await expect(page.getByLabel('View angle')).toBeHidden();
  await page.getByText('Rhythm pattern & explanation', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.dna-rhythm-cell')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
