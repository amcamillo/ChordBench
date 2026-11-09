import { test, expect } from '@playwright/test';

test('DNA voice paths follow the selected concrete piano voicing', async ({ page }) => {
  await page.goto('/');
  const panel = page.getByRole('region', { name: 'DNA voice leading' });
  const canvas = page.locator('.time-canvas');
  await expect(canvas).toHaveAttribute('data-voice-paths', '3');
  await panel.getByText('Voice movements', { exact: true }).click();
  await expect(panel).toContainText('G4 → A4: up 2 semitones');
  await expect(panel).toContainText('C4 → C4: same pitch');
  await page.getByLabel('DNA piano voicing', { exact: true }).selectOption('1');
  await expect(panel).toContainText('C4 → A3: down 3 semitones');
  await page.getByLabel('Voice-leading paths', { exact: true }).uncheck();
  await expect(canvas).toHaveAttribute('data-voice-paths', '0');
  await page.getByLabel('Voice-leading paths', { exact: true }).check();
  await page.getByRole('button', { name: 'Whole song', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-voice-paths', '3');
  await page.getByRole('button', { name: 'Chord detail', exact: true }).click();
  await page.getByLabel('DNA piano voicing', { exact: true }).selectOption('0');
  await page.locator('.time-stage').screenshot({ path: 'test-results/dna-voice-timing.png' });
  await page.getByLabel('Chords and lyrics').fill('C | H7 | Am');
  await page.getByRole('button', { name: 'C, occurrence 1', exact: true }).click();
  await expect(panel).toContainText('Both adjacent chords must resolve');
  await expect(canvas).toHaveAttribute('data-voice-paths', '0');
});

test('compact timing readout stays at the right edge across camera angles and mobile', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('.time-canvas');
  await expect(canvas).toHaveAttribute('data-timing-track', 'camera-facing');
  await page.getByText('View controls', { exact: true }).click();
  for (const [angle, tilt] of [['-0.75', '-0.65'], ['0.75', '0.75'], ['0.15', '0.4']]) {
    await page.getByLabel('View angle').fill(angle);
    await page.getByLabel('View tilt').fill(tilt);
    const bounds = JSON.parse((await canvas.getAttribute('data-rail-bounds'))!);
    expect(bounds.every((coordinate: number) => Math.abs(coordinate) < 1)).toBe(true);
    const size = await canvas.boundingBox();
    expect((bounds[2] - bounds[0]) * size!.width / 2).toBeCloseTo(128, 0);
    expect((1 - bounds[2]) * size!.width / 2).toBeCloseTo(12, 0);
    expect((1 + bounds[1]) * size!.height / 2).toBeCloseTo(12, 0);
  }
  await page.getByLabel('Timing guide & beat cues').uncheck();
  await expect(canvas).toHaveAttribute('data-timing-visible', 'false');
  await page.reload();
  await expect(page.getByLabel('Timing guide & beat cues')).not.toBeChecked();
  await page.getByLabel('Timing guide & beat cues').check();
  await expect(canvas).toHaveAttribute('data-timing-visible', 'true');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => {
    const bounds = JSON.parse((await canvas.getAttribute('data-rail-bounds'))!);
    return bounds.every((coordinate: number) => Math.abs(coordinate) < 1);
  }).toBe(true);
  await canvas.evaluate(element => element.scrollIntoView({ block: 'center' }));
  await page.locator('.time-stage').screenshot({ path: 'test-results/dna-voice-timing-mobile.png' });
});
