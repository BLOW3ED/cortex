---
description: Crea una unidad de contenido (lección + ejercicios + jefe) y la verifica
argument-hint: <materia>/<NN-nombre-unidad>   (p. ej. calculo/02-continuidad)
---

Crea la unidad `$ARGUMENTS` en `content/`.

Pasos:
1. Lee `docs/04-pedagogia.md`, `docs/05-formato-contenido.md` y `docs/07-calidad-y-verificacion.md`.
2. Lee `curriculum/programas/<materia>.pdf` si existe y alinea los temas con el programa oficial. Si no existe, avísame y usa `programa_ref: "pendiente"`.
3. Revisa `content/<materia>/conceptos.yaml`; agrega los conceptos nuevos (con prerrequisitos) antes de usarlos.
4. Escribe `leccion.mdx` desde `content/_plantillas/leccion.mdx` (anatomía completa: gancho, Predice, concepto, ejemplo resuelto, ejemplo desvanecido, errores comunes, conexiones, resumen, Feynman). Contenido **original**, 15–25 min de lectura.
5. Escribe `ejercicios.yaml` con 15–25 ejercicios en escalera de dificultad 1–5 y **variedad de tipos**. Cada respuesta numérica o simbólica debe llevar `verificar` con una vía independiente (sympy o Python). Usa ids `<prefijo>-<NN>-<NNN>` y registra el prefijo en `ESTADO.md` si es nuevo.
6. Escribe `jefe.yaml`: ≥ 6 preguntas propias (al menos una de dificultad ≥ 4) y 25–35% de `repaso_de` si ya hay unidades previas.
7. Corre `pnpm content:check content/<materia>` (incluye `verify_content.py`) y corrige hasta que quede en verde.
8. Termina con un resumen corto: número de ejercicios por tipo y dificultad, y qué ejercicios quedaron en revisión manual. Sugiéreme correr `/revisar-contenido content/$ARGUMENTS`.

No inventes cifras ni datos reales; si hacen falta, cita fuente y fecha o usa un caso hipotético.
