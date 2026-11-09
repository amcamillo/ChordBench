import { test, expect } from '@playwright/test';

test('shape anticipates the next chord and the ruler freezes on pause', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chart tempo in beats per minute').fill('240');
  const canvas = page.locator('.time-canvas');
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
  await page.getByRole('button', { name: 'Play chart', exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  const samples = await canvas.evaluate(async element => {
    const result: { position: number; morph: number }[] = [];
    const start = performance.now();
    while (performance.now() - start < 2200) {
      result.push({ position: Number(element.getAttribute('data-position')), morph: Number(element.getAttribute('data-morph')) });
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    return result;
  });
  expect(samples.some(s => s.morph > .05 && s.morph < .95 && s.position % 1 > .82)).toBe(true);
  for (const s of samples.filter(s => s.position % 1 < .75 && s.position % 1 > .1)) expect(s.morph).toBe(0);
  await page.getByRole('button', { name: 'Pause chart', exact: true }).click();
  const paused = await canvas.getAttribute('data-timing-beat');
  await page.waitForTimeout(150);
  await expect(canvas).toHaveAttribute('data-timing-beat', paused!);
  await page.getByText('View controls', { exact: true }).click();
  await page.getByLabel('View angle').fill('-0.75');
  await page.getByLabel('View tilt').fill('0.75');
  await expect(canvas).toHaveAttribute('data-timing-track', 'camera-facing');
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await page.locator('.time-stage').screenshot({ path: 'test-results/dna-morph-ruler.png' });
});

test('mobile reduced-motion timing remains readable without anticipatory morphing', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await page.getByRole('button', { name: 'Play chart from Song DNA', exact: true }).click();
  await page.locator('.time-canvas').scrollIntoViewIfNeeded();
  await expect(page.locator('.time-canvas')).toHaveAttribute('data-morph', '0.0000');
  const bounds = JSON.parse((await page.locator('.time-canvas').getAttribute('data-rail-bounds'))!);
  expect(bounds.every((coordinate: number) => Math.abs(coordinate) < 1)).toBe(true);
  await page.getByRole('button', { name: 'Stop chart from Song DNA', exact: true }).click();
});
