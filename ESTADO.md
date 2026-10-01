# ESTADO · Tablero vivo de Cortex

**Fase actual:** 0 · Fundaciones (en curso, paso 3 de 14)
**Última actualización:** 2026-10-01 · plan de la Fase 0 aprobado; decisiones registradas

## Decisiones tomadas (Carlo, 2026-10-01)
- Plataforma: **web app** (Next.js).
- Uso: **solo Carlo, local-first** (sin cuentas ni backend).
- Contenido: **todo pre-escrito**, sin IA en tiempo de ejecución.
- Enganche: **rachas y XP, jefes y retos, repaso espaciado, competir contra sí mismo**.
- Gimnasio cognitivo: **memoria y retención, razonamiento lógico, cálculo mental y velocidad, pensamiento sistémico y creativo**.
- Lenguajes de práctica en Fundamentos de programación: **Python y C**.
- Materias para empezar: **bases duras, fundamentos económicos y fundamentos de programación**.

## Decisiones tomadas (Carlo, 2026-10-01, primer prompt)
- Nombre: **Cortex, definitivo**. El id interno `APP_ID = 'cortex'` no cambia nunca (ver `docs/00`).
- Tiempo diario: **15–25 min** (lo usa la Fase 1 en `src/engine/config.ts`).
- "Bases duras" incluye **Mecánica y electromagnetismo**, y entra pronto: **Fase 4**, justo después de Cálculo + Discretas. Las fases siguientes se recorren una (ver `docs/01`).
- Orden de fases de contenido: **el de `docs/01`**, con el ajuste anterior.
- Materias que más cuestan: **Cálculo, Matemáticas discretas, Mecánica y electromagnetismo, Fundamentos de programación**. Semestre: se asume 1º (no indicó otro).
- Plan de la Fase 0 aprobado tal cual, con sus decisiones técnicas D1–D8:
  - D1: tablas y campos de Dexie en inglés, con equivalencias en `docs/02`.
  - D2: corregir los docs que se contradicen (Node, `docs/00`, `docs/02`, `docs/05`).
  - D3: el flujo de contenido usa `pnpm content:check` (incluye `verify_content.py`); se cambia en `CLAUDE.md` y los comandos cuando exista (paso 7).
  - D4: `agentRules: false` para que `next dev` no reescriba `CLAUDE.md`.
  - D5: se acepta el GET anónimo de `next dev` a registry.npmjs.org (revisión de versión, solo en desarrollo).
  - D6: componentes de lección provisionales sin estado en la Fase 0.
  - D7: importar un respaldo = reemplazo total atómico tras confirmar.
  - D8: tokens de modo claro definidos ahora; el interruptor llega en la Fase 1.

## Decisiones pendientes (preguntar a Carlo)
- [ ] Programas sintéticos oficiales: Carlo debe colocarlos en `curriculum/programas/` (prioridad: programacion, calculo, matematicas-discretas, mecanica-electromagnetismo, fundamentos-economicos).
- [ ] Confirmar el semestre actual (se asumió 1º).

## Prefijos de ids de ejercicio
| Materia | Prefijo |
|---|---|
| calculo | `calc` |
| programacion | `prog` |
| matematicas-discretas | `disc` |
| fundamentos-economicos | `econ` |
| algebra-lineal | `alg` |
| calculo-multivariable | `cmv` |
| ecuaciones-diferenciales | `edo` |
| probabilidad-estadistica | `prob` |
| matematicas-avanzadas | `mav` |
| mecanica-electromagnetismo | `mec` |

## Fases

### Fase 0 · Fundaciones
- [ ] Next.js + TS estricto + Tailwind + shadcn/ui + pnpm
- [x] ESLint, Vitest, Playwright (smoke)
- [ ] Loader de contenido con Zod + índice en build
- [ ] MDX con KaTeX
- [ ] Capa Dexie + exportar/importar respaldo
- [ ] Sistema visual base y componentes de HUD
- [ ] Inicio con materias desde `plan-2020.json`
- [ ] `pnpm content:check`

### Fase 1 · Motor de aprendizaje
- [ ] Reproductor de sesión (lección → práctica → jefe)
- [ ] Renderers de ejercicios (sin `codigo`)
- [ ] Verificadores de respuesta + MathLive
- [ ] FSRS y cola de repaso
- [ ] Motor de gamificación (XP, niveles, rachas, misiones, cofres, jefes, fantasma, récords, liga personal, logros)
- [ ] Mapa de habilidades
- [ ] Botón "Empezar sesión de hoy"
- [ ] Calibración de confianza y cuaderno de errores
- [ ] Gimnasio mínimo (n-back, aritmética, secuencias)
- [ ] Unidad piloto `calculo/01-limites` jugable

### Fase 2 · Fundamentos de programación (Python + C)
- [ ] Editor CodeMirror, runner Pyodide, runner C local
- [ ] Debug Dojo, Parsons, Rastreo de memoria
- [ ] Unidades 1–12 con jefes (la 1 ya tiene borrador de ejemplo en `content/programacion/01-variables-y-tipos`)

### Fase 3 · Cálculo + Matemáticas discretas
- [ ] Visuales Mafs y simulador de tablas de verdad
- [ ] Cálculo (la unidad 1 ya tiene borrador de ejemplo)
- [ ] Matemáticas discretas

### Fase 4 · Mecánica y electromagnetismo
### Fase 5 · Fundamentos económicos
### Fase 6 · Álgebra lineal
### Fase 7 · Cálculo multivariable
### Fase 8 · Ecuaciones diferenciales
### Fase 9 · Probabilidad y estadística + Matemáticas avanzadas
### Fase 10 · Gimnasio cognitivo completo
### Fase 11+ · Resto del plan

## ADRs de implementación
Complementan los ADR-001 a 008 de `docs/02`. Cada uno se escribe en el commit del paso que lo implementa.

**ADR-009 · Toolchain** (paso 2). Versiones exactas (`saveExact`): Next 16.3.8 con Turbopack, React 19.3.0, TypeScript 6.0.3, Tailwind 4.3.3, pnpm 10.28.0 (`packageManager`), Node `^22.12 || ^24 || >=26` (`engines` + `engineStrict`; `.nvmrc` 24). La configuración de pnpm vive en `pnpm-workspace.yaml`; solo `esbuild` puede correr scripts de instalación (`sharp`, `unrs-resolver` y `fsevents` se ignoran explícitamente). `tsconfig.json` completo (`strict`, `noUncheckedIndexedAccess`, `allowJs: false`, `types: ["node"]`) para que Next no lo reescriba. `typecheck = next typegen && tsc --noEmit` (sin `typegen`, `next-env.d.ts` no existe en un clon limpio). *Descartado:* TS 7 (sin API de JS; `typescript-eslint` exige < 6.1), ESLint 10 (rompe `eslint-plugin-react` 7.37.5), Node 20 (Vitest 5 exige ^22.12; fuera de soporte), `create-next-app` (se niega a correr en una carpeta con archivos y usa `next/font/google`). Se revisa cuando `eslint-config-next` soporte ESLint 10 y `typescript-eslint` soporte TS 7.

**ADR-010 · Sin telemetría y red mínima** (paso 2). `NEXT_TELEMETRY_DISABLED=1` como prefijo en los scripts (`shellEmulator: true` hace que funcione también en cmd/PowerShell). `dev` y `start` con `-p 3000` fijo: si el puerto está ocupado Next falla en vez de mudarse a otro puerto (otro origen = otra IndexedDB = "perder" los datos). `agentRules: false` evita que `next dev` escriba en `CLAUDE.md`. Fuentes Geist locales (paquete `geist`); `next/font/google` queda prohibido (descarga en build). Excepción aceptada (D5): `next dev` consulta la versión más nueva en registry.npmjs.org (GET anónimo, sin datos de Carlo, solo en desarrollo). *Descartado:* `.env` (git lo ignora), `next telemetry disable` global (no viaja con el repo), puerto automático.

**ADR-013 · Nomenclatura** (paso 1, decisión D1). Código, tablas y campos de IndexedDB en inglés, con equivalencias en `docs/02`. Las claves de YAML y del front matter siguen en español (son el formato de contenido). Los componentes MDX conservan su nombre en español porque son la API del contenido (`Predice` se implementa como `PredictPrompt`). Las URL van en español porque son interfaz. `APP_ID = 'cortex'` es inmutable (nombre de la base y marca de los respaldos); renombrar la app solo cambia `APP_NAME`. *Descartado:* todo en español (contradice `CLAUDE.md`) o una capa de traducción.

## Bitácora
- 2026-10-01 · Paso 3: ESLint 9.39.5 (config de Next + `no-explicit-any`, `consistent-type-imports`, `next/font/google` prohibido, zonas puras sin React/Next/Dexie/DOM salvo `import type`), Vitest 5.0.3 (+ vite 8.3.2; JSX sin plugin) y Playwright 1.63.0 con un smoke contra `next start -p 3100`. Evidencia: `pnpm lint` 0 problemas; `pnpm test` 10/10; al vaciar las zonas puras fallan 4 pruebas de fronteras (la prueba sí detecta); `pnpm test:e2e` 1/1 con `CORTEX_CHROMIUM_PATH` apuntando al Chromium 1194 del contenedor (el CDN de Playwright no responde aquí). El smoke detectó un 404 real (`/favicon.ico`): se agregó `src/app/icon.svg`.
- 2026-10-01 · Paso 2: andamiaje Next 16.3.8 + React 19.3 + TS 6.0.3 estricto + Tailwind 4.3.3 + pnpm 10.28 (ADR-009, ADR-010). Evidencia: `pnpm install --frozen-lockfile` limpio sin scripts ignorados; con Node 20.20.2 pnpm rechaza la instalación (`engines`); `pnpm typecheck` y `pnpm build` en verde (`/` estático); `pnpm dev` responde 200 en `localhost:3000` con `lang="es-MX"`; un segundo `pnpm dev` falla con `EADDRINUSE` en vez de mudarse de puerto; con `CLAUDECODE=1` definido, `next dev` no creó `AGENTS.md` ni tocó `CLAUDE.md`; `tsconfig.json` sin cambios tras `typegen`, `build` y `dev`; `pnpm telemetry:check` → "You have opted-out"; `git add --renormalize .` sin cambios en `content/`; `verify_content.py` en verde.
- 2026-10-01 · Paso 1 de la Fase 0: decisiones de Carlo registradas; Mecánica y electromagnetismo como Fase 4 (`docs/01`, `docs/06`, `cortex_fase` en `plan-2020.json`); requisitos corregidos (Node 22.12+, pnpm 10.28) en README y PRIMER-PROMPT; `docs/00` (`APP_ID`), `docs/02` (tablas en inglés + `meta`), `docs/05` (`respuestas`, componentes provisionales, escapes, YAML 1.1, campos comunes). ADR-013. `verify_content.py` en verde (2 unidades, 24 ejercicios, 17/7, 2 avisos). Versiones verificadas antes de fijar: ESLint 10 incompatible con `eslint-plugin-react` 7.37.5 (peer `^9.7`); `typescript-eslint` 8.71 exige TS < 6.1; `rehype-katex` 7.0.1 depende de `katex ^0.16`; Vitest 5 exige Node ^22.12; `next dev` 16.3.8 escribe un bloque en `CLAUDE.md`/`AGENTS.md` (`generate-agent-files.js`) salvo con `agentRules: false`.
- 2026-10-01 · Repo base creado: docs, plan de estudios en datos, dos unidades de ejemplo verificadas (`calculo/01-limites`, `programacion/01-variables-y-tipos`), script de verificación y comandos de Claude Code.
