const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({ testDir: './tests', testMatch: '*.spec.cjs', workers: 1, timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:18088', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node tests/browser-server.cjs', url: 'http://127.0.0.1:18088/api/health/live', reuseExistingServer: false, timeout: 60000, gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 } },
});
