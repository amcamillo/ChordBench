import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', channel: 'msedge', trace: 'retain-on-failure', storageState: { cookies: [], origins: [{ origin: 'http://127.0.0.1:5174', localStorage: [{ name: 'chordbench-session', value: 'false' }, { name: 'chordbench-dna-view', value: 'spatial' }] }] } },
  globalSetup: './tests/browser/setup.ts',
});
