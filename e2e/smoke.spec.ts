import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("1 - el inicio: plan 2020, HUD del perfil, teclado y movimiento reducido", async ({ page }) => {
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

test("2 - una lección carga con fórmulas y tablas", async ({ page }) => {
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

test("3 - en un celular no hay desborde horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const url of ["/", "/materias/calculo", "/materias/calculo/01-limites", "/materias/programacion/01-variables-y-tipos", "/ajustes", "/estilo"]) {
    await page.goto(url);
    expect(await noHorizontalOverflow(page), url).toBeLessThanOrEqual(0);
  }
});

test("4 - respaldo: exportar, borrar, importar con confirmación y rechazar uno del futuro", async ({ page }) => {
  // Carpeta temporal con ruta ASCII: setInputFiles no carga archivos de rutas con "·" u otros símbolos.
  const dir = mkdtempSync(join(tmpdir(), "cortex-e2e-"));
  const errors = collectErrors(page);
  await page.goto("/ajustes");
  const sound = page.getByRole("switch", { name: "Sonido" });
  await expect(sound).toBeEnabled();
  await expect(sound).toHaveAttribute("aria-checked", "false"); // apagado por defecto
  await sound.click();
  await expect(sound).toHaveAttribute("aria-checked", "true");

  // Exportar
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar respaldo" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^cortex-\d{4}-\d{2}-\d{2}\.cortex-backup\.json$/);
  const file = join(dir, "respaldo.json");
  await download.saveAs(file);
  const backup = JSON.parse(readFileSync(file, "utf8")) as {
    app: string;
    format: number;
    schemaVersion: number;
    tables: { profile: { preferences: { sound: boolean } }[] };
  };
  expect([backup.app, backup.format, backup.schemaVersion]).toEqual(["cortex", 1, 1]);
  expect(backup.tables.profile[0]?.preferences.sound).toBe(true);
  await expect(page.getByRole("status").filter({ hasText: "Respaldo descargado" })).toBeVisible();

  // Borrar la base (Dexie cierra su conexión ante versionchange) y recargar: datos de fábrica.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase("cortex");
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
  );
  await page.reload();
  await expect(sound).toBeEnabled();
  await expect(sound).toHaveAttribute("aria-checked", "false");

  // Importar: resumen → diálogo con foco en Cancelar → Esc no cambia nada → confirmar.
  await expect(page.getByLabel("Importar respaldo")).toBeEnabled();
  await page.getByLabel("Importar respaldo").setInputFiles(file);
  await expect(page.getByRole("heading", { name: "respaldo.json" })).toBeVisible();
  const replace = page.getByRole("button", { name: "Reemplazar mis datos con este respaldo" });
  await replace.click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(sound).toHaveAttribute("aria-checked", "false");
  await replace.click();
  await page.getByRole("button", { name: "Sí, reemplazar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "tus datos se restauraron" })).toBeVisible();
  await expect(sound).toHaveAttribute("aria-checked", "true");

  // Un respaldo de una versión más nueva se rechaza y no toca nada.
  const future = join(dir, "futuro.json");
  writeFileSync(future, JSON.stringify({ ...backup, schemaVersion: 2 }));
  await page.getByLabel("Importar respaldo").setInputFiles(future);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("versión más nueva");
  await expect(replace).toBeHidden();
  await expect(sound).toHaveAttribute("aria-checked", "true");

  rmSync(dir, { recursive: true, force: true });
  expect(errors).toEqual([]);
});
