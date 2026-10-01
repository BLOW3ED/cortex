# 07 · Calidad y verificación

El contenido es pre-escrito, así que **el riesgo principal son los errores** (una respuesta mal calculada, una definición imprecisa). Estas son las defensas, de más a menos automática.

## Capa 1 · Estructura (automática)
`scripts/verify_content.py` y los esquemas Zod comprueban: campos obligatorios, ids únicos, conceptos existentes, grafo sin ciclos, referencias de jefes, cantidad de huecos vs. respuestas, etc.

## Capa 2 · Corrección de respuestas (automática)
- Numéricos y simbólicos: se recalculan con **sympy** o Python y se comparan.
- Código: la `solucion` se ejecuta contra los `tests`; la `plantilla` no debe pasarlos.
- Predecir salida: se ejecuta el código y se compara.
- Regla: la verificación debe ser **independiente** de cómo se obtuvo la respuesta. Si calculaste 3 a mano y pones `verificar: 3`, no sirve; usa `limit(...)` de sympy.

Ejecución: `python scripts/verify_content.py` (todo) o `python scripts/verify_content.py content/calculo` (una materia). Sale con código 1 si hay errores.

## Capa 3 · Revisión adversarial a ciegas (con Claude Code)
Comando `/revisar-contenido <ruta>`. Un subagente que **no ve las respuestas** resuelve cada ejercicio desde el enunciado; después se comparan. Cualquier discrepancia se investiga (puede ser error del enunciado, ambigüedad o respuesta mal escrita). También revisa lecciones con la checklist de abajo. Obligatorio antes de cerrar cada fase de contenido.

## Capa 4 · Checklist de lección (manual/asistida)
- [ ] ¿Cada afirmación es verdadera y precisa? Sin simplificaciones que induzcan error sin avisarlo.
- [ ] ¿Notación consistente con `conceptos.yaml`?
- [ ] ¿Cubre lo que pide el programa sintético oficial (y solo avisa lo que se agrega)?
- [ ] ¿Los ejemplos resueltos tienen cada paso justificado?
- [ ] ¿Hay al menos 3 ejercicios por concepto nuevo, de dificultad distinta?
- [ ] ¿Es contenido original (no copiado de libros ni sitios)?
- [ ] ¿Datos reales con fuente y fecha, o claramente hipotéticos?
- [ ] ¿Se puede leer sin tropiezos en 15–25 min?

## Capa 5 · Reporte de errores desde la app
Botón "Reportar problema" en cada ejercicio y lección: guarda un registro en la tabla `reportes`. Carlo puede exportarlos y pasárselos a Claude Code ("corrige estos reportes"). Cada corrección conserva el mismo `id` del ejercicio.

## Política de datos reales
Cifras económicas, estadísticas, fechas históricas o datos de APIs: solo con fuente y fecha en el enunciado o la explicación. Si no se puede verificar, se usa un caso hipotético etiquetado ("Supón que...").

## Política de originalidad
No reproducir problemas ni texto de libros, exámenes publicados o apuntes. Se puede usar la misma idea matemática con números y contextos nuevos.

## Pruebas de la app (código)
- `engine/`: pruebas unitarias de XP, niveles, rachas, ligas, jefes, wrapper de FSRS, verificadores de respuestas y generadores del gimnasio.
- Migraciones de Dexie probadas.
- Playwright: flujo "sesión del día", flujo "jefe", respaldo/restauración.
- Cobertura mínima sugerida en `engine/`: 85%.
