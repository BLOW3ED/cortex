---
description: Corre todas las verificaciones disponibles (código y contenido)
---

Ejecuta, en este orden, solo lo que exista en el proyecto y reporta un resumen corto:

1. `python scripts/verify_content.py`
2. Si hay `package.json`: `pnpm typecheck`, `pnpm lint`, `pnpm test`
3. Si hay pruebas de Playwright y la tarea tocó flujos de UI: `pnpm test:e2e`

Para cada fallo: indica archivo, causa probable y propón el arreglo. Si todo pasa, dilo en una línea. No marques nada como "hecho" en `ESTADO.md` si algo falló.
