# 02 · Arquitectura

## Stack

| Capa | Elección | Nota |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript estricto | Rutas de API locales para el runner de C |
| UI | Tailwind + shadcn/ui | Teclado primero, tema oscuro por defecto |
| Estado | Zustand (UI) + Dexie `liveQuery` (datos) | |
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
  scripts/           verify_content.py
  src/
    app/             rutas
    engine/          xp, niveles, rachas, fsrs, jefes, verificadores (puro TS, sin React)
    content/         loader, esquemas Zod, índice
    db/              esquema Dexie, respaldo
    components/      ui, hud, ejercicios, lecciones, gym
    runners/         pyodide worker, cliente del runner de C
  .claude/commands/
```

**Regla de oro:** `src/engine/` no importa React ni el DOM. Es lógica pura, probada con Vitest. Así las mecánicas se pueden afinar sin romper la UI.

## Modelo de datos (Dexie)

| Tabla | Clave | Contenido |
|---|---|---|
| `perfil` | `id=1` | xp_total, nivel, racha_actual, racha_max, congelamientos, preferencias |
| `progreso_unidad` | `materia/unidad` | estado (nueva, vista, practicada, dominada, maestría), mejor_jefe, intentos_jefe |
| `intentos` | autoincrement | ejercicio_id, fecha, correcto, tiempo_ms, confianza (1–3), respuesta, sesion_id |
| `tarjetas` | `ejercicio_id` | estado FSRS (due, stability, difficulty, reps, lapses, last_review) |
| `sesiones` | autoincrement | inicio, fin, xp_ganado, tipo (diaria, libre, jefe, examen, gym) |
| `misiones` | `fecha/slot` | tipo, objetivo, progreso, completada |
| `records` | `clave` | mejor valor y fecha (precisión, velocidad, racha de aciertos, por unidad) |
| `ghosts` | `contexto` | serie de eventos del mejor intento para comparar en vivo |
| `logros` | `id` | fecha de desbloqueo |
| `gym_resultados` | autoincrement | juego, dominio, nivel, puntaje, fecha |
| `errores` | `ejercicio_id` | veces falladas, última respuesta, nota propia |
| `reportes` | autoincrement | ejercicio_id, comentario de Carlo (para corregir contenido) |

Cada escritura relevante guarda `schema_version`. Migraciones de Dexie obligatorias y probadas.

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
