import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.ts',
  timeout: 90000,
  retries: process.env.CI ? 1 : 0, // en la integración continua un fallo se repite una vez (los equipos compartidos van lentos)
  use: { launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } },
});
