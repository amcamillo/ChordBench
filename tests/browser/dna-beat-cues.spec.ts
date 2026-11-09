import { test, expect } from '@playwright/test';

test('timing toggle controls audible dominant accents during playback', async ({ page }) => {
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const oscillator = original.call(this);
      const setFrequency = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
      let cue = false;
      oscillator.frequency.setValueAtTime = (value, time) => { cue = value === 850; return setFrequency(value, time); };
      const start = oscillator.start.bind(oscillator);
      oscillator.start = (when = 0) => { if (cue) (window as any).__beatCues = ((window as any).__beatCues || 0) + 1; return start(when); };
      return oscillator;
    };
  });
  await page.goto('/');
  await page.getByLabel('Chart tempo in beats per minute').fill('240');
  await page.getByLabel('Visual groove').selectOption('waltz');
  await page.getByRole('button', { name: 'Play chart from Song DNA' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__beatCues || 0)).toBeGreaterThan(0);
  await page.getByLabel('Timing guide & beat cues').uncheck();
  const stoppedAt = await page.evaluate(() => (window as any).__beatCues);
  await page.waitForTimeout(1600);
  expect(await page.evaluate(() => (window as any).__beatCues)).toBe(stoppedAt);
  await page.getByLabel('Timing guide & beat cues').check();
  await expect.poll(() => page.evaluate(() => (window as any).__beatCues)).toBeGreaterThan(stoppedAt);
  await page.getByRole('button', { name: 'Pause chart from Song DNA' }).click();
  const pausedAt = await page.evaluate(() => (window as any).__beatCues);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => (window as any).__beatCues)).toBe(pausedAt);
});
