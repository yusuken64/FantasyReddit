import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests', workers: 1, timeout: 20000,
  outputDir: './test-results',
  use: { baseURL: 'http://127.0.0.1:18189', headless: true, trace: 'retain-on-failure' },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 18189 --strictPort', url: 'http://127.0.0.1:18189', reuseExistingServer: false },
})
