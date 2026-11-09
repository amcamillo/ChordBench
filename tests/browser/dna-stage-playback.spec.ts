import { test, expect } from '@playwright/test';

test('Song DNA playback controls operate the shared chart transport', async ({ page }) => {
  await page.goto('/');
  const controls = page.getByRole('group', { name: 'Song DNA playback controls' });
  await controls.getByRole('button', { name: 'Play chart from Song DNA' }).click();
  await expect(page.getByRole('button', { name: 'Pause chart', exact: true })).toBeVisible();
  await controls.getByRole('button', { name: 'Pause chart from Song DNA' }).click();
  await expect(page.getByRole('button', { name: 'Resume chart', exact: true })).toBeVisible();
  await controls.getByRole('button', { name: 'Resume chart from Song DNA' }).click();
  await controls.getByRole('button', { name: 'Stop chart from Song DNA' }).click();
  await expect(page.getByRole('button', { name: 'Play chart', exact: true })).toBeVisible();
  await page.getByText('Chart playback', { exact: true }).click();
  await expect(controls).toBeHidden();
});
