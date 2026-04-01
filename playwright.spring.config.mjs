import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'ui-tests/e2e',
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    headless: true
  },
  webServer: {
    command: '.\\gradlew.bat bootRun',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: true,
    timeout: 180_000
  }
});
