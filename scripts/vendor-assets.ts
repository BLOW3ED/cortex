/**
 * Copia a `public/vendor/` los archivos que el navegador carga por URL y que vienen de
 * `node_modules` (sin CDN ni red: local-first, ADR-010 y ADR-017). Corre antes de `dev` y `build`;
 * `public/vendor/` no se versiona.
 *
 *   - Fuentes de MathLive → public/vendor/mathlive/fonts/
 *   - Pyodide → public/vendor/pyodide/ y su worker → public/vendor/python-worker.mjs
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(import.meta.filename), "..");
const OUT = join(ROOT, "public", "vendor");

interface Copy {
  readonly from: string;
  readonly to: string;
  /** Solo estos archivos (por nombre); vacío = todo el directorio. */
  readonly only?: readonly string[];
}

export const COPIES: readonly Copy[] = [
  { from: "node_modules/mathlive/fonts", to: "mathlive/fonts" },
  // Pyodide (Python en WebAssembly, ADR-004): solo lo que carga el núcleo, sin paquetes extra.
  {
    from: "node_modules/pyodide",
    to: "pyodide",
    only: ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"],
  },
  // El worker que lo usa (código propio, en src/runners para que se revise y versione).
  { from: "src/runners", to: ".", only: ["python-worker.mjs"] },
];

function upToDate(src: string, dst: string): boolean {
  return existsSync(dst) && statSync(dst).size === statSync(src).size && statSync(dst).mtimeMs >= statSync(src).mtimeMs;
}

export function vendorAssets(): number {
  let copied = 0;
  for (const c of COPIES) {
    const from = join(ROOT, c.from);
    if (!existsSync(from)) throw new Error(`falta ${c.from}: corre pnpm install`);
    const to = join(OUT, c.to);
    mkdirSync(to, { recursive: true });
    for (const name of c.only ?? readdirSync(from)) {
      const src = join(from, name);
      const dst = join(to, name);
      if (statSync(src).isDirectory()) {
        cpSync(src, dst, { recursive: true });
        copied++;
      } else if (!upToDate(src, dst)) {
        cpSync(src, dst);
        copied++;
      }
    }
  }
  return copied;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const n = vendorAssets();
  if (n) console.log(`vendor-assets: ${n} archivo(s) copiado(s) a public/vendor/`);
}
