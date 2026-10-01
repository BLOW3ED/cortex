# ESTADO · Tablero vivo de Cortex

**Fase actual:** 0 · Fundaciones (sin empezar)
**Última actualización:** 2026-10-01 · repo base creado

## Decisiones tomadas (Carlo, 2026-10-01)
- Plataforma: **web app** (Next.js).
- Uso: **solo Carlo, local-first** (sin cuentas ni backend).
- Contenido: **todo pre-escrito**, sin IA en tiempo de ejecución.
- Enganche: **rachas y XP, jefes y retos, repaso espaciado, competir contra sí mismo**.
- Gimnasio cognitivo: **memoria y retención, razonamiento lógico, cálculo mental y velocidad, pensamiento sistémico y creativo**.
- Lenguajes de práctica en Fundamentos de programación: **Python y C**.
- Materias para empezar: **bases duras, fundamentos económicos y fundamentos de programación**.

## Decisiones pendientes (preguntar a Carlo)
- [ ] Confirmar qué cuenta como "bases duras" (propuesta: Mat. discretas, Cálculo, Álgebra lineal, Cálculo multivariable, Ecuaciones diferenciales, Probabilidad y estadística, Mat. avanzadas). ¿Mecánica y electromagnetismo entra?
- [ ] Orden de las fases de contenido (propuesta en `docs/01`: Programación → Cálculo/Discretas → Economía → Álgebra lineal → ...).
- [ ] Semestre actual de Carlo y materias que más le cuestan (para priorizar el backlog).
- [ ] Tiempo diario disponible (define la duración de la sesión diaria; propuesta: 15–25 min).
- [ ] Nombre definitivo de la app (provisional: Cortex).
- [ ] Programas sintéticos oficiales: Carlo debe colocarlos en `curriculum/programas/`.

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

## Fases

### Fase 0 · Fundaciones
- [ ] Next.js + TS estricto + Tailwind + shadcn/ui + pnpm
- [ ] ESLint, Vitest, Playwright (smoke)
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

### Fase 4 · Fundamentos económicos
### Fase 5 · Álgebra lineal
### Fase 6 · Cálculo multivariable
### Fase 7 · Ecuaciones diferenciales
### Fase 8 · Probabilidad y estadística + Matemáticas avanzadas
### Fase 9 · Gimnasio cognitivo completo
### Fase 10+ · Resto del plan

## Bitácora
- 2026-10-01 · Repo base creado: docs, plan de estudios en datos, dos unidades de ejemplo verificadas (`calculo/01-limites`, `programacion/01-variables-y-tipos`), script de verificación y comandos de Claude Code.
