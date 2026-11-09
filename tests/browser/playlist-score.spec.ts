import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('playlist imports several charts, preserves settings, reorders, removes, restores and survives reload', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/');
  await page.getByText('Playlist · 0 songs', { exact: true }).click();
  const file = page.getByLabel('Load chart files or a playlist backup');
  await file.setInputFiles([
    { name: 'first.pro', mimeType: 'text/plain', buffer: Buffer.from('{title: First song}\nC | Am | F | G') },
    { name: 'second.pro', mimeType: 'text/plain', buffer: Buffer.from('{title: Second song}\nDm | G7 | Cmaj7') },
  ]);
  await page.getByRole('button', { name: 'Add files to playlist' }).click();
  await page.getByRole('button', { name: 'Load First song', exact: true }).click();
  await page.getByLabel('Chart tempo in beats per minute').fill('112');
  await page.getByRole('button', { name: 'Transpose up one semitone' }).click();
  await page.getByRole('button', { name: 'Load Second song', exact: true }).click();
  await expect(page.getByLabel('Chart tempo in beats per minute')).toHaveValue('90');
  await page.getByRole('button', { name: 'Move Second song up' }).click();
  await page.getByRole('button', { name: 'Remove First song' }).click();
  await page.getByRole('button', { name: 'Undo removal of First song' }).click();
  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByLabel('Playlist song').selectOption({ label: '2. First song' });
  await expect(page.locator('.session-chord strong')).toHaveText('C#');
  await expect(page.locator('.session-transport')).toContainText('112 BPM');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByLabel('Playlist song').selectOption({ label: '1. Second song' });
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.locator('.session-chord strong')).toHaveText('Dm');
  await page.getByRole('button', { name: 'Setup', exact: true }).click();
  await page.getByText('Playlist · 2 songs', { exact: true }).click();
  await expect(page.getByText('Playlist saved on this browser', { exact: true })).toBeVisible();
  await expect(page.locator('.local-status')).toContainText('Saved on this browser');
  await page.reload();
  await page.getByRole('button', { name: 'Keep current chart' }).click();
  await page.getByText('Playlist · 2 songs', { exact: true }).click();
  await page.getByRole('button', { name: 'Load First song', exact: true }).click();
  await expect(page.getByLabel('Chart tempo in beats per minute')).toHaveValue('112');
  await expect(page.getByRole('button', { name: 'C#, occurrence 1', exact: true })).toBeVisible();
});

test('playlist backup validates before adding and current chart edits stay associated with the saved song', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Playlist · 0 songs', { exact: true }).click();
  await page.getByLabel('Song title', { exact: true }).fill('My chart');
  await page.getByRole('button', { name: 'Add current chart' }).click();
  await page.getByLabel('Chords and lyrics').fill('Dm | G7');
  await expect(page.getByRole('button', { name: 'Dm, occurrence 1', exact: true })).toBeVisible();
  await page.getByLabel('Song title', { exact: true }).fill('Other');
  await page.getByRole('button', { name: 'Add current chart' }).click();
  await page.getByLabel('Chords and lyrics').fill('F | G');
  await expect(page.getByRole('button', { name: 'F, occurrence 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Load My chart' }).click();
  await expect(page.getByLabel('Chords and lyrics')).toHaveValue('Dm | G7');
  await page.getByLabel('Load chart files or a playlist backup').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":99,"songs":[]}') });
  await expect(page.getByRole('alert')).toContainText('Unsupported playlist');
  await expect(page.locator('.playlist-songs li')).toHaveCount(2);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download playlist' }).click();
  const download = await downloadEvent;
  const path = await download.path();
  await page.getByLabel('Load chart files or a playlist backup').setInputFiles({ name: 'playlist.json', mimeType: 'application/json', buffer: await readFile(path!) });
  await page.getByRole('button', { name: 'Add files to playlist' }).click();
  await expect(page.locator('.playlist-songs li')).toHaveCount(4);
});

test('score preview and guided playback sound the exact displayed voicings', async ({ page }) => {
  await page.addInitScript(() => {
    const recorded: number[] = [];
    (window as unknown as { scoreFrequencies: number[] }).scoreFrequencies = recorded;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const osc = create.call(this), set = osc.frequency.setValueAtTime.bind(osc.frequency);
      osc.frequency.setValueAtTime = (value, time) => { recorded.push(value); return set(value, time); };
      return osc;
    };
  });
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('C | Am | F');
  await expect(page.getByRole('button', { name: 'Am, occurrence 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Song DNA', exact: true }).click();
  await page.getByRole('button', { name: 'Hear change', exact: true }).click();
  await expect(page.locator('.score-status')).toContainText('Current voicing, then next voicing');
  const pitches = await page.evaluate(() => (window as unknown as { scoreFrequencies: number[] }).scoreFrequencies.map(hz => Math.round(69 + 12 * Math.log2(hz / 440))));
  expect(pitches).toEqual([60, 64, 67, 60, 64, 69]);
  await page.getByRole('button', { name: 'Score options', exact: true }).click();
  await page.getByLabel('Next chord voicing').selectOption({ index: 1 });
  const target = await page.locator('.score-staff').getAttribute('aria-label');
  await page.getByLabel('Use these voicings for piano chart playback').check();
  await page.getByRole('button', { name: 'Close options', exact: true }).click();
  await page.getByRole('button', { name: 'Hear change', exact: true }).click();
  const alternative = await page.evaluate(() => (window as unknown as { scoreFrequencies: number[] }).scoreFrequencies.slice(-3));
  const targetNames = target!.split('next Am ')[1].split(', ');
  await page.locator('.score-chords button').nth(1).click();
  await expect(page.getByLabel('Piano chord notes').getByRole('button')).toHaveText(targetNames);
  await expect(page.getByText('Suggested voicing from Song DNA')).toBeVisible();
  await page.getByLabel('Chart tempo in beats per minute').fill('240');
  await page.evaluate(() => { (window as unknown as { scoreFrequencies: number[] }).scoreFrequencies.length = 0; });
  await page.getByRole('button', { name: 'Play chart', exact: true }).click();
  await expect(page.locator('.score-chords button').first()).toContainText('Am', { timeout: 4000 });
  await page.getByRole('button', { name: 'Stop chart', exact: true }).click();
  const played = await page.evaluate(() => (window as unknown as { scoreFrequencies: number[] }).scoreFrequencies);
  expect(played.slice(3, 6)).toEqual(alternative);
  expect(target).toContain('next Am');
});

test('phone score stays compact and explains notation in an accessible dialog', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await page.getByRole('navigation', { name: 'Session views' }).getByRole('button', { name: 'Song DNA', exact: true }).click();
  await expect(page.locator('.score-movement')).toContainText('Keep C4, E4');
  const box = (await page.getByRole('button', { name: 'Hear change', exact: true }).boundingBox())!;
  expect(box.y + box.height).toBeLessThan(620);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.screenshot({ path: 'test-results/playlist-score-phone.png' });
  await page.getByRole('button', { name: 'Score options', exact: true }).click();
  await page.getByRole('button', { name: 'Read the score', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Hollow, stemless noteheads are whole notes');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('importing a replacement chart does not overwrite the loaded playlist song', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Playlist · 0 songs', { exact: true }).click();
  await page.getByLabel('Song title', { exact: true }).fill('Kept');
  await page.getByRole('button', { name: 'Add current chart' }).click();
  await page.getByText('Find or import a chart').click();
  await page.getByLabel('Choose a chart file').setInputFiles({ name: 'replacement.txt', mimeType: 'text/plain', buffer: Buffer.from('Dm | G7') });
  await page.getByRole('button', { name: 'Import and replace chart' }).click();
  await expect(page.getByLabel('Chords and lyrics')).toHaveValue('Dm | G7');
  await page.getByRole('button', { name: 'Load Kept' }).click();
  await expect(page.getByLabel('Chords and lyrics')).toContainText('Find a little room');
});

test('session instrument and header follow playback together; browsing stops playback', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/');
  await page.getByLabel('Chart tempo in beats per minute').fill('240');
  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByRole('button', { name: 'Instrument', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.session-chord strong')).toHaveText('Am', { timeout: 5000 });
  await expect(page.locator('.session-piano .instrument-heading p')).toHaveText('Hear Am on an instrument');
  await page.getByRole('button', { name: 'Next session chord' }).click();
  await expect(page.locator('.session-chord strong')).toHaveText('F');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});

test('fresh desktop opens the new score and retains the spatial view as an option', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Song DNA', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Song DNA score' })).toBeVisible();
  await page.getByRole('button', { name: 'Spatial DNA', exact: true }).click();
  await expect(page.locator('.time-canvas')).toBeVisible();
  await context.close();
});

test('unavailable playlist storage does not block chart editing or overwrite data', async ({ page }) => {
  await page.addInitScript(() => {
    const original = indexedDB.open.bind(indexedDB);
    indexedDB.open = (name, version) => name === 'chordbench-playlist' ? original(name, 0) : original(name, version);
  });
  await page.goto('/');
  await page.getByText('Playlist · 0 songs', { exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Playlist could not be read');
  await expect(page.getByRole('button', { name: 'Add current chart' })).toBeDisabled();
  await page.getByLabel('Chords and lyrics').fill('C | F');
  await expect(page.getByRole('button', { name: 'F, occurrence 2', exact: true })).toBeVisible();
});

test('changing a voicing during playback keeps the playing chord in focus', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chords and lyrics').fill('C | Am | F');
  await expect(page.getByRole('button', { name: 'Am, occurrence 2', exact: true })).toBeVisible();
  await page.getByLabel('Chart tempo in beats per minute').fill('120');
  await page.getByRole('button', { name: 'Song DNA', exact: true }).click();
  await page.getByRole('button', { name: 'Play chart', exact: true }).click();
  await expect(page.locator('.score-chords button').first()).toContainText('Am', { timeout: 5000 });
  await page.getByRole('button', { name: 'Score options' }).click();
  await page.getByLabel('Next chord voicing').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Close options' }).click();
  await expect(page.locator('.score-chords button').first()).toContainText('Am');
  await expect(page.getByRole('button', { name: 'Play chart', exact: true })).toBeVisible();
});
