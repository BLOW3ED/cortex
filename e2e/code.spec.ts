import { expect, type Page, test } from "@playwright/test";
import type { CatalogExercise, StudyCatalog } from "../src/content/core/study-catalog";

/**
 * Fase 2 en el navegador: Python corre en Pyodide (local), C en el runner local (`CORTEX_LOCAL=1`,
 * que pone `start:e2e`), y las mecánicas Debug Dojo, Parsons y rastreo de memoria califican bien.
 * Los ejercicios salen del catálogo real; la solución se escribe en el editor.
 */

test.setTimeout(90_000);

async function catalog(page: Page): Promise<StudyCatalog> {
  const res = await page.request.get("/catalogo.json");
  expect(res.ok()).toBe(true);
  return (await res.json()) as StudyCatalog;
}

function first<T extends CatalogExercise["tipo"]>(cat: StudyCatalog, tipo: T, pred: (e: Extract<CatalogExercise, { tipo: T }>) => boolean = () => true) {
  const ex = Object.values(cat.exercises).find((e): e is Extract<CatalogExercise, { tipo: T }> => e.tipo === tipo && pred(e as Extract<CatalogExercise, { tipo: T }>));
  expect(ex, `hay al menos un ejercicio de tipo ${tipo}`).toBeTruthy();
  return ex as Extract<CatalogExercise, { tipo: T }>;
}

/** Reemplaza el contenido del editor de código por `code`. */
async function setCode(page: Page, code: string) {
  const editor = page.locator(".cm-content").first();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(code);
}

async function submitAndExpect(page: Page, verdict: "¡Correcto!" | "No es correcto.") {
  await page.getByRole("button", { name: /^Comprobar/ }).click();
  await expect(page.getByRole("group").filter({ hasText: "qué tan seguro estás" })).toBeVisible({ timeout: 45_000 });
  await page.keyboard.press("2");
  await expect(page.getByText(verdict)).toBeVisible();
}

test("11 - código en Python: Pyodide local, pruebas visibles/ocultas y calificación", async ({ page }) => {
  // Pyodide se descarga dentro del Worker: el contexto ve esas peticiones; `performance` del hilo principal no.
  const urls: string[] = [];
  page.context().on("request", (req) => urls.push(req.url()));
  const cat = await catalog(page);
  const ex = first(cat, "codigo", (e) => e.lenguaje === "python");
  await page.goto(`/ejercicios/${ex.id}`);
  await expect(page.getByText(/Pruebas: \d+ visibles/)).toBeVisible();
  // Sin cambiar la plantilla no se puede comprobar.
  await page.getByRole("button", { name: /^Comprobar/ }).click();
  await expect(page.getByText(/Escribe tu solución antes de comprobar/)).toBeVisible();
  // Probar con la plantilla: corre en Pyodide y falla.
  await page.getByRole("button", { name: /^Probar/ }).click();
  await expect(page.getByText(/^\d+\/\d+ pruebas$/)).toBeVisible({ timeout: 45_000 });
  // Pyodide se sirvió desde public/vendor, no de un CDN.
  expect(urls.some((u) => u.includes("/vendor/pyodide/pyodide.asm.wasm"))).toBe(true);
  expect(urls.every((u) => u.startsWith("http://localhost:3100/"))).toBe(true);
  await setCode(page, ex.solucion);
  await submitAndExpect(page, "¡Correcto!");
  await expect(page.getByText("Ver una solución")).toBeVisible();
});

test("12 - código en C con el runner local", async ({ page }) => {
  const cat = await catalog(page);
  const status = await (await page.request.get("/api/run-c")).json();
  expect(status).toMatchObject({ enabled: true });
  const ex = first(cat, "codigo", (e) => e.lenguaje === "c");
  await page.goto(`/ejercicios/${ex.id}`);
  await setCode(page, ex.solucion.replace(/return 0;/, "return 0; /* */"));
  await submitAndExpect(page, "¡Correcto!");
});

test("13 - Debug Dojo: elegir la línea y corregir", async ({ page }) => {
  const cat = await catalog(page);
  const ex = first(cat, "depurar", (e) => e.lenguaje === "python");
  const bug = Array.isArray(ex.linea_bug) ? ex.linea_bug[0] : ex.linea_bug;
  await page.goto(`/ejercicios/${ex.id}`);
  await page.getByRole("button", { name: new RegExp(`^Línea ${bug}:`) }).click();
  await expect(page.getByText(/Bien visto: el error está en la línea/)).toBeVisible();
  await setCode(page, ex.solucion);
  await submitAndExpect(page, "¡Correcto!");
});

test("14 - Parsons: armar el programa en orden y con sangría", async ({ page }) => {
  const cat = await catalog(page);
  const ex = first(cat, "parsons", (e) => e.lenguaje === "python");
  await page.goto(`/ejercicios/${ex.id}`);
  const pool = page.getByRole("region", { name: /Líneas disponibles/ });
  for (const line of ex.lineas) await pool.getByRole("button", { name: line.trim(), exact: true }).first().click();
  for (const [i, line] of ex.lineas.entries()) {
    const levels = Math.floor((line.length - line.trimStart().length) / 4);
    for (let k = 0; k < levels; k++) await page.getByRole("button", { name: `Dar sangría a la línea ${i + 1}`, exact: true }).click();
  }
  await submitAndExpect(page, "¡Correcto!");
});

test("15 - rastreo de memoria: pila y heap paso a paso", async ({ page }) => {
  const cat = await catalog(page);
  const ex = first(cat, "rastreo_memoria");
  await page.goto(`/ejercicios/${ex.id}`);
  for (const [i, paso] of ex.pasos.entries()) {
    await expect(page.getByText(`Paso ${i + 1} de ${ex.pasos.length}`)).toBeVisible();
    if (paso.pregunta) await page.getByRole("textbox", { name: "Tu respuesta al paso" }).fill(paso.respuesta ?? "");
    if (i < ex.pasos.length - 1) await page.getByRole("button", { name: "Siguiente paso" }).click();
  }
  await submitAndExpect(page, "¡Correcto!");
});
