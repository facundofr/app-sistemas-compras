import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de punta a punta: levantan la app contra una base aparte (pedidos_e2e) y la usan como una persona.
 *   npm run test:e2e
 * En CI la app se compila antes y se sirve con el servidor standalone; en local se usa `next dev`.
 */
const PUERTO = 3100;
export const BASE_URL = `http://localhost:${PUERTO}/asistente-sistemas/`;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://pedidos:pedidos@localhost:5433/pedidos_e2e";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    // En local se puede usar el Chrome instalado en vez de descargar el de Playwright: E2E_CHANNEL=chrome.
    channel: process.env.E2E_CHANNEL || undefined,
  },
  projects: [
    { name: "preparar", testMatch: /preparar\.setup\.ts/ },
    { name: "escritorio", use: { ...devices["Desktop Chrome"] }, dependencies: ["preparar"], testIgnore: /movil/ },
    { name: "movil", use: { ...devices["Pixel 7"] }, dependencies: ["preparar"], testMatch: /movil\.spec\.ts/ },
  ],
  webServer: {
    // En CI, el mismo servidor standalone que corre en Docker (necesita public/ y .next/static al lado).
    command: process.env.CI
      ? `cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/ && PORT=${PUERTO} node .next/standalone/server.js`
      : `npx next dev -p ${PUERTO}`,
    url: `${BASE_URL}api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL,
      ADMIN_EMAIL: "admin@e2e.local",
      ADMIN_PASSWORD: "prueba1234",
      ADMIN_NOMBRE: "Admin E2E",
      COOKIE_SECURE: "false",
    },
  },
});
