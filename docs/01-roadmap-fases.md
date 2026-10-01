# 01 · Roadmap por fases

Cada fase termina con la app **funcionando y usable**. Una fase no se cierra hasta cumplir su Definición de Hecho (DoH) y la checklist común de abajo.

## Checklist común de cierre (todas las fases)

- [ ] `pnpm typecheck`, `pnpm lint` y `pnpm test` en verde
- [ ] `python scripts/verify_content.py` en verde
- [ ] Flujo principal probado a mano (y con Playwright cuando aplique)
- [ ] `ESTADO.md` actualizado (checklist, decisiones, bitácora)
- [ ] Commit con mensaje claro; etiqueta git `fase-N`
- [ ] Carlo hizo una sesión real de ~20 min y anotó qué se sintió aburrido o confuso

## Orden de materias (ajustable)

Carlo pidió empezar por **bases duras, fundamentos económicos y fundamentos de programación**. Orden propuesto:

| Fase | Contenido | Por qué en este lugar |
|---|---|---|
| 0 | Fundaciones técnicas | Todo se apoya aquí |
| 1 | Motor de aprendizaje + gamificación + unidad piloto | Sin enganche no hay hábito |
| 2 | Fundamentos de programación (Python + C) | Retroalimentación rápida, ancla la identidad de builder, y se reutiliza en las demás fases |
| 3 | Cálculo + Matemáticas discretas | Primeras bases duras |
| 4 | Fundamentos económicos | Respiro conceptual y casos reales entre materias pesadas |
| 5 | Álgebra lineal | Base de ML |
| 6 | Cálculo multivariable | Gradientes y optimización |
| 7 | Ecuaciones diferenciales | Modelado y simulación |
| 8 | Probabilidad y estadística + Matemáticas avanzadas para la ingeniería | Cierra las bases duras |
| 9 | Gimnasio cognitivo completo | Expande lo mínimo entregado en la fase 1 |
| 10+ | Resto del plan, semestre por semestre | Backlog guiado por datos |

"Bases duras" se interpreta como: Matemáticas discretas, Cálculo, Álgebra lineal, Cálculo multivariable, Ecuaciones diferenciales, Probabilidad y estadística y Matemáticas avanzadas. Mecánica y electromagnetismo queda en backlog. **Decisión pendiente de Carlo:** confirmar esta interpretación (ver `ESTADO.md`).

---

## Fase 0 · Fundaciones

**Entregables**
- Proyecto Next.js (App Router) + TypeScript estricto + Tailwind + shadcn/ui; pnpm; ESLint; Vitest; Playwright (solo un smoke test).
- Loader de contenido: lee `content/**` (MDX, YAML), lo valida con Zod según `05-formato-contenido.md` y construye un índice en build time.
- Soporte de matemáticas en MDX (remark-math + rehype-katex).
- Capa de datos local: Dexie (IndexedDB) con las tablas de `02-arquitectura.md`; exportar/importar respaldo JSON.
- Sistema visual base: tema oscuro primero, tokens, tipografía, componentes de HUD (barra de XP, racha, vidas).
- Pantalla de inicio que lista las materias desde `curriculum/plan-2020.json` y marca cuáles tienen contenido.
- Script `pnpm content:check` que corre validación Zod + `verify_content.py`.

**DoH:** `pnpm dev` muestra el inicio con las materias; el contenido de ejemplo se carga sin errores; se puede exportar e importar un respaldo.

## Fase 1 · Motor de aprendizaje

**Entregables**
- Reproductor de sesión: lección → práctica → jefe, con teclado como ruta principal.
- Renderers para todos los tipos de ejercicio excepto `codigo` (llega en la Fase 2): opción múltiple, numérico, simbólico, completar, ordenar, predecir salida (solo mostrar y comparar texto), autoevaluación.
- Verificación de respuestas: tolerancia numérica; equivalencia simbólica por evaluación en puntos aleatorios; entrada de fórmulas con MathLive.
- Repaso espaciado con FSRS (`ts-fsrs`), cola diaria, tarjetas generadas desde los ejercicios.
- Motor de gamificación completo según `03-gamificacion-y-enganche.md`: XP, niveles, rachas con congelamientos, misiones diarias, jefes con vidas y tiempo, fantasma, récords, liga personal, logros.
- Mapa de habilidades (grafo de conceptos con estados de dominio) por materia.
- Botón único "Empezar sesión de hoy" que arma repasos vencidos + 1 lección nueva + mini reto.
- Calibración de confianza (control de 3 niveles antes de revelar respuesta).
- Cuaderno de errores automático.
- Gimnasio cognitivo mínimo: 3 minijuegos (n-back, cálculo mental, secuencias lógicas).
- Unidad piloto jugable de punta a punta: `content/calculo/01-limites`.

**DoH:** Carlo puede completar la sesión diaria con la unidad piloto, ver XP, racha, fantasma y vencimientos de repaso; los motores (XP, FSRS wrapper, verificadores) tienen pruebas unitarias.

## Fase 2 · Fundamentos de programación (Python + C)

**Entregables de plataforma**
- Editor de código (CodeMirror 6).
- Ejecutor de Python en Web Worker con Pyodide, límite de tiempo y tests visibles/ocultos.
- Ejecutor de C: ruta API local que compila con `gcc` en directorio temporal con timeout, sin red, habilitada solo si `CORTEX_LOCAL=1` y host `localhost` (ver ADR-005).
- Mecánicas nuevas: *Debug Dojo* (encuentra el bug), problemas de Parsons (ordenar líneas de código), *Rastreo de memoria* para C (diagrama pila/heap paso a paso).

**Entregables de contenido (≈12 unidades, 15–25 ejercicios cada una, alineadas al programa sintético oficial)**
1. Variables, tipos y entrada/salida · 2. Condicionales · 3. Ciclos · 4. Funciones · 5. Arreglos y cadenas · 6. Apuntadores y memoria (C) · 7. Estructuras y diccionarios · 8. Archivos · 9. Recursión · 10. Pruebas y depuración · 11. Complejidad intuitiva · 12. Proyecto integrador (jefe final).

**DoH:** unidades 1–12 jugables, todas con jefe; todos los ejercicios de código pasan en el verificador contra su solución; el runner de C y el de Python tienen pruebas.

## Fase 3 · Cálculo + Matemáticas discretas

- **Cálculo:** límites, continuidad, derivadas (reglas, cadena, implícita), aplicaciones (optimización, razones relacionadas, aproximación lineal), integral definida e indefinida, Teorema Fundamental, técnicas de integración, aplicaciones de la integral. Alinear con el programa oficial.
- **Matemáticas discretas:** lógica proposicional y de predicados, conjuntos, relaciones y funciones, conteo y combinatoria, inducción, recurrencias, teoría de grafos básica.
- Plataforma nueva: visualizaciones interactivas con Mafs (pendiente, secante→tangente, área bajo curva); simulador de tablas de verdad.
- **DoH:** ambas materias jugables con jefe por unidad y un jefe final cada una; simulacro de examen disponible.

## Fase 4 · Fundamentos económicos

- Escasez y costo de oportunidad, oferta y demanda, elasticidad, equilibrio, excedentes, estructuras de mercado, costos e ingresos marginales, PIB, inflación, desempleo, política monetaria y fiscal, comercio internacional.
- Simuladores: curvas de oferta/demanda arrastrables, calculadora de elasticidad, tablero macro con series de ejemplo.
- Regla de datos reales: cualquier cifra de México o del mundo lleva fuente y fecha en el ejercicio; si no se puede verificar, se usa un caso hipotético y se marca como tal.
- **DoH:** materia jugable; todos los ejercicios cuantitativos verificados con código.

## Fase 5 · Álgebra lineal
Sistemas de ecuaciones, matrices y determinantes, espacios vectoriales, transformaciones lineales, valores y vectores propios, ortogonalidad y mínimos cuadrados, descomposiciones (con SVD como puente a ML). Visual interactivo de transformaciones 2D (arrastrar la base). Ejercicios con NumPy vía Pyodide.

## Fase 6 · Cálculo multivariable
Funciones de varias variables, derivadas parciales, gradiente (y su conexión directa con descenso de gradiente), regla de la cadena multivariable, optimización con y sin restricciones, integrales múltiples, campos vectoriales y teoremas integrales según programa.

## Fase 7 · Ecuaciones diferenciales
Primer orden (separables, lineales, exactas), modelado, segundo orden, transformada de Laplace, sistemas lineales, métodos numéricos (Euler, RK4) con simulaciones en Python.

## Fase 8 · Probabilidad y estadística + Matemáticas avanzadas para la ingeniería
Probabilidad, variables aleatorias, distribuciones, esperanza y varianza, inferencia, regresión. Matemáticas avanzadas **según programa sintético oficial** (típicamente análisis de Fourier, variable compleja o similares; no asumir sin verificar).

## Fase 9 · Gimnasio cognitivo completo
Ver `06-gimnasio-cognitivo.md`: memoria, lógica, cálculo mental, pensamiento sistémico/creativo; dificultad adaptativa; perfil cognitivo semanal.

## Fase 10+ · Resto del plan
Una materia = datos + contenido, sin cambios de plataforma salvo mecánicas nuevas. Orden sugerido: Algoritmos y estructuras de datos → Análisis y diseño de algoritmos → Fundamentos de IA → Aprendizaje de máquina → Redes neuronales → Visión artificial / Lenguaje natural → el resto por semestre. Proponer el orden con Carlo antes de arrancar.

## Transversales (se entregan cuando su fase los necesite)
- Simulacros de examen cronometrados por materia.
- PWA y uso offline.
- Estadísticas semanales y "tú de hace 30 días" (re-aplicar el diagnóstico).
- Respaldo automático con File System Access API.
