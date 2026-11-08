import { test, expect } from '@playwright/test';

test('paste, inspect, transpose and keep unknown tokens', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('[Verse]\n[C/E]Hello [H7]world');
  const source = page.getByLabel('Chords and lyrics');
  await expect(page.getByRole('button', { name: 'C/E, occurrence 1', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'C/E, occurrence 1', exact: true }).click();
  await page.getByRole('button', { name: 'Transpose up one semitone' }).click();
  await page.getByRole('button', { name: 'Transpose up one semitone' }).click();
  await expect(page.getByRole('button', { name: 'D/F#, occurrence 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Bass: F#', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'H7, occurrence 2, unresolved', exact: true })).toBeVisible();
  await expect(source).toHaveValue('[Verse]\n[C/E]Hello [H7]world');
  await expect(page.getByText('1 unresolved symbol(s) remain as written.', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

test('review distinguishes lyric from chord and focuses token editing', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('Am\nI still here');
  await page.getByRole('button', { name: 'Treat as chord' }).click();
  await expect(page.getByRole('button', { name: 'Am, occurrence 1', exact: true })).toBeVisible();
  await page.getByLabel('Chords and lyrics').fill('[H7]Our lyric');
  await page.getByRole('button', { name: 'Edit token' }).click();
  await expect(page.getByLabel('Chords and lyrics')).toBeFocused();
  expect(await page.getByLabel('Chords and lyrics').evaluate((element: HTMLTextAreaElement) => element.value.slice(element.selectionStart, element.selectionEnd))).toBe('[H7]');
});

test('local draft restores source and transposition after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('Dm | G7 | Cmaj7');
  await expect(page.getByRole('button', { name: 'Dm, occurrence 1', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Transpose up one semitone' }).click();
  await expect(page.getByText('Saved on this browser', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Restore draft' }).click();
  await expect(page.getByLabel('Chords and lyrics')).toHaveValue('Dm | G7 | Cmaj7');
  await expect(page.getByRole('button', { name: 'D#m, occurrence 1', exact: true })).toBeVisible();
});

test('320px mobile retains selection across Chart and Learn without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('C | Am | F | G');
  await page.getByRole('button', { name: 'Am, occurrence 2', exact: true }).click();
  await page.getByRole('button', { name: 'Learn · Am', exact: true }).click();
  await expect(page.getByText('A minor', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to chart' }).click();
  await expect(page.getByRole('button', { name: 'Am, occurrence 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-chart.png', fullPage: true });
});

test('storage failure stays editable and reports unsaved status', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get() { throw new Error('Storage denied'); } }); });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Local storage could not be read');
  await page.getByLabel('Chords and lyrics').fill('C | Am');
  await expect(page.getByRole('button', { name: 'Am, occurrence 2', exact: true })).toBeEnabled();
  await expect(page.getByText('Local save unavailable', { exact: true })).toBeVisible();
});

test('keyboard selection works and imported-looking markup is only text', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('[C]<img src=x onerror=alert(1)> [Am]Still a lyric');
  const am = page.getByRole('button', { name: 'Am, occurrence 2', exact: true });
  await expect(am).toBeEnabled();
  await am.focus();
  await page.keyboard.press('Enter');
  await expect(am).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.chart-scroll img')).toHaveCount(0);
  await expect(page.locator('.chart-scroll')).toContainText('<img src=x onerror=alert(1)>');
});

test('desktop shell and long chart remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Inside the chord' })).toBeVisible();
  await page.screenshot({ path: 'test-results/desktop-workbench.png', fullPage: true });
  const started = Date.now();
  await page.getByLabel('Chords and lyrics').fill(Array.from({ length: 50 }, () => 'C | Am | F | G').join('\n'));
  await expect(page.getByRole('button', { name: 'G, occurrence 200', exact: true })).toBeEnabled();
  console.log(`200-occurrence edit-to-render: ${Date.now() - started} ms (includes 180ms debounce and browser automation)`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
