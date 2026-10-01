import { expect, test } from "@playwright/test";

test("el inicio carga sin errores", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`consola: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`página: ${err.message}`));
  page.on("response", (res) => {
    if (res.status() >= 400) errors.push(`HTTP ${res.status()}: ${res.url()}`);
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Cortex" })).toBeVisible();
  expect(errors).toEqual([]);
});
