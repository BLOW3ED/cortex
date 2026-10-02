import { expect, type Page, test } from "@playwright/test";
import type { CatalogExercise, StudyCatalog } from "../src/content/core/study-catalog";
import { addDays } from "../src/engine/dates";
import { gymGameFor } from "../src/engine/session";

/**
 * Flujos de estudio de la Fase 1 (docs/07): la sesión del día de punta a punta y un jefe. Las
 * respuestas salen del propio catálogo (`/catalogo.json`), así la prueba no depende del orden.
 */

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

async function catalog(page: Page): Promise<StudyCatalog> {
  const res = await page.request.get("/catalogo.json");
  expect(res.ok()).toBe(true);
  return (await res.json()) as StudyCatalog;
}

const LETTERS = "ABCDEFGH";

/** Texto del YAML sin marcas de Markdown/LaTeX, para buscarlo en el DOM ya renderizado. */
const plain = (s: string) => s.replace(/[`$*]/g, "");

/** Contesta bien el ejercicio que está en pantalla (con confianza 3) y pasa al siguiente. */
async function answerCurrent(page: Page, cat: StudyCatalog, { correct = true }: { correct?: boolean } = {}): Promise<string> {
  const article = page.locator("article[aria-label^='Ejercicio ']");
  await expect(article).toBeVisible();
  const id = ((await article.getAttribute("aria-label")) ?? "").replace("Ejercicio ", "");
  const ex = cat.exercises[id] as CatalogExercise;
  expect(ex, `ejercicio ${id} en el catálogo`).toBeTruthy();
  switch (ex.tipo) {
    case "opcion_multiple":
      await page.keyboard.press(LETTERS[correct ? ex.correcta : (ex.correcta + 1) % ex.opciones.length] ?? "A");
      await page.keyboard.press("Enter");
      break;
    case "numerico":
    case "simbolico": {
      const value = correct ? String(ex.respuesta) : "123456";
      if (ex.tipo === "simbolico") await page.getByRole("button", { name: "Prefiero teclear como texto" }).click();
      const box = page.getByRole("textbox", { name: ex.tipo === "simbolico" ? "Tu expresión" : "Tu respuesta" });
      await box.fill(value);
      await box.press("Enter");
      break;
    }
    case "completar": {
      for (let i = 0; i < ex.respuestas.length; i++) {
        await page.getByRole("textbox", { name: `Hueco ${i + 1} de ${ex.respuestas.length}` }).fill(correct ? (ex.respuestas[i] ?? "") : "zzz");
      }
      await page.getByRole("button", { name: /Comprobar/ }).click();
      break;
    }
    case "predecir_salida": {
      const box = page.getByRole("textbox", { name: "Salida exacta" });
      await box.fill(correct ? ex.respuesta : "nada");
      await box.press("Control+Enter");
      break;
    }
    case "ordenar": {
      // Ordena con los botones "Subir paso N" hasta que coincida con `elementos`.
      for (let target = 0; target < ex.elementos.length; target++) {
        const items = await page.getByRole("list", { name: "Pasos en tu orden" }).locator("li").allTextContents();
        const from = items.findIndex((t) => t.includes(plain(ex.elementos[target] ?? "\u0000")));
        expect(from, `paso «${ex.elementos[target]}» en pantalla`).toBeGreaterThanOrEqual(target);
        for (let k = from; k > target; k--) await page.getByRole("button", { name: `Subir paso ${k + 1}` }).click();
      }
      await page.getByRole("button", { name: /Comprobar/ }).click();
      break;
    }
    default:
      throw new Error(`tipo no contemplado en la prueba: ${ex.tipo}`);
  }
  await page.keyboard.press("3");
  await expect(page.getByText(correct ? "¡Correcto!" : "No es correcto.")).toBeVisible();
  await page.keyboard.press("n");
  return id;
}

/** Un día cuyo minijuego sea "secuencias" (el más corto de jugar en una prueba). */
function dayWithSequences(): Date {
  let day = "2026-10-05";
  while (gymGameFor(day) !== "sequences") day = addDays(day, 1);
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1, 18, 0, 0);
}

test("8 - sesión del día: misión de lección con mini quiz, reto cognitivo y cofre", async ({ page }) => {
  const errors = collectErrors(page);
  await page.clock.setFixedTime(dayWithSequences());
  const cat = await catalog(page);
  await page.goto("/");
  await page.getByRole("link", { name: /Empezar sesión de hoy/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sesión de hoy" })).toBeVisible();

  // Sin repasos vencidos (base nueva) la sesión empieza en la misión: una lección nueva.
  await expect(page.getByRole("heading", { name: /^Lección nueva:/ })).toBeVisible();
  await page.getByRole("button", { name: "Ya la leí: mini quiz" }).click();
  const ids: string[] = [];
  for (let i = 0; i < 5; i++) ids.push(await answerCurrent(page, cat));
  expect(new Set(ids).size).toBe(5);
  await expect(page.getByRole("heading", { name: "Lección completada" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  // Reto cognitivo: secuencias (6 respuestas; aquí basta jugarlo, no ganarlo).
  await expect(page.getByRole("heading", { name: "Patrón oculto" })).toBeVisible();
  for (let i = 0; i < 6; i++) {
    const box = page.getByRole("textbox", { name: "Siguiente término" });
    await box.fill("0");
    await box.press("Enter");
    await page.getByRole("button", { name: i === 5 ? "Terminar" : "Siguiente" }).click();
  }
  await expect(page.getByText(/secuencias resueltas/)).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  // Cierre: la misión mínima ya cuenta, el cofre se abre una vez y hay gancho para mañana.
  await expect(page.getByRole("heading", { name: "Buen trabajo hoy." })).toBeVisible();
  await expect(page.getByText(/misión mínima de hoy ya cuenta/)).toBeVisible();
  await page.getByRole("button", { name: "Abrir el cofre" }).click();
  await expect(page.getByText(/XP de bonus|congelamiento|Marco nuevo|Insignia rara|Dato curioso/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir el cofre" })).toHaveCount(0);
  await expect(page.getByText("Mañana te espera")).toBeVisible();

  // El HUD refleja el XP y la racha de hoy.
  await expect(page.getByRole("banner").getByRole("img", { name: "Racha: 1 día" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("9 - jefe: oleadas, una vida perdida, victoria, autopsia e insignia", async ({ page }) => {
  const errors = collectErrors(page);
  const cat = await catalog(page);
  await page.goto("/materias/calculo/01-limites/jefe");
  await page.getByRole("button", { name: "Empezar la pelea" }).click();
  await expect(page.getByRole("img", { name: "3 de 3 vidas" })).toBeVisible();
  await expect(page.getByLabel(/^Tiempo restante/)).toBeVisible();

  // Falla la primera y acierta el resto: 5/6 = 83 % ≥ 80 %.
  const failed = await answerCurrent(page, cat, { correct: false });
  await expect(page.getByRole("img", { name: "2 de 3 vidas" })).toBeVisible();
  for (let i = 0; i < 5; i++) await answerCurrent(page, cat);
  await expect(page.getByRole("heading", { name: /Derrotaste a «El Guardián del Infinito»/ })).toBeVisible();
  await expect(page.getByText(/83% de aciertos/)).toBeVisible();
  await expect(page.getByText(failed)).toBeVisible();
  await page.getByRole("button", { name: "Mandar estos a mi repaso de hoy" }).click();
  await expect(page.getByText(/ya están en tu cola/)).toBeVisible();

  await page.goto("/progreso");
  await expect(page.getByText("Insignia: domador-de-limites")).toBeVisible();
  await expect(page.getByText("Primer jefe", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("10 - las páginas de estudio no desbordan en un celular", async ({ page }) => {
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 800 });
    for (const url of ["/sesion", "/repaso", "/gimnasio", "/progreso", "/cuaderno", "/materias/calculo/mapa", "/materias/calculo/01-limites/practica", "/materias/calculo/01-limites/jefe"]) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${url} a ${width} px`).toBeLessThanOrEqual(0);
    }
  }
});
