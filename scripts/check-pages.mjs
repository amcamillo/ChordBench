// Local smoke check of the production build at a GitHub Pages-style subpath.
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve('dist');
const prefix = '/ChordBench/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (!pathname.startsWith(prefix)) { response.writeHead(404).end(); return; }
  const path = resolve(root, pathname.slice(prefix.length) || 'index.html');
  if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try {
    const content = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' }).end(content);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
let browser;
try {
  const port = server.address().port;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  await page.goto(`http://127.0.0.1:${port}${prefix}`, { waitUntil: 'networkidle' });
  await page.locator('.time-canvas[data-renderer="webgl"]').waitFor();
  await page.getByRole('button', { name: 'Score view', exact: true }).click();
  await page.getByRole('region', { name: 'Song DNA score' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  if (!await page.evaluate(() => document.fonts.check('400 16px Inter'))) failures.push('Inter font did not load');
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/pages-subpath.png', fullPage: true });
  if (failures.length) throw new Error(failures.join('\n'));
  const mobile = await browser.newPage({ viewport: { width: 375, height: 740 }, hasTouch: true });
  mobile.on('pageerror', error => failures.push(error.message));
  await mobile.goto(`http://127.0.0.1:${port}${prefix}`, { waitUntil: 'networkidle' });
  await mobile.getByRole('navigation', { name: 'Session views' }).getByRole('button', { name: 'Song DNA' }).click();
  await mobile.locator('.time-canvas[data-renderer="webgl"]').waitFor();
  await mobile.getByRole('navigation', { name: 'Song DNA display' }).getByRole('button', { name: 'Score', exact: true }).click();
  await mobile.getByRole('region', { name: 'Song DNA score' }).waitFor();
  if (await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight)) failures.push('Mobile session exceeds the viewport');
  if (failures.length) throw new Error(failures.join('\n'));
  console.log('Production site loaded under /ChordBench/: staff score, WebGL view, local fonts and mobile session.');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
