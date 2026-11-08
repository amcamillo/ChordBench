import { test, expect } from '@playwright/test';

test('search handoff, local preview, cancellation and explicit chart import', async ({ page }) => {
  const remoteRequests: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:')) remoteRequests.push(request.url()); });
  await page.goto('/');
  const source = '{title: Test Song}\n{comment: C | G}\n[C]First [G]second\n';
  const editor = page.getByLabel('Chords and lyrics');
  const original = await editor.inputValue();
  await page.getByText('Find or import a chart').click();
  const link = page.getByRole('link', { name: /Search OzBcoz charts/ });
  await expect(link).toHaveAttribute('href', 'https://www.ozbcoz.com/Songs/cp/index.php');
  await expect(link).toHaveAttribute('target', '_blank');
  const file = page.getByLabel('Choose a chart file');
  await file.setInputFiles({ name: 'example.pro', mimeType: 'text/plain', buffer: Buffer.from(source) });
  await expect(page.getByRole('heading', { name: 'Preview: Test Song' })).toBeVisible();
  await expect(page.getByText('2 chord occurrences recognised.')).toBeVisible();
  await expect(page.getByText('Filtered out 2 metadata, comment or standalone link lines.')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Keep original metadata and links' }).check();
  await expect(page.getByText('Keeping 2 metadata, comment or standalone link lines.')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Keep original metadata and links' }).uncheck();
  await expect(editor).toHaveValue(original);
  await page.getByRole('button', { name: 'Cancel import' }).click();
  await expect(editor).toHaveValue(original);
  await file.setInputFiles({ name: 'example.pro', mimeType: 'text/plain', buffer: Buffer.from(source) });
  await page.getByRole('button', { name: 'Import and replace chart' }).click();
  await expect(editor).toHaveValue('[C]First [G]second\n');
  await expect(page.getByRole('button', { name: 'C, occurrence 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'G, occurrence 2', exact: true })).toBeVisible();
  await expect(page.getByText('2 chord occurrences', { exact: true })).toBeVisible();
  expect(remoteRequests).toEqual([]);
});

test('invalid files do not replace current chart', async ({ page }) => {
  await page.goto('/');
  const editor = page.getByLabel('Chords and lyrics');
  const original = await editor.inputValue();
  await page.getByText('Find or import a chart').click();
  await page.getByLabel('Choose a chart file').setInputFiles({ name: 'bad.pro', mimeType: 'text/plain', buffer: Buffer.from([255, 0]) });
  await expect(page.getByRole('alert')).toContainText('not valid UTF-8');
  await expect(editor).toHaveValue(original);
  await expect(page.getByRole('button', { name: 'Import and replace chart' })).toHaveCount(0);
});

test('saved draft must be resolved before import replaces the editor', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Saved on this browser', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Restore draft' })).toBeVisible();
  await page.getByText('Find or import a chart').click();
  await page.getByLabel('Choose a chart file').setInputFiles({ name: 'song.pro', mimeType: 'text/plain', buffer: Buffer.from('[C]Our words') });
  await expect(page.getByRole('button', { name: 'Import and replace chart' })).toBeDisabled();
  await page.getByRole('button', { name: 'Restore draft' }).click();
  await expect(page.getByRole('button', { name: 'Import and replace chart' })).toBeEnabled();
});
