import { expect, type Page, test } from "@playwright/test";

/** Junta errores de consola, de página y respuestas HTTP ≥ 400 (p. ej. una fuente de KaTeX que no carga). */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`consola: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`página: ${err.message}`));
  page.on("response", (res) => {
    if (res.status() >= 400) errors.push(`HTTP ${res.status()}: ${res.url()}`);
  });
  return errors;
}

test("1 · el inicio carga sin errores", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Cortex" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("2 · una lección carga con fórmulas y tablas", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/materias/calculo/01-limites");
  await expect(page.getByRole("heading", { level: 1, name: "Límites: acercarse sin llegar" })).toBeVisible();
  expect(await page.locator(".katex").count()).toBeGreaterThan(10);
  await expect(page.locator(".katex-error")).toHaveCount(0);
  await expect(page.locator("table")).toHaveCount(1);
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => document.fonts.check("16px KaTeX_Main"))).toBe(true);
  expect(errors).toEqual([]);
});
