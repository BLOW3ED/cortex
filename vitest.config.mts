import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          // `pnpm test`: rápidas, sin Python.
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
          exclude: ["e2e/**", "node_modules/**", ".next/**", "tests/content/**"],
        },
      },
      {
        extends: true,
        test: {
          // `pnpm test:content`: lanzan `content:check` y PyYAML; necesitan Python 3.11+ con sympy.
          name: "content",
          include: ["tests/content/**/*.test.ts"],
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
