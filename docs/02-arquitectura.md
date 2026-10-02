# 02 · Arquitectura

## Stack

| Capa | Elección | Nota |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript estricto | Rutas de API locales para el runner de C |
| UI | Tailwind + shadcn/ui | Teclado primero, tema oscuro por defecto |
| Estado | React (UI) + Dexie `liveQuery` (datos) | Zustand quedó fuera (ADR-017): no hizo falta |
| Persistencia | Dexie sobre IndexedDB | Respaldo JSON exportable |
| Contenido | MDX + YAML en `content/` | Validado con Zod |
| Matemáticas | KaTeX (render), MathLive (entrada), mathjs (evaluación) | |
| Gráficas | Mafs (matemáticas interactivas), Recharts (estadísticas de progreso) | |
| Repaso espaciado | `ts-fsrs` | |
| Código | CodeMirror 6, Pyodide en Web Worker, `gcc` local para C | |
| Pruebas | Vitest (motores), Playwright (flujos clave) | |
| Verificación de contenido | `scripts/verify_content.py` (sympy + ejecución) | |

Si alguna librería ya no se mantiene o hay una mejor al momento de implementar, Claude Code lo propone y registra un ADR nuevo antes de cambiar.

## Estructura del repo

```
cortex/
  CLAUDE.md  ESTADO.md  README.md  PRIMER-PROMPT.md
  docs/
  curriculum/        plan-2020.json, programas/
  content/           <materia>/{conceptos.yaml, NN-unidad/{leccion.mdx, ejercicios.yaml, jefe.yaml}}
  scripts/           verify_content.py, content-check.ts, lib/ (Python multiplataforma, paridad YAML)
  src/
    app/             rutas: / · /sesion · /repaso · /gimnasio · /progreso · /cuaderno · /ajustes · /estilo · /catalogo.json
                     /materias/[materia] (+ /mapa) · /materias/[materia]/[unidad] (+ /quiz, /practica, /jefe)
    content/
      schema/        esquemas Zod de docs/05 (puro)
      core/          índice, reglas cruzadas, lector YAML, API de componentes de lección (puro)
      loader.ts      lee content/ del disco · server.ts (solo servidor) · mdx.ts (MDX + KaTeX + guardia)
    db/              esquema Dexie y guarda de versión, respaldo, hooks de React
    content/rich-text.ts  texto de ejercicios (Markdown + KaTeX) · core/study-catalog.ts (catálogo del navegador)
    components/      ui (shadcn/ui) · hud · lessons · subjects · settings · layout · study · gym · pages
    engine/          config, xp, niveles, racha, fsrs, misiones, cofre, liga, récords, logros, jefes, flujo,
                     maestría, sesión, answers/ (verificadores), gym/ (puro TS, sin React)
    db/              (además) migrations.ts (v1→v2) · progress.ts (reglas del motor en una transacción)
    runners/         (Fase 2) pyodide worker, cliente del runner de C
    lib/  styles/
  tests/             pruebas con Python (paridad, content:check) y stubs
  e2e/               Playwright (smoke)
  .claude/commands/
```

**Regla de oro:** `src/engine/` no importa React ni el DOM. Es lógica pura, probada con Vitest. Así las mecánicas se pueden afinar sin romper la UI.

## Modelo de datos (Dexie)

Los nombres de tablas y campos van **en inglés** porque son identificadores de código (regla de `CLAUDE.md`; decisión D1 de Carlo, 2026-10-01). La columna "Concepto" da la equivalencia en español. Las claves del contenido (`content/**/*.yaml` y front matter) siguen en español: son el formato de contenido de `05-formato-contenido.md`.

| Tabla | Concepto | Clave | Contenido |
|---|---|---|---|
| `meta` | metadatos | `key` | `schemaVersion` de la base (guarda contra bases de una versión más nueva) |
| `profile` | perfil | `id=1` | xpTotal, level, currentStreak, maxStreak, streakFreezes, preferences |
| `unitProgress` | progreso de unidad | `unitKey` (`materia/unidad`) | status (new, seen, practiced, mastered, expert), bestBoss, bossAttempts |
| `attempts` | intentos | autoincrement | exerciseId, at, correct, timeMs, confidence (1–3), answer, sessionId |
| `cards` | tarjetas | `exerciseId` | estado FSRS (due, stability, difficulty, reps, lapses, lastReview) |
| `sessions` | sesiones | autoincrement | startedAt, endedAt, xpEarned, kind (daily, free, boss, exam, gym) |
| `missions` | misiones | `key` (`fecha/slot`) | kind, target, progress, completed |
| `records` | récords | `key` | mejor valor y fecha (precisión, velocidad, racha de aciertos, por unidad) |
| `ghosts` | fantasmas | `context` | serie de eventos del mejor intento para comparar en vivo |
| `achievements` | logros | `id` | fecha de desbloqueo |
| `gymResults` | resultados del gimnasio | autoincrement | game, domain, level, score, at |
| `mistakes` | cuaderno de errores | `exerciseId` | veces falladas, última respuesta, nota propia |
| `reports` | reportes | autoincrement | exerciseId, comentario de Carlo (para corregir contenido) |
| `days` | días (v2) | `day` (`AAAA-MM-DD`) | XP, respondidos, correctos, repasos, misión mínima, combo, tiempo activo, cofre y sesión del día |

Fechas en milisegundos desde epoch; días como `AAAA-MM-DD` en hora local. Cada registro guarda `schemaVersion`. Migraciones de Dexie obligatorias y probadas; la versión 1 del esquema no se edita nunca (una versión nueva se agrega encima).

## Decisiones (ADR resumidos)

**ADR-001 · Local-first sin backend.** Un solo usuario. Elimina cuentas, hosting y costos. Riesgo: perder datos si se borra el almacenamiento del navegador → respaldo JSON manual en F0 y automático (File System Access API) como transversal. Alternativa descartada: Supabase (útil si hay multiusuario; se puede añadir después porque `engine/` y `db/` están aislados).

**ADR-002 · Contenido en archivos del repo.** Versionable con git, revisable por diff, verificable por script. Alternativa descartada: base de datos de contenido (opacidad, sin revisión).

**ADR-003 · Verificación de contenido con código.** Toda respuesta cuantitativa se valida con sympy o ejecutando una solución. Es la contramedida al riesgo de errores en contenido pre-escrito. Ver `07-calidad-y-verificacion.md`.

**ADR-004 · Python en Pyodide.** Corre en el navegador, aislado, sin servidor. Carga de ~10 MB la primera vez; se cachea. NumPy disponible para Álgebra lineal y ML.

**ADR-005 · C con `gcc` local.** Pyodide no compila C. Para una app local de un solo usuario, una ruta API que compila y ejecuta con timeout es la opción más fiel (misma experiencia que su clase). Salvaguardas obligatorias: solo con `CORTEX_LOCAL=1` y host `localhost`; directorio temporal único; `timeout` duro (p. ej. 5 s) y límite de salida; sin red si el sistema lo permite (p. ej. `unshare -n` en Linux); se borra el directorio al terminar; nunca expuesta en un despliegue público. Alternativa para despliegue web: C compilado a WASM; se evalúa solo si algún día se publica.

**ADR-006 · FSRS en vez de SM-2.** Mejor retención con menos repasos y buena librería TS. Parámetros por defecto, retención objetivo 0.90 (configurable).

**ADR-007 · Equivalencia simbólica numérica en cliente.** Para respuestas algebraicas: se evalúan la respuesta del usuario y la oficial en N puntos aleatorios del dominio (evitando singularidades) y se comparan con tolerancia. Se complementa con formatos de forma canónica cuando el ejercicio los pide. El verificador de Python hace la comprobación fuerte con sympy al escribir el ejercicio.

**ADR-008 · Mecánicas puras y afinables.** XP, niveles, ligas y dificultad adaptativa viven en `engine/` con constantes en un solo archivo `engine/config.ts`. Afinar la "adictividad" no debería tocar componentes.

## Rendimiento y UX técnica
- Retroalimentación de respuesta < 100 ms; animaciones < 200 ms.
- Índice de contenido generado en build; las lecciones se cargan por ruta.
- Atajos: `Enter` comprobar, `N` siguiente, `H` pista, `1/2/3` confianza, `Esc` salir.
- Accesibilidad: contraste AA, foco visible, `prefers-reduced-motion` respetado, sonido opcional y apagado por defecto.

## Seguridad
- El runner de C es la única superficie sensible (ADR-005).
- El contenido MDX es de confianza (lo escribimos nosotros), pero no se habilita HTML arbitrario de fuentes externas.
- Sin telemetría. Ningún dato sale de la máquina.
