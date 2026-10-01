import { expect, type Page, test } from "@playwright/test";

/** Junta errores de consola (incluidos avisos de hidratación), de página y respuestas HTTP ≥ 400. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || /hydrat/i.test(msg.text())) errors.push(`consola: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`página: ${err.message}`));
  page.on("response", (res) => {
    if (res.status() >= 400) errors.push(`HTTP ${res.status()}: ${res.url()}`);
  });
  return errors;
}

/** Tab hasta que el foco quede en un enlace con ese href (máximo `limit` pasos). */
async function tabTo(page: Page, href: string, limit = 80): Promise<void> {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    const current = await page.evaluate(() => document.activeElement?.getAttribute("href"));
    if (current === href) return;
  }
  throw new Error(`no llegué con Tab a ${href}`);
}

const noHorizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test("1 · el inicio: plan 2020, HUD del perfil, teclado y movimiento reducido", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Tu carrera");
  await expect(page.locator("[data-has-content]")).toHaveCount(45);
  await expect(page.locator('[data-has-content="true"]')).toHaveCount(2);

  // El HUD lee el perfil de IndexedDB (recién creado: nivel 1, 0 XP, racha en 0).
  const hud = page.getByRole("banner");
  await expect(hud.getByLabel("Nivel 1")).toBeVisible();
  await expect(hud.getByText("0 XP")).toBeVisible();
  await expect(hud.getByLabel("Racha: empieza hoy")).toBeVisible();
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))).toContain("cortex");

  // Teclado primero: el primer Tab va al salto al contenido y el foco se ve.
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeFocused();
  expect(await skip.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");

  // Movimiento reducido: los objetos arcade no animan.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await page.locator(".arcade").first().evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
  expect(duration).toBeLessThanOrEqual(0.001);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // Recorrido solo con teclado: inicio → materia → lección.
  await page.goto("/");
  await tabTo(page, "/materias/calculo");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/materias\/calculo$/);
  await tabTo(page, "/materias/calculo/01-limites");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Límites: acercarse sin llegar" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("2 · una lección carga con fórmulas y tablas", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/materias/calculo/01-limites");
  await expect(page.getByRole("heading", { level: 1, name: "Límites: acercarse sin llegar" })).toBeVisible();
  expect(await page.locator(".katex").count()).toBeGreaterThan(10);
  await expect(page.locator(".katex-error")).toHaveCount(0);
  await expect(page.locator("article table")).toHaveCount(1);
  await expect(page.locator(".lesson-blank")).toHaveCount(2);
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => document.fonts.check("16px KaTeX_Main"))).toBe(true);
  expect(errors).toEqual([]);
});

test("3 · en un celular no hay desborde horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const url of ["/", "/materias/calculo", "/materias/calculo/01-limites", "/materias/programacion/01-variables-y-tipos"]) {
    await page.goto(url);
    expect(await noHorizontalOverflow(page), url).toBeLessThanOrEqual(0);
  }
});
