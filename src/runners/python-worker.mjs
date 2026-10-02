/*
 * Worker de Python (Fase 2, ADR-004). Se copia a `public/vendor/python-worker.mjs` con
 * `scripts/vendor-assets.ts` y carga Pyodide desde `public/vendor/pyodide/` (local, sin CDN).
 *
 * Protocolo:
 *   → { id, type: "init", harness }        carga Pyodide (una vez) y define __cortex_run
 *   → { id, type: "run", code, exprs }     ejecuta y devuelve el JSON del arnés
 *   ← { id, ok: true, json } | { id, ok: false, error }
 * Si un código se cicla, el hilo principal termina este worker y crea otro (límite de tiempo).
 */
import { loadPyodide } from "/vendor/pyodide/pyodide.mjs";

let pyodide = null;
let ready = null;

function init(harness) {
  if (!ready) {
    ready = loadPyodide({ indexURL: "/vendor/pyodide/" }).then((py) => {
      pyodide = py;
      py.runPython(harness);
      return py;
    });
  }
  return ready;
}

self.onmessage = async (event) => {
  const { id, type } = event.data;
  try {
    if (type === "init") {
      await init(event.data.harness);
      self.postMessage({ id, ok: true, json: "null" });
      return;
    }
    if (type === "run") {
      if (!pyodide) throw new Error("Pyodide no está listo");
      const run = pyodide.globals.get("__cortex_run");
      const exprs = pyodide.toPy(event.data.exprs);
      try {
        const json = run(event.data.code, exprs);
        self.postMessage({ id, ok: true, json });
      } finally {
        exprs.destroy();
        run.destroy();
      }
      return;
    }
    throw new Error(`mensaje desconocido: ${type}`);
  } catch (e) {
    self.postMessage({ id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
};
