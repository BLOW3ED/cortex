# Cortex

App web **local-first** para estudiar toda la carrera de Ingeniería en Inteligencia Artificial (IPN, plan 2020) de forma interactiva, retadora y difícil de soltar.

Estado: **Fase 0 · Fundaciones** (ver `ESTADO.md`). La app ya corre en tu máquina: inicio con el plan 2020, lecciones con fórmulas, HUD y respaldo de tus datos. La práctica jugable llega en la Fase 1.

## Qué hay aquí

| Ruta | Para qué |
|---|---|
| `CLAUDE.md` | Reglas que Claude Code lee solo en cada sesión |
| `ESTADO.md` | Tablero vivo: fase actual, checklist, decisiones, bitácora |
| `PRIMER-PROMPT.md` | Cómo arrancar la primera sesión (paso a paso) |
| `docs/` | Visión, roadmap por fases, arquitectura, gamificación, pedagogía, formato de contenido, gimnasio cognitivo, control de calidad |
| `curriculum/plan-2020.json` | Tu plan de estudios completo en datos (de tu PDF) |
| `curriculum/programas/` | Aquí van los programas sintéticos oficiales por materia (tú los bajas) |
| `content/` | Lecciones, ejercicios y jefes. Incluye dos unidades de ejemplo ya verificadas |
| `scripts/verify_content.py` | Verifica que cada respuesta de cada ejercicio sea correcta (sympy / ejecutando código) |
| `scripts/content-check.ts` | `pnpm content:check`: esquemas, lecciones, paridad YAML y `verify_content.py` en un solo comando |
| `src/` | La app (Next.js): rutas, contenido, base local, componentes |
| `tests/`, `e2e/` | Pruebas con Python (`pnpm test:content`) y de navegador (`pnpm test:e2e`) |
| `.claude/commands/` | Comandos `/fase`, `/nueva-unidad`, `/verificar`, `/revisar-contenido`, `/cerrar-fase` |

## Arranque rápido

1. Instala: Node 22.12+ (recomendado Node 24 LTS), pnpm 10.28 (`npm i -g pnpm@10.28.0`), Python 3.11+, git. `gcc` es opcional (solo verifica ejercicios en C). En Windows conviene WSL2, con el repo dentro del sistema de archivos de Linux (no en `/mnt/c`).
2. `pip install -r scripts/requirements.txt`
3. `pnpm install --frozen-lockfile`. Si aparece "Ignored build scripts", avísale a Claude Code.
4. `pnpm dev` y abre **http://localhost:3000**. Usa siempre esa dirección: tus datos viven en el navegador y van ligados a ella. Si el puerto está ocupado, `pnpm dev` falla a propósito en vez de cambiarse a otro (cierra lo que lo use).
5. Verificaciones: `pnpm content:check` (contenido) y `pnpm check` (lint, tipos y pruebas). Para las pruebas de navegador, una vez: `pnpm exec playwright install chromium` (en Linux/WSL2: `pnpm exec playwright install --with-deps chromium`); luego `pnpm test:e2e`.
6. Tus datos: **Ajustes → Descargar respaldo** de vez en cuando. Importar un respaldo reemplaza todo, tras confirmar.

Para trabajar con Claude Code, abre esta carpeta y usa `/fase` (o lee `PRIMER-PROMPT.md`).

## Idea central

Todo el contenido está **pre-escrito** (sin IA en tiempo de ejecución). Como el riesgo número uno de un contenido así es que haya errores, cada respuesta numérica o simbólica se verifica con código antes de entrar al repo. Ver `docs/07-calidad-y-verificacion.md`.
