import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      // Pixel 7 emulation, held in landscape like James will hold it.
      name: 'pixel-7',
      use: { ...devices['Pixel 7'], viewport: { width: 915, height: 412 } },
    },
  ],
  webServer: {
    // Production build with the test hook (window.__jbc) compiled in.
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_DEBUG_HOOK: '1' },
  },
});
