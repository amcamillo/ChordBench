import { test, expect } from '@playwright/test';

test('shows chord tones and shared notes, linked to the selected instrument', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('C | Am | F | G');
  await expect(page.getByRole('button', { name: 'C, occurrence 1', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'C, occurrence 1', exact: true }).click();
  await page.getByRole('button', { name: 'Spatial DNA', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Song DNA', exact: true })).toBeVisible();
  await expect(page.getByText(/2 shared pitch classes \(C, E\)/)).toBeVisible();
  const note = page.getByLabel('Notes in C').getByRole('button', { name: 'E 3M' });
  await note.click();
  await expect(note).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Focused chord tone: E. Dashed outlines mark matching pitches.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play chart', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next chord' }).click();
  await expect(page.getByLabel('Chord position')).toHaveValue('2');
  await expect(page.getByRole('button', { name: 'Am, occurrence 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/Am → F: 2 shared pitch classes/)).toBeVisible();
});

test('WebGL renders a 3D scene and offers view and motion controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Spatial DNA', exact: true }).click();
  const canvas = page.locator('.time-canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width)).toBeGreaterThan(0);
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
  expect(await canvas.evaluate((el: HTMLCanvasElement) => el.getContext('webgl2')?.getParameter(WebGL2RenderingContext.VERSION))).toContain('WebGL 2');
  await page.getByText('View controls', { exact: true }).click();
  const before = await canvas.screenshot();
  await page.getByLabel('View angle').fill('0.5');
  await expect(page.getByLabel('View angle')).toHaveValue('0.5');
  const after = await canvas.screenshot();
  expect(before.equals(after)).toBe(false);
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not laid out');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 75, box.y + box.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByLabel('View angle')).not.toHaveValue('0.5');
  await page.getByLabel('View angle').fill('0.5');
  await expect(page.getByLabel('View angle')).toHaveValue('0.5');
  await page.getByLabel('View tilt').fill('0.5');
  await expect(page.getByLabel('View tilt')).toHaveValue('0.5');
  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect(page.getByLabel('View angle')).toHaveValue('0.15');
  await page.locator('.time-stage').screenshot({ path: 'test-results/fifths-time-desktop.png' });
});

test('unavailable WebGL leaves text and note controls usable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null;
      return original.apply(this, [type, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('could not start the 3D graphics view');
  await expect(page.getByText(/2 shared pitch classes \(C, E\)/)).toBeVisible();
  await expect(page.getByLabel('Notes in C').getByRole('button', { name: 'E 3M' })).toBeEnabled();
});

test('playback follow moves the focused chord without changing manual selection', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('C | G | C');
  await page.getByRole('button', { name: 'C, occurrence 1', exact: true }).click();
  await page.getByRole('button', { name: 'Spatial DNA', exact: true }).click();
  await page.getByLabel('Chart tempo in beats per minute').fill('240');
  await page.getByRole('button', { name: 'Play chart', exact: true }).click();
  await expect(page.getByText('Following playback', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Chord position')).toHaveValue('2', { timeout: 3500 });
  await expect(page.getByRole('button', { name: 'C, occurrence 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Inspect this chord' }).click();
  await expect(page.getByRole('button', { name: 'G, occurrence 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Follow playback')).not.toBeChecked();
  await page.getByRole('button', { name: 'Stop chart', exact: true }).click();
});

test('the strand stays still until playback and follows the audio clock continuously', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('.time-canvas');
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
  await expect(canvas).toHaveAttribute('data-position', '0.000');
  const still = await canvas.screenshot();
  await page.waitForTimeout(250);
  expect((await canvas.screenshot()).equals(still)).toBe(true);
  await page.getByRole('button', { name: 'Play chart', exact: true }).click();
  await expect.poll(async () => Number(await canvas.getAttribute('data-position'))).toBeGreaterThan(.1);
  const earlier = Number(await canvas.getAttribute('data-position'));
  await expect.poll(async () => Number(await canvas.getAttribute('data-position'))).toBeGreaterThan(earlier + .05);
  await page.getByRole('button', { name: 'Pause chart', exact: true }).click();
  const paused = await canvas.getAttribute('data-position');
  await page.waitForTimeout(250);
  await expect(canvas).toHaveAttribute('data-position', paused!);
  await page.getByRole('button', { name: 'Resume chart', exact: true }).click();
  await expect.poll(async () => Number(await canvas.getAttribute('data-position'))).toBeGreaterThan(Number(paused) + .05);
});

test('mobile view respects reduced motion and has keyboard and text alternatives', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await page.getByRole('button', { name: 'Spatial DNA', exact: true }).click();
  await expect(page.getByText('Playback movement reduced by device setting.')).toBeVisible();
  await page.getByText('How to read this view').click();
  await expect(page.getByText(/Positions along the central thread represent written chord occurrences/)).toBeVisible();
  await page.getByLabel('Chord position').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Chord position')).toHaveValue('2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/fifths-time-mobile.png', fullPage: true });
});

test('unknown symbols do not create invented notes or shared-note links', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('C | H7 | G');
  await page.getByRole('button', { name: 'H7, occurrence 2, unresolved', exact: true }).click();
  await page.getByRole('button', { name: 'Spatial DNA', exact: true }).click();
  await expect(page.getByText('This symbol is unresolved, so no notes or relationships are guessed.')).toBeVisible();
  await expect(page.getByText(/an unresolved symbol prevents a note comparison/)).toBeVisible();
});

test('the workspace shortcut opens the immersive view', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore Song DNA' }).click();
  await expect(page.getByRole('heading', { name: 'Song DNA', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Song DNA', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('the 3D renderer recovers cleanly when the view is repeatedly changed or collapsed', async ({ page }) => {
  await page.goto('/');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (let i = 0; i < 5; i++) {
    await expect(page.locator('.time-canvas')).toHaveAttribute('data-renderer', 'webgl');
    await page.getByRole('button', { name: 'Song journey', exact: true }).click();
    await expect(page.locator('.time-canvas')).toHaveCount(0);
    await page.getByRole('button', { name: 'Spatial DNA', exact: true }).click();
  }
  await expect(page.locator('.time-canvas')).toHaveAttribute('data-renderer', 'webgl');
  await page.getByRole('button', { name: 'Collapse visualization' }).click();
  await page.getByRole('button', { name: 'Expand visualization' }).click();
  await expect(page.locator('.time-canvas')).toHaveAttribute('data-renderer', 'webgl');
  expect(errors).toEqual([]);
});

