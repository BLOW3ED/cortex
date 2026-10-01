# Primer prompt · cómo arrancar con Claude Code

> **Histórico.** Así arrancó el proyecto (Fase 0, ya implementada). Para **retomar** hoy: `pnpm install --frozen-lockfile`, `pnpm dev` (http://localhost:3000) y, en Claude Code, `/fase`. Los requisitos al día están en el `README.md`.

## 0. Requisitos (una sola vez)
- Node **22.12 o más nuevo** (recomendado: Node 24 LTS; Node 20 ya no sirve) y `pnpm` 10.28 (`npm i -g pnpm@10.28.0`)
- Python 3.11+ y `pip install -r scripts/requirements.txt`
- `gcc`, solo para los ejercicios en C (Fase 2; en Windows: WSL2, MSYS2 o MinGW; en macOS: `xcode-select --install`)
- git y Claude Code instalado

## 1. Prepara el repo
```bash
cd cortex
python scripts/verify_content.py      # debe terminar en verde
git init && git add -A && git commit -m "docs: repo base de Cortex"
```

## 2. Deja los programas oficiales (muy recomendado antes de la Fase 2)
Descarga los programas sintéticos de tus materias y guárdalos en `curriculum/programas/` como `programacion.pdf`, `calculo.pdf`, etc. (ver el README de esa carpeta).

## 3. Abre Claude Code en la carpeta y pega esto

```
Lee CLAUDE.md, ESTADO.md y docs/00 a docs/03. Luego:

1. Confírmame en un párrafo qué entendiste del proyecto y de la Fase 0.
2. Hazme las preguntas que necesites de la sección "Decisiones pendientes" de ESTADO.md (máximo 5, de opción múltiple si se puede).
3. Entra en modo plan y propón el plan detallado de la Fase 0 (archivos, orden, riesgos y cómo vamos a probar cada entregable).

No escribas código hasta que apruebe el plan.
```

## 4. Ritmo de trabajo recomendado
- Una fase por bloque de trabajo; al terminar usa `/cerrar-fase`.
- Después de cada fase prueba una sesión real de ~20 min y dime qué se sintió aburrido o confuso; eso ajusta `src/engine/config.ts`.
- Para escribir contenido de una materia: `/nueva-unidad calculo/02-continuidad`, luego `/revisar-contenido content/calculo/02-continuidad`.

## 5. Atajos
| Comando | Qué hace |
|---|---|
| `/fase` | Retoma la fase actual según `ESTADO.md` |
| `/nueva-unidad materia/NN-nombre` | Crea lección, ejercicios y jefe desde las plantillas y los verifica |
| `/verificar` | Corre pruebas, tipos, lint y verificación de contenido |
| `/revisar-contenido ruta` | Resolución a ciegas con un subagente + checklist de lección |
| `/cerrar-fase` | Checklist de cierre, actualiza `ESTADO.md` y etiqueta git |
