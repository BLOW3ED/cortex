---
description: Corre todas las verificaciones disponibles (código y contenido)
---

Ejecuta, en este orden, solo lo que exista en el proyecto y reporta un resumen corto:

1. `pnpm content:check` (esquemas Zod, compilación MDX/KaTeX, paridad YAML y `verify_content.py`)
2. `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm test:content` (o todo junto: `pnpm check`)
3. Si la tarea tocó flujos de UI: `pnpm test:e2e`. Si el Chromium de Playwright no se puede instalar (p. ej. en un contenedor), apunta `CORTEX_CHROMIUM_PATH` a un Chromium existente.

Para cada fallo: indica archivo, causa probable y propón el arreglo. Si todo pasa, dilo en una línea. No marques nada como "hecho" en `ESTADO.md` si algo falló.
