# 04 · Pedagogía

Cortex se apoya en técnicas con evidencia sólida en psicología del aprendizaje. Cada una tiene una implementación concreta.

| Principio | Qué dice | Cómo se implementa en Cortex |
|---|---|---|
| **Práctica de recuperación** | Intentar recordar fortalece más que releer | Cada lección abre con una pregunta antes de explicar (`<Predice>`); el XP viene de responder, no de leer |
| **Repaso espaciado** | Repasar justo antes de olvidar consolida memoria a largo plazo | FSRS programa cada ejercicio tarjeteable; cola diaria |
| **Intercalado (interleaving)** | Mezclar temas mejora la discriminación y la transferencia | Jefes con 25–35% de repaso de unidades previas; sesiones diarias mezclan materias |
| **Dificultad deseable** | Cierto esfuerzo mejora el aprendizaje a largo plazo | Dificultad adaptativa apuntando a 80–85% de acierto; pistas escalonadas con costo pequeño de XP |
| **Ejemplos resueltos → desvanecidos** | Novatos aprenden más viendo soluciones que resolviendo a ciegas; luego se retiran pasos | Cada técnica: ejemplo completo, ejemplo con pasos faltantes, ejercicio libre |
| **Elaboración / autoexplicación** | Explicar con palabras propias revela huecos | Bloque "Reto Feynman" al final de cada lección; autoevaluación con rúbrica |
| **Doble codificación** | Texto + imagen interactiva ayuda | Visuales con Mafs y diagramas; evitar decoración sin función |
| **Retroalimentación inmediata y explicada** | El error enseña si se entiende por qué | Explicación en cada ejercicio; autopsia de jefes; cuaderno de errores |
| **Metacognición** | Saber qué sabes mejora el estudio | Calibración de confianza; mapa de maestría; diagnóstico "tú de hace 30 días" |
| **Reducir carga cognitiva** | La memoria de trabajo es limitada | Una idea por pantalla; lecciones de 15–25 min; notación consistente |

## Anatomía de una lección

1. **Gancho:** problema concreto o pregunta intrigante (1 párrafo).
2. **Predice:** pregunta de recuperación/intuición antes de la teoría.
3. **Idea central:** definición intuitiva primero, formal después.
4. **Ejemplo resuelto** con cada paso justificado.
5. **Ejemplo desvanecido:** se muestran los primeros pasos, el usuario completa.
6. **Errores comunes:** los fallos típicos y por qué ocurren.
7. **Conexiones:** dónde reaparece en otras materias o en IA.
8. **Resumen en 3 líneas.**
9. **Reto Feynman:** explícalo como a un amigo.

## Anatomía de una unidad

`diagnóstico (opcional) → lección(es) → práctica (ejercicios graduados) → jefe → repaso espaciado continuo`.

Los ejercicios se escriben en escalera de dificultad 1–5 y con **variedad de formato** (no 20 numéricos seguidos).

## Reglas de redacción de contenido

- Español claro y directo; sin relleno ni frases motivacionales vacías.
- Notación consistente por materia (documentarla al inicio de `conceptos.yaml` si hay ambigüedad).
- Definiciones intuitivas antes que formales; formales sin omitir rigor cuando el programa lo pide.
- Cada concepto nuevo se usa en al menos 3 ejercicios de dificultad distinta.
- **Contenido original.** Se puede seguir el temario, pero las explicaciones y problemas se escriben desde cero. No copiar ejercicios ni texto de libros de texto, apuntes ni sitios.
- Alinear al **programa sintético oficial** de la materia (carpeta `curriculum/programas/`). Si la unidad no corresponde al programa, se avisa a Carlo.

## Referencias de apoyo (para criterio, no para copiar)
Cálculo: Stewart · Álgebra lineal: Strang · Ecuaciones diferenciales: Zill · Matemáticas discretas: Rosen · Economía: Mankiw · C: Kernighan y Ritchie. Sirven para validar alcance y notación estándar.
