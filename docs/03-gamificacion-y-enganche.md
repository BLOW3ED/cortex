# 03 · Gamificación y enganche

Meta: que a Carlo le den ganas de abrir la app. Método: aprovechar lo que sabemos de motivación (metas claras, retroalimentación inmediata, progreso visible, recompensas variables, competencia, dominio) **sin** manipulación. Regla maestra: **se recompensa aprender (recuperar, espaciar, esforzarse), no estar frente a la pantalla.**

Todas las cifras son un punto de partida. Viven en `src/engine/config.ts` y se afinan con uso real.

## El bucle diario (≈ 15–25 min)

1. **Abrir** → pantalla con un solo botón grande: *Empezar sesión de hoy*. Muestra racha, XP del día y el jefe más cercano.
2. **Calentamiento** (2–3 min): repasos FSRS vencidos, de fácil a difícil.
3. **Misión nueva** (8–12 min): una lección o un bloque de práctica de la unidad actual.
4. **Reto cognitivo** (3–5 min): un minijuego del gimnasio.
5. **Cierre**: resumen (XP, aciertos, récord roto si lo hubo), cofre sorpresa y un **gancho para mañana** ("mañana te espera X; te dejamos una pregunta abierta").

## Recompensas

### XP
| Evento | XP |
|---|---|
| Ejercicio correcto (dificultad 1/2/3/4/5) | 5 / 8 / 12 / 18 / 25 |
| Correcto al primer intento | +50% |
| Repaso FSRS correcto | 6 (+2 si el intervalo era largo) |
| Lección completada con mini quiz ≥ 80% | 20 |
| Jefe aprobado | 150–400 según unidad |
| Misión diaria completada | 30 cada una |

Sin XP por abrir la app, ver lecciones sin practicar ni repetir ejercicios en bucle (rendimientos decrecientes por ejercicio repetido el mismo día).

### Niveles
XP acumulado para subir del nivel *n* al *n+1*: `100 · n^1.5` (curva suave; subir de nivel se siente seguido al principio y cada vez más significativo). Cada nivel desbloquea cosméticos (temas, marcos, títulos), no ventajas de estudio.

### Cofres con sorpresa (recompensa variable, transparente)
Al terminar la sesión del día se abre un cofre. Contenido aleatorio ponderado: bonus de XP, congelamiento de racha, tema, insignia rara, "dato curioso" ligado a lo que estudiaste. Las probabilidades son visibles en ajustes. La variabilidad es el motor del enganche; la transparencia lo hace honesto.

## Racha (con perdón)

- Cuenta el día si se cumple la **misión mínima**: 3 ejercicios correctos o 1 repaso completo (≈ 3 min). Bajar la barra mínima protege el hábito en días malos.
- **Congelamiento:** se gana 1 por cada 7 días de racha (máximo 2 guardados). Se gasta solo si fallas un día.
- **Reparación:** si rompes la racha, puedes recuperarla haciendo doble misión en las siguientes 48 h.
- Nunca mensajes de culpa ("¡vas a perderlo todo!"). Tono: "te guardamos el lugar".

## Jefes (examen disfrazado de pelea)

Cada unidad cierra con un jefe; cada materia, con un jefe final.

- **Vidas:** 3. Cada error quita una; con 0 pierdes el intento (no pierdes XP ya ganado).
- **Fases:** 3 oleadas de dificultad creciente (aprox. 30% fácil, 40% medio, 30% difícil).
- **Entrelazado:** 25–35% de las preguntas vienen de unidades anteriores (interleaving real).
- **Tiempo:** barra global de tiempo definida en `jefe.yaml`.
- **Aprobado:** ≥ 80%.
- **Autopsia:** al terminar (ganes o pierdas) se muestra qué falló, por qué y qué concepto repasar, con botón para añadir los errores al cuaderno y a la cola de repaso.
- **Modo hardcore (opcional):** 1 vida, sin pistas. Da insignia exclusiva.
- **Insignia de dominio:** pasar el jefe marca la unidad como "dominada"; la "maestría" exige además repasos exitosos a más de 21 días.

## Competir contra ti mismo

- **Fantasma:** en jefes y repasos cronometrados ves una barra "fantasma" con el ritmo de tu mejor intento (aciertos y tiempo). Ganarle al fantasma da bonus.
- **Récords personales:** precisión, velocidad, racha de aciertos, mejor semana. Romper un récord dispara una celebración breve.
- **Liga semanal personal:** tu XP de la semana vs el promedio de tus 4 semanas anteriores. Divisiones Bronce → Plata → Oro → Platino → Diamante según el cociente (p. ej. ≥ 1.25 sube, < 0.75 baja). Sin presión externa; es tu ritmo.
- **Tú de hace 30 días:** cada unidad tiene un diagnóstico. Re-aplicarlo mes a mes muestra el crecimiento con números. Es la recompensa más potente a largo plazo porque es evidencia real.

## Mapa de maestría

Cada materia es un árbol de conceptos (`conceptos.yaml`). Estados por nodo: **sin ver → vista → practicada → dominada → maestría**, con color y brillo crecientes. Ver el mapa llenarse es la forma visual del progreso. Los conceptos bloqueados muestran qué prerrequisito falta.

## Flujo (flow) y dificultad

- La selección de ejercicios apunta a **80–85% de acierto esperado**: lo bastante difícil para ser interesante, lo bastante alcanzable para seguir.
- Tras 2 errores seguidos en un concepto: baja un nivel y muestra un ejemplo resuelto.
- Tras 4 aciertos seguidos rápidos: sube un nivel.

## Logros

Ligados a hitos reales, no a tiempo perdido:
- "Domaste el Teorema Fundamental" (jefe de integral aprobado).
- "Cero fugas" (ejercicio de C con memoria dinámica sin errores en el primer intento).
- "Memoria de elefante" (30 repasos seguidos acertados).
- "El madrugador/El nocturno" (sesión antes de las 8 o después de las 22, sin presión por horario).
- Raros y secretos para que explorar tenga premio.

## Microfeedback (sensación de juego)

- Respuesta correcta: animación corta (< 200 ms), sonido opcional, contador de XP que sube.
- Respuesta incorrecta: sacudida sutil, la explicación aparece de inmediato, sin tono de regaño.
- Teclado primero, sin clics innecesarios, transiciones rápidas.
- Estética de HUD: barras, chips de estado, tipografía clara, tema oscuro con acento vivo. Modo claro disponible.

## Calibración (metacognición)

Antes de revelar cada respuesta, el usuario marca confianza 1–3. Acertar con confianza alta da pequeño bonus; fallar con confianza alta marca el concepto como "ilusión de saber" y lo prioriza en repaso. Es de las mecánicas más útiles pedagógicamente.

## Guardarraíles éticos (obligatorios)

- Sin notificaciones de culpa ni cuenta regresiva artificial.
- Sin comprar ventaja ni "saltar" con dinero (no hay dinero).
- Meta diaria alcanzable y clara; cuando se cumple, la app lo celebra y **permite parar** sin castigo.
- "Modo sano" (activable): tras 90 min de uso en un día, sugiere descanso y no otorga más XP de racha.
- El enganche se mide por vuelver mañana, no por minutos en pantalla.
