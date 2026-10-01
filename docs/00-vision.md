# 00 · Visión

## Qué es Cortex

Una app web personal para dominar **todas** las materias de Ingeniería en IA del IPN (plan 2020), una fase a la vez. Cada materia tiene lecciones, práctica, repaso espaciado y "jefes" que te obligan a demostrar que sí lo dominas. Además incluye un gimnasio cognitivo transversal.

Usuario único: Carlo. Corre en su máquina. No hay cuentas, servidor ni IA en tiempo de ejecución.

## Objetivo en una frase

Que abrir Cortex se sienta como abrir un videojuego que además te vuelve mejor ingeniero.

## Principios (en orden de prioridad)

1. **Correcto antes que bonito.** Un ejercicio con respuesta equivocada destruye la confianza en todo lo demás. Nada entra al repo sin pasar `scripts/verify_content.py`.
2. **Aprender de verdad, no solo "sentir" que aprendes.** Las mecánicas de enganche premian recuperar información de memoria, espaciar repasos y resolver con esfuerzo (ver `04-pedagogia.md`). Nada de XP por ver videos o leer.
3. **Enganche honesto.** Usamos las mismas palancas que los juegos (progreso visible, recompensas variables, metas cercanas, competencia), pero sin culpa manipuladora ni trampas de pago. Ver `03-gamificacion-y-enganche.md`.
4. **Fricción cero para empezar.** Un botón en la pantalla de inicio arma la sesión del día. Si empezar cuesta más de 3 segundos, falla.
5. **Local-first.** Tus datos viven en tu máquina y se pueden exportar e importar en cualquier momento.
6. **Por fases, siempre usable.** Al final de cada fase la app funciona y se puede estudiar con ella.

## Alcance

**Dentro:** las materias del plan 2020 (empezando por bases duras, fundamentos económicos y fundamentos de programación), motor de aprendizaje, gamificación, repaso espaciado, gimnasio cognitivo, simulacros de examen, estadísticas de progreso.

**Fuera (por ahora):** multiusuario, backend, login, pagos, tutor con IA en vivo, app móvil nativa. (La estructura no los impide; ver "Futuro" abajo.)

## Cómo sabremos que funciona (métricas personales)

- **Constancia:** estudiar ≥ 5 días por semana durante 4 semanas seguidas.
- **Retención:** la tasa de acierto en repasos espaciados se mantiene ≥ 85%.
- **Dominio real:** pasar jefes con ≥ 80% sin repetir más de 2 veces.
- **Transferencia:** mejores calificaciones o menos esfuerzo en las materias reales del semestre.
- **Gusto:** tú dices que se te antoja abrirla (la métrica que no se puede falsear).

## Futuro (no construir ahora, no estorbar)

- Tutor opcional con la API de Claude para explicar errores (opt-in, con tu propia llave).
- Modo multiusuario para compañeros del IPN (requeriría backend y cuentas).
- App instalable (PWA) y notificaciones.
- Contenido de las demás materias, hasta cubrir los 8 semestres y las 14 optativas.

## Nombre

"Cortex" es provisional. Cambiarlo es un solo `grep` + renombrar la carpeta.
