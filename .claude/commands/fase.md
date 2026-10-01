---
description: Retoma la fase actual de Cortex según ESTADO.md
---

1. Lee `CLAUDE.md`, `ESTADO.md` y los docs de `docs/` relevantes para la fase actual.
2. Dime en 3 líneas: fase actual, qué falta (checklist de `ESTADO.md`) y cuál es el siguiente paso lógico.
3. Si hay "Decisiones pendientes" que bloqueen el siguiente paso, pregúntamelas primero (máximo 4, opción múltiple si se puede).
4. Entra en modo plan para el siguiente bloque de trabajo; espera mi aprobación antes de escribir código.
5. Al terminar cada paso: corre las verificaciones que apliquen (`/verificar`), actualiza la checklist y la bitácora de `ESTADO.md`, y haz commit.

No adelantes entregables de fases futuras.
