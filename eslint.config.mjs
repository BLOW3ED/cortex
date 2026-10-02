import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const GOOGLE_FONTS = {
  name: "next/font/google",
  message: "Descarga fuentes de Google en el build. Usa el paquete `geist` o next/font/local (ADR-010).",
};

/**
 * Zonas puras: lógica sin React, sin Next y sin DOM (CLAUDE.md, docs/02).
 * Se permite `import type` para compartir tipos.
 */
export const PURE_FILES = ["src/engine/**/*.ts", "src/content/schema/**/*.ts", "src/content/core/**/*.ts"];

const PURE_MESSAGE = "Zona pura: sin React, Next, Dexie ni componentes (solo `import type`).";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "no-restricted-imports": ["error", { paths: [GOOGLE_FONTS] }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: PURE_FILES,
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            GOOGLE_FONTS,
            { name: "react", message: PURE_MESSAGE, allowTypeImports: true },
            { name: "react-dom", message: PURE_MESSAGE, allowTypeImports: true },
            { name: "dexie", message: PURE_MESSAGE, allowTypeImports: true },
          ],
          patterns: [
            {
              group: ["react/*", "react-dom/*", "next", "next/*", "dexie-react-hooks", "@/components/*", "@/app/*"],
              message: PURE_MESSAGE,
              allowTypeImports: true,
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        ...["window", "document", "localStorage", "sessionStorage", "indexedDB", "navigator"].map((name) => ({
          name,
          message: PURE_MESSAGE,
        })),
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Copias de node_modules para el navegador (scripts/vendor-assets.ts): código de terceros.
    "public/vendor/**",
  ]),
]);
