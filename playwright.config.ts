import { defineConfig, devices } from "@playwright/test";

// Opcional: ruta a un Chromium ya instalado (p. ej. en un contenedor sin acceso al CDN de Playwright).
const chromiumPath = process.env.CORTEX_CHROMIUM_PATH;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    // Puerto distinto al de `pnpm dev`: es otro origen, así que no toca tus datos reales.
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
      },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start:e2e",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
