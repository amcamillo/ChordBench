import { test, expect } from '@playwright/test';

test('audio schedules the exact selected chord frequencies', async ({ page }) => {
  await page.addInitScript(() => {
    const recorded: number[] = [];
    (window as unknown as { instrumentFrequencies: number[] }).instrumentFrequencies = recorded;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const oscillator = create.call(this);
      const set = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
      oscillator.frequency.setValueAtTime = (value, time) => { recorded.push(value); return set(value, time); };
      return oscillator;
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Play chord', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Playing C together.' })).toBeVisible();
  const frequencies = await page.evaluate(() => (window as unknown as { instrumentFrequencies: number[] }).instrumentFrequencies);
  expect(frequencies).toHaveLength(3);
  for (const [index, expected] of [261.6256, 329.6276, 391.9954].entries()) expect(frequencies[index]).toBeCloseTo(expected, 2);
});

test('piano chord, individual note, inversion and transposition follow the selected chord', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Play this chord' })).toBeVisible();
  await expect(page.getByText('Highlighted keys: C4 · E4 · G4.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Play chord', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Playing C together.' })).toBeVisible();
  await page.getByLabel('Piano inversion').selectOption('1');
  await expect(page.getByText('Highlighted keys: E4 · G4 · C5.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Piano E4, chord note' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Playing E4.' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop sound' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Stopped.' })).toBeVisible();
  await page.getByRole('button', { name: 'Transpose up one semitone' }).click();
  await expect(page.getByText('Highlighted keys: C#4 · E#4 · G#4.', { exact: false })).toBeVisible();
});

test('guitar chart, string playback and derived slash-bass arrangement', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Guitar', exact: true }).click();
  await expect(page.getByRole('img', { name: /Open C chord box/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /String 6 Muted/ })).toBeDisabled();
  await page.getByRole('button', { name: /String 5 C3 Fret 3, finger 3/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Playing string 5, C3.' })).toBeVisible();
  await page.getByRole('button', { name: 'Strum chord' }).click();
  await expect(page.getByRole('status').filter({ hasText: /illustrative strum/ })).toBeVisible();
  await page.getByRole('button', { name: 'C/E, occurrence 9', exact: true }).click();
  await expect(page.getByRole('img', { name: /C\/E reference chord box/ })).toBeVisible();
  await expect(page.getByText(/Generated pitch arrangement; fingering and physical playability have not been verified/)).toBeVisible();
  await page.getByRole('button', { name: 'Piano', exact: true }).click();
  await expect(page.getByText('Highlighted keys: E3 (bass) · C4 · E4 · G4.', { exact: false })).toBeVisible();
});

test('mobile instrument controls preserve selected occurrence and avoid page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Am, occurrence 2', exact: true }).click();
  await page.getByRole('button', { name: 'Learn · Am', exact: true }).click();
  await page.getByRole('button', { name: 'Guitar', exact: true }).click();
  await expect(page.getByRole('img', { name: /Open Am chord box/ })).toBeVisible();
  await page.getByRole('button', { name: 'Play chord', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Playing Am together.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-instruments.png', fullPage: true });
});
