import { test, expect } from '@playwright/test';
import { noteColor } from '../../src/domain/harmony/noteColor.ts';

test.use({ hasTouch: true, storageState: { cookies: [], origins: [] } });
for (const [width, height] of [[320, 667], [375, 740], [812, 375], [820, 1180]]) {
  test(`rail names stay beside their lines inside the 3D canvas at ${width}x${height} and follow the camera`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Session views' }).getByRole('button', { name: 'Song DNA' }).tap();
    const canvas = page.locator('.session-dna .time-canvas');
    await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
    const colors = JSON.parse((await canvas.getAttribute('data-note-colors'))!);
    for (const midi of [60, 64, 67]) expect(colors.find((n: {midi: number}) => n.midi === midi)?.color).toBe(noteColor(midi));
    expect(new Set(colors.map((n: {color: string}) => n.color)).size).toBeGreaterThan(1);
    const toggle = page.getByRole('button', { name: 'Label note lines' });
    await toggle.tap();
    await expect(page.getByRole('button', { name: 'Hide note lines' })).toHaveAttribute('aria-pressed', 'true');
    const key = page.getByRole('list', { name: 'Pitch-class rail labels' });
    await expect(key.getByRole('listitem')).toHaveCount(12);
    await expect(key.getByRole('listitem').filter({ hasText: /^C$/ })).toBeVisible(); await expect(key.getByRole('listitem').filter({ hasText: /^E$/ })).toBeVisible();
    const graph = (await canvas.boundingBox())!, labels = (await key.boundingBox())!;
    expect(labels.x).toBeCloseTo(graph.x, 0);
    expect(labels.width).toBeCloseTo(graph.width, 0);
    for (const label of await key.getByRole('listitem').all()) {
      const box = (await label.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(graph.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(graph.x + graph.width + 1);
      expect(box.y).toBeGreaterThanOrEqual(graph.y - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(graph.y + graph.height + 1);
    }
    const cLabel = key.locator('[data-pitch="0"]');
    const first = await cLabel.getAttribute('style');
    await page.getByRole('button', { name: '3D options' }).tap();
    await page.getByLabel('Session 3D view tilt').fill('-0.5');
    await page.getByRole('button', { name: 'Close', exact: true }).tap();
    await expect.poll(() => cLabel.getAttribute('style')).not.toBe(first);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 375 || width === 820) await page.screenshot({ path: `test-results/rail-labels-${width}.png` });
    await page.getByRole('button', { name: 'Hide note lines' }).tap();
    await expect(key).toHaveCount(0);
  });
}
