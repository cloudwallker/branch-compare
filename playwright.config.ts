import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  reporter: 'line',
  use: { channel: process.env.BRANCH_COMPARE_BROWSER || undefined, headless: true },
});
