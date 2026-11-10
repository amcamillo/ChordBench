import { test, expect } from '@playwright/test';

test('release video is linked from setup, plays locally, and has a Portuguese label', async ({ page, request }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Watch release video (opens in a new tab)' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  const url = await link.evaluate((element: HTMLAnchorElement) => element.href);
  expect(new URL(url).pathname.endsWith('/media/ChordWorkbench-v0.1-release.mp4')).toBe(true);
  const response = await request.get(url, { headers: { Range: 'bytes=0-31' } });
  expect([200, 206]).toContain(response.status());
  expect(response.headers()['content-type']).toContain('video/mp4');
  expect((await response.body()).subarray(4, 8).toString('ascii')).toBe('ftyp');
  const metadata = await page.evaluate(async videoUrl => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    return await new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Video metadata timed out')), 10000);
      video.onloadedmetadata = () => { clearTimeout(timeout); resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight }); };
      video.onerror = () => { clearTimeout(timeout); reject(new Error('Video failed to load')); };
      video.src = videoUrl;
    });
  }, url);
  expect(metadata.duration).toBeGreaterThan(0);
  expect(metadata.width).toBeGreaterThan(0);
  expect(metadata.height).toBeGreaterThan(0);
  await page.getByLabel('Language / Idioma').selectOption('pt-BR');
  await expect(page.getByRole('link', { name: 'Assistir ao vídeo de lançamento (abre em uma nova aba)' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
