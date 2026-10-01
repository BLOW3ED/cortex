# CLAUDE.md · Reglas del proyecto Cortex

Cortex es una app web **local-first** de un solo usuario (Carlo) para estudiar toda la carrera de Ingeniería en IA del IPN (plan 2020) con lecciones, práctica, repaso espaciado, jefes, gamificación y un gimnasio cognitivo. El objetivo es que sea difícil de soltar **sin** manipular.

## Antes de hacer cualquier cosa
1. Lee `ESTADO.md` (fase actual, decisiones pendientes, bitácora).
2. Lee los docs que apliquen a la tarea: `docs/00` a `docs/07`. Son la fuente de verdad. Si el código y los docs se contradicen, para y pregúntale a Carlo cuál manda.
3. Trabaja **una fase a la vez**, según `docs/01-roadmap-fases.md`. No adelantes entregables de fases posteriores salvo que Carlo lo pida.

## Cómo trabajar una fase
1. Entra en modo plan, propón el plan detallado (archivos, orden, riesgos) y espera aprobación.
2. Implementa en pasos pequeños; commit al terminar cada paso con mensaje claro en español (`feat:`, `fix:`, `docs:`, `content:`, `test:`).
3. Cierra con `/cerrar-fase`: checklist común de `docs/01`, `ESTADO.md` actualizado, etiqueta git `fase-N`.
4. Nunca marques algo como hecho sin haberlo ejecutado y visto pasar (pruebas, `verify_content.py`, o el flujo a mano). Si no pudiste verificarlo, dilo.

## Reglas de contenido (críticas)
- **Correcto antes que bonito.** Toda respuesta numérica/simbólica se verifica con `scripts/verify_content.py` mediante una vía **independiente** (sympy, Python o ejecutar la solución). No pongas `verificar: 3` copiando tu propio cálculo.
- **Alinea con el programa oficial** de la materia (`curriculum/programas/<id>.pdf`). Si no existe, pídeselo a Carlo antes de escribir la materia, o marca `programa_ref: "pendiente"` y avisa.
- **Contenido original.** No copies ejercicios, texto ni estructura de libros, exámenes o apuntes.
- **Datos reales con fuente y fecha**, o claramente hipotéticos ("Supón que..."). Nunca inventes cifras.
- Sigue `docs/05-formato-contenido.md` y las plantillas de `content/_plantillas/`. Los ids de ejercicio no se reutilizan ni se renumeran; los retirados llevan `retirado: true`.
- Después de escribir una unidad: corre `python scripts/verify_content.py` y luego `/revisar-contenido` (resolución a ciegas por un subagente) antes de darla por buena.
- Una unidad completa = lección + 15–25 ejercicios en escalera de dificultad 1–5 con **variedad de tipos** + jefe de ≥ 6 preguntas (incluye entrelazado de unidades previas).

## Reglas de código
- TypeScript estricto, sin `any` salvo justificación comentada.
- `src/engine/` es lógica pura: **sin React ni DOM**, con pruebas unitarias (Vitest). Todas las constantes de mecánicas (XP, niveles, ligas, dificultad) viven en `src/engine/config.ts`.
- Datos solo en el navegador (Dexie/IndexedDB). Sin backend, sin telemetría, sin servicios externos. Toda migración de Dexie lleva prueba.
- El runner de C compila con `gcc` solo si `CORTEX_LOCAL=1` y el host es `localhost`, con directorio temporal, `timeout` y límite de salida (ver ADR-005). Nunca lo expongas fuera de local.
- Teclado primero, retroalimentación < 100 ms, respetar `prefers-reduced-motion`, sonido apagado por defecto.
- Antes de añadir una dependencia: ¿ya hay una en el stack de `docs/02`? Si no, justifica y registra un ADR en `ESTADO.md`.

## Gamificación (resumen; detalle en `docs/03`)
Se premia **aprender** (recuperar, espaciar, esforzarse), no el tiempo en pantalla. Recompensas variables con probabilidades visibles. Rachas con perdón y sin mensajes de culpa. Siempre se debe poder parar tras cumplir la meta del día sin castigo. Nada de compras ni ventajas pagadas.

## Idioma
- Interfaz, contenido, docs y mensajes de commit: **español** (México), tono directo y cercano, sin relleno.
- Identificadores de código (variables, funciones, tipos): **inglés**.

## Qué NO hacer
- No inventes respuestas, fórmulas, cifras ni fuentes. Si dudas, verifica con código o pregunta.
- No tomes decisiones de producto grandes sin consultarlas (anótalas en "Decisiones pendientes" de `ESTADO.md`).
- No toques `content/` ya verificado sin volver a correr `verify_content.py`.
- No agregues tutor/IA en tiempo de ejecución: está fuera de alcance (ver `docs/00`).
- No hagas cambios destructivos (borrar datos de usuario, reescribir historia de git) sin pedir confirmación.

## Comandos útiles
- `python scripts/verify_content.py [ruta]` · verificar contenido
- Slash commands en `.claude/commands/`: `/fase`, `/nueva-unidad`, `/verificar`, `/revisar-contenido`, `/cerrar-fase`
- Una vez creado el proyecto Next.js (Fase 0): `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm content:check`
