# Cortex

App web **local-first** para estudiar toda la carrera de Ingeniería en Inteligencia Artificial (IPN, plan 2020) de forma interactiva, retadora y difícil de soltar.

Estado: **repo base listo para Claude Code**. Todavía no hay app; la construye Claude Code fase por fase.

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
| `.claude/commands/` | Comandos `/fase`, `/nueva-unidad`, `/verificar`, `/revisar-contenido`, `/cerrar-fase` |

## Arranque rápido

1. Instala: Node 20+ (o 22), pnpm, Python 3.11+, gcc, git.
2. `pip install -r scripts/requirements.txt`
3. `python scripts/verify_content.py` (debe terminar en verde).
4. `git init && git add -A && git commit -m "Repo base de Cortex"`
5. Abre Claude Code en esta carpeta y sigue `PRIMER-PROMPT.md`.

## Idea central

Todo el contenido está **pre-escrito** (sin IA en tiempo de ejecución). Como el riesgo número uno de un contenido así es que haya errores, cada respuesta numérica o simbólica se verifica con código antes de entrar al repo. Ver `docs/07-calidad-y-verificacion.md`.
