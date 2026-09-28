import { defineConfig, devices } from '@playwright/test'

/**
 * En CI, `VITE_BASE_PATH` se fija al mismo valor que usa el job `deploy`
 * (`/investing-helper/`, ver `.github/workflows/ci.yml`): si el preview sirve
 * en `/` y el deploy real en `/investing-helper/`, los tests pasan aqui y
 * rompen en GitHub Pages. En local, sin la variable, cae a `/` como
 * `vite.config.ts`.
 */
const rawBasePath = process.env.VITE_BASE_PATH ?? '/'
const basePath = rawBasePath.endsWith('/') ? rawBasePath : `${rawBasePath}/`
const baseURL = `http://localhost:4173${basePath}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // El mismo build que produccion, servido tal cual lo serviria Pages.
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
