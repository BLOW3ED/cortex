import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";

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

/** Tab hasta que el foco quede en `target`. */
async function tabUntilFocused(page: Page, target: Locator, limit = 60): Promise<void> {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("no llegué con Tab al elemento");
}

const outlineOf = (target: Locator) => target.evaluate((el) => getComputedStyle(el).outlineStyle);

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
  await expect(hud.getByRole("img", { name: "Nivel 1" })).toBeVisible();
  await expect(hud.getByText("0 XP")).toBeVisible();
  await expect(hud.getByRole("img", { name: "Racha: empieza hoy" })).toBeVisible();
  // El prefijo decorativo "// " de las etiquetas no entra en los nombres accesibles.
  await expect(page.getByRole("heading", { level: 2, name: /^Mapa del plan/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^\/\// })).toHaveCount(0);
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
  // Desde la Fase 1, <Desvanecido> es interactivo: un campo por hueco.
  await expect(page.getByRole("textbox", { name: /^Hueco \d+$/ })).toHaveCount(2);
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => document.fonts.check("16px KaTeX_Main"))).toBe(true);
  expect(errors).toEqual([]);
});

/** Escribe valores en el perfil directo en IndexedDB (misma versión: no dispara `versionchange`). */
async function setProfile(page: Page, values: Record<string, number | string>): Promise<void> {
  await page.evaluate(
    (v) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("cortex", 20);
        req.onsuccess = () => {
          const tx = req.result.transaction("profile", "readwrite");
          const store = tx.objectStore("profile");
          const get = store.get(1);
          get.onsuccess = () => store.put({ ...get.result, ...v });
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    values,
  );
}

/** Cuánto se mete el HUD en el margen derecho del header (0 = respeta el margen). */
const hudIntrusion = (page: Page) =>
  page.evaluate(() => {
    const row = document.querySelector("header > div");
    const hud = row?.lastElementChild;
    if (!row || !hud) return Number.NaN;
    const padding = parseFloat(getComputedStyle(row).paddingRight);
    return hud.getBoundingClientRect().right - (row.getBoundingClientRect().right - padding);
  });

test("3 - en un celular no hay desborde horizontal (320 y 375 px)", async ({ page }) => {
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 800 });
    for (const url of ["/", "/materias/calculo", "/materias/calculo/01-limites", "/materias/programacion/01-variables-y-tipos", "/ajustes", "/estilo"]) {
      await page.goto(url);
      expect(await noHorizontalOverflow(page), `${url} a ${width} px`).toBeLessThanOrEqual(0);
    }
  }

  // El HUD cabe en su margen aun con números grandes, en el ancho mínimo y donde aparece la barra de XP.
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("img", { name: "Nivel 1" })).toBeVisible();
  // Desde la Fase 1 el HUD calcula el nivel con el XP y la racha visible con el último día de estudio.
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  for (const [profile, label, widths] of [
    [{ xpTotal: 0, currentStreak: 0 }, /^Nivel 1$/, [320, 640, 768]],
    [{ xpTotal: 4_000_000, currentStreak: 1240, maxStreak: 1240, lastStudyDay: today }, /^Nivel \d{3}$/, [320, 375, 640, 768, 1024]],
  ] as const) {
    await setProfile(page, profile);
    await page.reload();
    await expect(page.getByRole("banner").getByRole("img", { name: label })).toBeVisible();
    const level = (await page.getByRole("banner").getByRole("img", { name: label }).getAttribute("aria-label")) ?? "";
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      expect(await noHorizontalOverflow(page), `${level} a ${width} px`).toBeLessThanOrEqual(0);
      expect(await hudIntrusion(page), `HUD con ${level} a ${width} px`).toBeLessThanOrEqual(0.5);
    }
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

  // Con teclado, el switch y los botones muestran el foco.
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await tabUntilFocused(page, sound);
  expect(await outlineOf(sound)).not.toBe("none");
  const downloadButton = page.getByRole("button", { name: "Descargar respaldo" });
  await tabUntilFocused(page, downloadButton);
  expect(await outlineOf(downloadButton)).not.toBe("none");

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
  expect([backup.app, backup.format, backup.schemaVersion]).toEqual(["cortex", 1, 2]);
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

  // Importar en un celular chico, solo con teclado: resumen → diálogo con foco en Cancelar →
  // Esc no cambia nada → confirmar. Nada se sale de la pantalla.
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.getByLabel("Importar respaldo")).toBeEnabled();
  await page.getByLabel("Importar respaldo").setInputFiles(file);
  await expect(page.getByRole("heading", { name: "respaldo.json" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Respaldo listo para revisar");
  expect(await noHorizontalOverflow(page), "resumen del respaldo").toBeLessThanOrEqual(0);
  const replace = page.getByRole("button", { name: "Reemplazar mis datos con este respaldo" });
  await tabUntilFocused(page, replace);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  const cancel = page.getByRole("button", { name: "Cancelar" });
  await expect(cancel).toBeFocused();
  expect(await outlineOf(cancel)).not.toBe("none");
  const box = await dialog.boundingBox();
  for (const button of await dialog.getByRole("button").all()) {
    const b = await button.boundingBox();
    expect(b && box && b.x + b.width <= box.x + box.width + 0.5, await button.innerText()).toBe(true);
  }
  // Descargar desde el diálogo deja el resultado a la vista dentro del diálogo.
  await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Descargar mis datos actuales primero" }).click()]);
  await expect(dialog.getByRole("status")).toContainText("Respaldo descargado");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(replace).toBeFocused();
  await expect(sound).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("Enter");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Sí, reemplazar" })).toBeFocused();
  await page.keyboard.press("Enter");
  const restored = page.getByRole("status").filter({ hasText: "tus datos se restauraron" });
  await expect(restored).toBeVisible();
  await expect(restored).toBeFocused(); // el foco no se pierde al desaparecer el resumen
  await expect(sound).toHaveAttribute("aria-checked", "true");

  // Un respaldo de una versión más nueva se rechaza y no toca nada.
  const future = join(dir, "futuro.json");
  writeFileSync(future, JSON.stringify({ ...backup, schemaVersion: 3 }));
  await page.getByLabel("Importar respaldo").setInputFiles(future);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("versión más nueva");
  await expect(replace).toBeHidden();
  await expect(sound).toHaveAttribute("aria-checked", "true");

  rmSync(dir, { recursive: true, force: true });
  expect(errors).toEqual([]);
});

test("5 - una ruta que no existe muestra un 404 en español", async ({ page }) => {
  const response = await page.goto("/materias/no-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "No encontré esa página" })).toBeVisible();
  await page.getByRole("link", { name: "Volver al inicio" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("6 - si otra pestaña sube la versión de la base, esta se desconecta y no la toca", async ({ page, context }) => {
  const errors = collectErrors(page);
  await page.goto("/ajustes");
  await expect(page.getByRole("switch", { name: "Sonido" })).toBeEnabled();

  // "Otra pestaña" con una app más nueva: versión 3 (nativa 30), sin un índice de la v2 y con una tabla nueva.
  // Se abre en una página del mismo origen SIN la app (el ícono), para que la única conexión sea la de la
  // pestaña vieja: una página de la app abre su propia sonda, cuyo `close()` queda pendiente mientras
  // terminan sus lecturas, y eso dispara un `blocked` pasajero que no es culpa de la pestaña vieja.
  const other = await context.newPage();
  expect((await other.goto("/icon.svg"))?.ok()).toBe(true); // un 404 traería el layout (y la sonda) de vuelta
  await other.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("cortex", 30);
        req.onupgradeneeded = () => {
          const db = req.result;
          req.transaction?.objectStore("attempts").deleteIndex("sessionId");
          db.createObjectStore("nuevaTabla", { keyPath: "id" });
          req.transaction?.objectStore("meta").put({ key: "schemaVersion", value: 3 });
        };
        req.onsuccess = () => {
          req.result.close();
          resolve();
        };
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("bloqueada: la pestaña vieja no soltó la base"));
      }),
  );

  // La pestaña vieja lo dice y deja de escribir.
  await expect(page.getByRole("banner").getByRole("status")).toContainText("Recarga la página");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Se perdió la conexión con tus datos");
  await expect(page.getByRole("switch", { name: "Sonido" })).toBeDisabled();

  const native = () =>
    other.evaluate(
      () =>
        new Promise<{ version: number; indexes: string[] }>((resolve, reject) => {
          const req = indexedDB.open("cortex");
          req.onsuccess = () => {
            const db = req.result;
            const indexes = [...db.transaction("attempts").objectStore("attempts").indexNames];
            resolve({ version: db.version, indexes });
            db.close();
          };
          req.onerror = () => reject(req.error);
        }),
    );
  expect(await native()).toEqual({ version: 30, indexes: ["at", "exerciseId"] });

  // Al recargar, la guarda la reconoce como más nueva y tampoco la toca.
  await page.reload();
  const warning = page.getByRole("banner").getByRole("status");
  await expect(warning).toContainText("Datos de una versión más nueva");
  expect(await native()).toEqual({ version: 30, indexes: ["at", "exerciseId"] });

  // En el celular más chico el aviso cabe en el header (texto corto; el completo para lectores de pantalla).
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(warning).toContainText("Datos de una versión más nueva");
  const header = await page.getByRole("banner").boundingBox();
  const chip = await warning.boundingBox();
  expect(chip && header && chip.y >= header.y && chip.y + chip.height <= header.y + header.height).toBe(true);
  expect(await noHorizontalOverflow(page)).toBeLessThanOrEqual(0);
  await other.close();
  expect(errors).toEqual([]);
});

test("7 - si el navegador borra los datos del sitio, la pestaña lo dice en vez de fallar en silencio", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/ajustes");
  const sound = page.getByRole("switch", { name: "Sonido" });
  await expect(sound).toBeEnabled();

  // Lo mismo que "Borrar datos del sitio": cierra la conexión a la fuerza, sin `versionchange`.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Storage.clearDataForOrigin", { origin: new URL(page.url()).origin, storageTypes: "indexeddb" });

  await expect(page.getByRole("banner").getByRole("status")).toContainText("Recarga la página");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Se perdió la conexión con tus datos");
  await expect(sound).toBeDisabled();

  // Al recargar arranca limpio, con el perfil de fábrica.
  await page.reload();
  await expect(page.getByRole("banner").getByRole("img", { name: "Nivel 1" })).toBeVisible();
  await expect(sound).toBeEnabled();
  expect(errors).toEqual([]);
});
