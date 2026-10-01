---
description: Cierra la fase actual de Cortex con su checklist y etiqueta git
---

1. Lee `ESTADO.md` y la Definición de Hecho de la fase actual en `docs/01-roadmap-fases.md`.
2. Corre `/verificar` y confirma que todo esté en verde. Si algo falla, detente y repórtalo.
3. Recorre la checklist común de cierre de `docs/01` punto por punto y dime cuáles cumples y cuáles no, con evidencia (salida de comandos, archivos, pruebas).
4. Si hay contenido nuevo, confirma que se corrió `/revisar-contenido` sobre él.
5. Pídeme una sesión real de ~20 min y espera mis notas ("¿qué fue aburrido o confuso?") antes de cerrar. Con mis notas, propón ajustes a `src/engine/config.ts` o al contenido.
6. Solo cuando yo confirme: actualiza `ESTADO.md` (fase actual, checklist, decisiones, bitácora), haz commit y crea la etiqueta `fase-N`.
7. Resume en 5 líneas qué quedó, qué sigue y qué decisiones necesito tomar para la siguiente fase.
