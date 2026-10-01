# 06 · Gimnasio cognitivo

## Expectativas honestas

La evidencia de que los "juegos cerebrales" mejoran la inteligencia general es débil: lo que sí mejora es el rendimiento en la tarea entrenada y en tareas muy parecidas. Por eso el gimnasio se diseña para **entrenar habilidades útiles para la carrera** (retener fórmulas, razonar con lógica, calcular rápido, modelar sistemas) y se mide con tus propios datos. No se promete "subir el IQ".

## Dominios y minijuegos

### Memoria y retención
- **Amplitud de dígitos / Corsi (espacial):** secuencias crecientes; dificultad adaptativa.
- **N-back (visual y dual):** N sube o baja según desempeño.
- **Palacio de la memoria guiado:** asistente que te hace construir un recorrido y asociar 10 ítems (fórmulas, conceptos) a ubicaciones; luego prueba de recuerdo.
- **Blitz de fórmulas:** tarjetas de alta velocidad con material de tus materias (se alimenta de la tabla `cards`, las tarjetas de repaso).

### Razonamiento lógico
- **Secuencias:** numéricas y de figuras con regla oculta.
- **Deducción tipo "puzzle de Einstein":** generador por restricciones; el solver garantiza solución única.
- **Caballeros y bribones:** lógica proposicional aplicada (puente a Matemáticas discretas).
- **Silogismos y falacias:** identificar validez.

### Cálculo mental y velocidad
- **Aritmética adaptativa:** sumas, productos, fracciones, porcentajes; cronometrada.
- **Álgebra relámpago:** simplificar/despejar expresiones cortas.
- **Estimación (Fermi):** orden de magnitud; se puntúa por cercanía en escala logarítmica.

### Pensamiento sistémico y creativo
- **Diagramas de lazos causales:** identifica bucles de refuerzo/balance en un escenario.
- **Conecta A con B:** une dos conceptos de materias distintas explicando el puente (autoevaluación con rúbrica).
- **Restricciones creativas:** resolver un problema con una limitación inusual (p. ej. "diseña un contador sin variables").
- **Analogías:** completar relaciones entre conceptos técnicos.

## Dificultad adaptativa

Escalera **2 aciertos → sube / 1 error → baja** por dominio (converge a ~70% de acierto en tareas de velocidad y ~80% en las de razonamiento). Se guarda el nivel por juego en `gym_resultados`.

## Integración en el hábito

- Cada sesión diaria incluye **1 minijuego de 3–5 min** (rota dominios).
- Los resultados alimentan un **perfil cognitivo semanal** (radar de 4 dominios) comparado contigo mismo, no con una población.
- Logros propios del gimnasio (p. ej. "N-back 4", "100 cálculos sin error").

## Entregas por fase
- **Fase 1:** n-back, aritmética adaptativa, secuencias lógicas.
- **Fase 10:** el resto, perfil semanal y logros.

## Requisitos técnicos
- Cada minijuego es un módulo en `src/components/gym/` con interfaz común (`iniciar(nivel) → resultado`) y su lógica de generación/puntuación en `src/engine/gym/` con pruebas.
- Generadores con semilla para pruebas reproducibles.
