# ESTADO · Tablero vivo de Cortex

**Fase actual:** 0 · Fundaciones (en curso, paso 8 de 14)
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
- [x] Loader de contenido con Zod + índice en build
- [x] MDX con KaTeX
- [ ] Capa Dexie + exportar/importar respaldo
- [ ] Sistema visual base y componentes de HUD
- [ ] Inicio con materias desde `plan-2020.json`
- [x] `pnpm content:check`

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

**ADR-011 · Loader único e índice en build** (paso 5). `buildIndex` (puro, `src/content/core/`) valida y arma el índice desde textos crudos; `readRawContent` (fs) es una capa delgada; `server.ts` (`server-only` + `cache` de React) lo expone a las páginas y lanza `ContentValidationError` si hay errores, así que **el build falla con contenido inválido**. `content:check` usará el mismo loader. YAML con la librería `yaml` en modo 1.1, ajustada a PyYAML (`y`/`n` como texto, `09` y `1e3` como texto, `.` como texto); si la librería cambia sus regex, falla en voz alta. `CORTEX_CONTENT_ROOT` permite apuntar a otra raíz (pruebas). `verify_content.py` no se modifica. *Descartado:* un JSON generado en prebuild (otro artefacto que envejece), gray-matter/js-yaml, reescribir sympy en TS.

**ADR-012 · MDX y matemáticas** (paso 6). `@mdx-js/mdx` 3.1.1 con `compileSync` + `runSync` (síncrono, en el servidor), `remark-gfm` (sin él las tablas de las lecciones salen como texto), `remark-math` y `rehype-katex` con `strict: "error"`; `katex` fijo en 0.16.47 (la versión de la que depende `rehype-katex` 7.0.1: una sola versión, CSS y HTML coinciden). `rehype-katex` nunca lanza: sus mensajes se elevan a error con la línea del archivo (el front matter se cambia por líneas vacías). Una guardia propia rechaza componentes no registrados, `import`/`export`, expresiones `{…}` en el texto, `{...spread}` y barras simples dentro de `{[...]}`, y valida con KaTeX las fórmulas de los atributos. Componentes provisionales sin estado (D6) con `<details>` nativo. *Descartado:* next-mdx-remote 6 (su `blockJS` borra `pasos={[...]}` en silencio), `@next/mdx` (`content/` está fuera de `app/` y Turbopack exige plugins serializables), `evaluate` asíncrono, katex 0.18.

**ADR-013 · Nomenclatura** (paso 1, decisión D1). Código, tablas y campos de IndexedDB en inglés, con equivalencias en `docs/02`. Las claves de YAML y del front matter siguen en español (son el formato de contenido). Los componentes MDX conservan su nombre en español porque son la API del contenido (`Predice` se implementa como `PredictPrompt`). Las URL van en español porque son interfaz. `APP_ID = 'cortex'` es inmutable (nombre de la base y marca de los respaldos); renombrar la app solo cambia `APP_NAME`. *Descartado:* todo en español (contradice `CLAUDE.md`) o una capa de traducción.

## Bitácora
- 2026-10-01 · Paso 8: paridad de reglas Zod ↔ `verify_content.py` (`tests/content/parity.test.ts`): 44 casos sobre una raíz mínima con una sola violación; en las reglas compartidas ambos dan la misma severidad y Python reporta la línea esperada; en las reglas "solo TS" la app da error y Python pasa. Evidencia: `pnpm test:content` 63/63 (46 de paridad); la raíz base está limpia en ambos; quitar el caso de `jefe-retirado` hace fallar la meta-prueba "un caso por regla del catálogo". `pnpm check` en verde (100 + 63).
- 2026-10-01 · Paso 7: `pnpm content:check [ruta]` en 4 capas (esquemas y reglas sobre el índice completo, render de cada lección, paridad YAML contra PyYAML real, `verify_content.py`); buscador de Python multiplataforma (`CORTEX_PYTHON`, `python3`, `python`, `py -3`, con timeout y exigiendo 3.11+ con sympy y PyYAML, salida en UTF-8). Paquete en `"type": "module"` (las dependencias de MDX son solo ESM). Pruebas separadas: `pnpm test` (rápidas) y `pnpm test:content` (con Python); `pnpm check` corre ambas. D3 aplicado: `CLAUDE.md`, `/verificar`, `/nueva-unidad`, `/revisar-contenido` y `docs/07` usan `pnpm content:check`. Evidencia: `pnpm content:check` en verde (capa 1: 0 errores; capa 2: 3 lecciones; capa 3: 9 YAML sin diferencias; capa 4: verde); `pnpm test:content` 17/17 sobre copias temporales del repo: real → 0; respuesta alterada → 1 en capa 4; `<Desconocido />` → 1 en capa 2 con la línea; LaTeX roto en `pregunta=` → 1 en capa 2; id duplicado → 1 en capas 1 y 4; ruta acotada solo reporta lo suyo; YAML leído distinto → 1 en capa 3; sin Python → 1 con instrucciones.
- 2026-10-01 · Paso 6: lecciones MDX con KaTeX estricto, tablas GFM, guardia de contenido y 9 componentes provisionales; ruta `/materias/[materia]/[unidad]` estática con `dynamicParams = false` (ADR-012). Evidencia: `pnpm check` en verde (100 pruebas): las 2 lecciones y la plantilla compilan, con `.katex`, 0 `.katex-error` y 1 tabla cada una, sin `$` crudos en atributos; 6 fixtures rotos fallan con la **línea exacta** del archivo (KaTeX en el cuerpo y en un atributo, componente desconocido, barra simple en `{[...]}`, `{…}` en el texto, `import`); los escapes de docs/05 (`\{`, `\$`, `\<`) funcionan. `pnpm build`: ● `/materias/calculo/01-limites` y ● `/materias/programacion/01-variables-y-tipos`. Smoke 2/2: la lección muestra > 10 fórmulas, la fuente `KaTeX_Main` carga y no hay respuestas HTTP ≥ 400.
- 2026-10-01 · Paso 5: loader (`src/content/loader.ts`), `buildIndex` puro con todas las reglas cruzadas (ids únicos globales, conceptos, ciclos, referencias de jefes, y las "solo TS": carpeta, NN del id, prefijo, `repaso_de` previo, jefe sin autoevaluación ni retirados), lector YAML compatible con PyYAML y `server.ts` (ADR-011). El inicio ya lee el índice. Evidencia: `pnpm check` en verde (88 pruebas: 23 de reglas con fixtures en memoria, CRLF/BOM = LF, contenido real con 0 errores y exactamente los 2 avisos de `programa_ref`); el lector YAML da lo mismo que PyYAML en `[x, y, n, Y, N]`, `09`, `1e3`, `1:30`, `.inf`; `pnpm build` genera `/` estático; con `CORTEX_CONTENT_ROOT` apuntando a una copia con un id duplicado, `pnpm build` **falla** con `ContentValidationError` y los 2 errores.
- 2026-10-01 · Paso 4: esquemas Zod 4.6.5 de docs/05 en `src/content/schema/` (plan, conceptos, front matter, ejercicios con despacho por `tipo` y por `lenguaje` en `codigo`, jefe), objetos estrictos y mensajes en español; catálogo de reglas con código estable y la severidad de `verify_content.py` (`src/content/rules/catalog.ts`). Evidencia: `pnpm test` 51/51, incluidos casos válidos/inválidos por regla y el contenido real (24 ejercicios, 2 jefes, 2 `conceptos.yaml`, 2 front matter y `plan-2020.json`) sin errores.
- 2026-10-01 · Paso 3: ESLint 9.39.5 (config de Next + `no-explicit-any`, `consistent-type-imports`, `next/font/google` prohibido, zonas puras sin React/Next/Dexie/DOM salvo `import type`), Vitest 5.0.3 (+ vite 8.3.2; JSX sin plugin) y Playwright 1.63.0 con un smoke contra `next start -p 3100`. Evidencia: `pnpm lint` 0 problemas; `pnpm test` 10/10; al vaciar las zonas puras fallan 4 pruebas de fronteras (la prueba sí detecta); `pnpm test:e2e` 1/1 con `CORTEX_CHROMIUM_PATH` apuntando al Chromium 1194 del contenedor (el CDN de Playwright no responde aquí). El smoke detectó un 404 real (`/favicon.ico`): se agregó `src/app/icon.svg`.
- 2026-10-01 · Paso 2: andamiaje Next 16.3.8 + React 19.3 + TS 6.0.3 estricto + Tailwind 4.3.3 + pnpm 10.28 (ADR-009, ADR-010). Evidencia: `pnpm install --frozen-lockfile` limpio sin scripts ignorados; con Node 20.20.2 pnpm rechaza la instalación (`engines`); `pnpm typecheck` y `pnpm build` en verde (`/` estático); `pnpm dev` responde 200 en `localhost:3000` con `lang="es-MX"`; un segundo `pnpm dev` falla con `EADDRINUSE` en vez de mudarse de puerto; con `CLAUDECODE=1` definido, `next dev` no creó `AGENTS.md` ni tocó `CLAUDE.md`; `tsconfig.json` sin cambios tras `typegen`, `build` y `dev`; `pnpm telemetry:check` → "You have opted-out"; `git add --renormalize .` sin cambios en `content/`; `verify_content.py` en verde.
- 2026-10-01 · Paso 1 de la Fase 0: decisiones de Carlo registradas; Mecánica y electromagnetismo como Fase 4 (`docs/01`, `docs/06`, `cortex_fase` en `plan-2020.json`); requisitos corregidos (Node 22.12+, pnpm 10.28) en README y PRIMER-PROMPT; `docs/00` (`APP_ID`), `docs/02` (tablas en inglés + `meta`), `docs/05` (`respuestas`, componentes provisionales, escapes, YAML 1.1, campos comunes). ADR-013. `verify_content.py` en verde (2 unidades, 24 ejercicios, 17/7, 2 avisos). Versiones verificadas antes de fijar: ESLint 10 incompatible con `eslint-plugin-react` 7.37.5 (peer `^9.7`); `typescript-eslint` 8.71 exige TS < 6.1; `rehype-katex` 7.0.1 depende de `katex ^0.16`; Vitest 5 exige Node ^22.12; `next dev` 16.3.8 escribe un bloque en `CLAUDE.md`/`AGENTS.md` (`generate-agent-files.js`) salvo con `agentRules: false`.
- 2026-10-01 · Repo base creado: docs, plan de estudios en datos, dos unidades de ejemplo verificadas (`calculo/01-limites`, `programacion/01-variables-y-tipos`), script de verificación y comandos de Claude Code.
