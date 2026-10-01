# 05 · Formato de contenido

Todo el contenido vive en `content/`. Se valida en dos capas: **Zod** al cargar la app y **`scripts/verify_content.py`** (que además comprueba que las respuestas sean correctas).

## Estructura

```
content/
  <materia>/                  # id de materia = el de curriculum/plan-2020.json
    conceptos.yaml            # grafo de conceptos
    NN-nombre-unidad/
      leccion.mdx
      ejercicios.yaml
      jefe.yaml
```

Las plantillas están en `content/_plantillas/`. Ejemplos reales verificados: `content/calculo/01-limites/` y `content/programacion/01-variables-y-tipos/`.

## `conceptos.yaml`

```yaml
materia: calculo
notacion: "Usamos f'(x) para la derivada; lim sin límites laterales a menos que se indique."
conceptos:
  - id: limite-intuitivo
    nombre: "Límite (idea intuitiva)"
    prerequisitos: []
  - id: limite-polinomio
    nombre: "Límites por sustitución directa"
    prerequisitos: [limite-intuitivo]
```

Reglas: ids en kebab-case y únicos por materia; sin ciclos; prerrequisitos deben existir (pueden apuntar a otra materia con `materia:concepto`).

## `leccion.mdx`

Front matter obligatorio:

```yaml
---
titulo: "Límites: acercarse sin llegar"
materia: calculo
unidad: 01-limites
duracion_min: 25
prerrequisitos: []              # conceptos de otras unidades que conviene dominar
conceptos: [limite-intuitivo]   # conceptos que esta lección introduce
programa_ref: "Cálculo, Unidad I"  # sección del programa oficial; "pendiente" si aún no se tiene
---
```

Componentes MDX disponibles. Desde la Fase 0 existen versiones **provisionales** (muestran el contenido, sin interactividad) para que las lecciones carguen; las interactivas llegan en la Fase 1. Usar un componente que no esté en esta tabla rompe `pnpm content:check` y el build:

| Componente | Uso |
|---|---|
| `<Predice pregunta="..." revela="...">` | Pregunta antes de la teoría; el usuario escribe/elige y luego ve la idea |
| `<Concepto titulo="...">` | Definición o idea central |
| `<Ejemplo titulo="...">` | Ejemplo resuelto completo |
| `<Desvanecido titulo="..." pasos={[...]} respuestas={[...]}>` | Ejemplo con pasos a completar; `respuestas` lleva lo que va en cada `___`, en orden |
| `<Ojo>` | Error común |
| `<Conexion materia="...">` | Vínculo con otra materia o con IA |
| `<Resumen>` | Tres líneas finales |
| `<Feynman>` | Reto de explicar con tus palabras |
| `<Visual id="...">` | Visual interactivo registrado en el código (Mafs, simulaciones) |

Matemáticas con `$...$` y `$$...$$` (KaTeX). Una fórmula que KaTeX no puede dibujar es error (no se muestra roja en silencio).

### Cómo escribir dentro de MDX (escapes)

MDX es código: estas reglas evitan errores que no se ven a simple vista.

| Dónde | Regla | Ejemplo |
|---|---|---|
| Atributo entre comillas (`pregunta="..."`, `revela="..."`, `titulo="..."`) | El texto va tal cual: LaTeX con **una** barra | `pregunta="¿Cuánto vale $\dfrac{1}{2}$?"` |
| Expresión entre llaves (`pasos={[...]}`, `respuestas={[...]}`) | Son strings de JavaScript: cada barra va **doble** | `pasos={["Calcula $\\lim_{x\\to 1} f(x)$."]}` |
| Texto normal, fuera de `$...$` | `{` y `<` sueltos se leen como código: escríbelos `\{` y `\<` | `el conjunto \{1, 2\}` |
| Signo de pesos (dinero) | Escríbelo `\$` para que no abra una fórmula | `cuesta \$150` |

Una barra sola dentro de `{[...]}` no da error por sí misma: `\to` se convierte en un tabulador seguido de "o", `\{` en `{` y `\,` en `,`, y la fórmula sale mal. Por eso `pnpm content:check` la rechaza (solo se aceptan `\\` y las comillas escapadas).

Además, `pnpm content:check` (y `next build`) rechazan:
- Props que el componente no tiene, props obligatorias que faltan (`pregunta` en `<Predice>`, `pasos` en `<Desvanecido>`, `id` en `<Visual>`), contenido dentro de `<Predice>`, `<Desvanecido>` o `<Visual>`, y un `<Desvanecido>` cuyo número de huecos `___` en `pasos` no coincide con `respuestas`.
- Código en atributos: solo valores literales (`"texto"` o `{["a", "b"]}`); en `<abbr title>`, solo `"texto"`.
- Un `$` sin cerrar (la fórmula quedaría como texto crudo).
- HTML dentro de un atributo (`vector<int>` se perdería): escríbelo entre backticks.
- Comandos de KaTeX que cargan cosas externas (`\href`, `\url`, `\includegraphics`).
- Imágenes Markdown (`![alt](url)` o `![alt][ref]`), en el texto o en un atributo: el navegador las pediría a la red. Los visuales van con `<Visual id>`. Los enlaces `[texto](url)` sí se permiten (no cargan nada solos).
- Etiquetas HTML con atributos; solo se permiten `<br> <sub> <sup> <kbd> <mark> <small> <abbr title> <u> <s>`.
- Archivos `.mdx` guardados con BOM (guárdalos como UTF-8 sin BOM).

## `ejercicios.yaml`

```yaml
unidad: calculo/01-limites
ejercicios:
  - id: calc-01-001          # <prefijo-materia>-<NN unidad>-<NNN>, único en todo el repo
    tipo: numerico
    dificultad: 1            # 1 a 5
    conceptos: [limite-polinomio]
    enunciado: "Calcula $\\lim_{x\\to 2}(3x^2-5x+1)$."
    respuesta: 3
    tolerancia: 0
    verificar: { sympy: "limit(3*x**2-5*x+1, x, 2)" }
    pistas: ["¿Qué pasa si sustituyes directamente?"]
    explicacion: "La función es polinomial, así que basta sustituir: $3(4)-10+1=3$."
    tarjeta: true            # si entra al repaso espaciado (default true)
```

### Tipos de ejercicio

| tipo | Campos específicos | Cómo lo verifica `verify_content.py` |
|---|---|---|
| `opcion_multiple` | `opciones` (lista), `correcta` (índice), `valores` (opcional, lista paralela a `opciones` con números o textos que sympy evalúe, como `"1/3"`) | Si hay `verificar.sympy` y `valores`, comprueba que `valores[correcta]` coincida con el resultado |
| `numerico` | `respuesta`, `tolerancia` | Evalúa `verificar.sympy` o `verificar.python` y compara |
| `simbolico` | `respuesta` (expresión), `variables` (opcional) | Comprueba equivalencia con sympy entre `respuesta` y `verificar.sympy` |
| `completar` | `texto` con `___` por hueco, `respuestas` (lista) | Número de huecos = número de respuestas |
| `ordenar` | `elementos` (en orden correcto) | Verifica que haya ≥ 3 elementos únicos; la app los baraja |
| `codigo` | `lenguaje` (`python` o `c`), `plantilla`, `solucion`, `tests` | Ejecuta `solucion` contra `tests`; exige que la `plantilla` **no** los pase |
| `predecir_salida` | `lenguaje` (`python`), `codigo`, `respuesta` (texto) | Ejecuta `codigo` y compara la salida |
| `autoevaluacion` | `rubrica` (lista de criterios), `respuesta_modelo` | Exige rúbrica y respuesta modelo |

**Tests de `codigo` en Python:** lista de `{ expr: "f(2)", esperado: 4, tolerancia: 0 }`. `expr` se evalúa después de ejecutar la solución.
**Tests de `codigo` en C:** lista de `{ entrada: "3 4\n", salida: "7\n" }`; `solucion` es un programa completo con `main`. Se compila con `gcc -Wall -O0` y se compara salida (sin espacios finales).

**Textos exactos van entre comillas.** `opciones`, `elementos`, `respuestas` (de `completar`), la `respuesta` de `predecir_salida` y la `salida` de los tests de C se muestran o se comparan tal cual: escríbelos entre comillas (`respuesta: "3.0"`). Sin comillas, YAML los lee como número y se pierde la forma (`3.0` → 3). Los enteros (`dificultad`, `correcta`, `vidas`, `tiempo_segundos`, `xp`, `duracion_min`) van sin decimales (`4`, no `4.0`).

Campos comunes: `id`, `tipo`, `dificultad`, `conceptos` (al menos uno), `enunciado`, `explicacion` (obligatoria), `pistas` (opcional, máx. 3), `tarjeta` (opcional), `tiempo_estimado_s` (opcional), `verificar` (opcional en general; obligatorio en `numerico` y `simbolico`), `retirado` (opcional). Un campo que no esté en esta lista ni en la de su tipo es error (atrapa errores de dedo como `tolerancai`).

### Sobre `verificar`
- `sympy`: expresión que se evalúa con `from sympy import *` y símbolos `x, y, z, t, n, k` predefinidos. Debe producir el valor correcto **por una vía independiente** a la que usaste para escribir la respuesta (no copies el valor: calcúlalo con la función de sympy).
- `python`: expresión de Python puro que produce el valor (para estadística, finanzas, etc.).
- Si un ejercicio no se puede verificar por código (conceptual), se marca `verificar: { revision: "manual" }` y entra a la lista de revisión humana/adversarial (ver `07-calidad-y-verificacion.md`).

### YAML: cómo se lee
Los `.yaml` se leen como **YAML 1.1** (igual que PyYAML, que usa `verify_content.py`), tanto en Python como en la app. Pon entre comillas cualquier texto que YAML pueda confundir con otra cosa:
- `yes`, `no`, `on`, `off`, `true`, `false` → booleanos. Escribe `"no"` si quieres el texto.
- `010` (octal), `1:30` (sexagesimal) → números raros. Escribe `"010"`, `"1:30"`.
- Notación científica (`1e3`) y decimales sin cifra entera con signo (`-.5`) son texto en PyYAML: escribe `1000` o `-0.5`.
- Fechas sin hora: `2026-01-05` (con ceros); `2026-1-5` es texto.

Las letras sueltas `y` y `n` se leen como texto (como en PyYAML), así que `variables: [x, y, n]` funciona.

## `jefe.yaml`

```yaml
unidad: calculo/01-limites
nombre: "El Guardián del Infinito"
vidas: 3
tiempo_segundos: 480
aprobado_minimo: 0.8
preguntas:
  propias: [calc-01-003, calc-01-004, calc-01-005, calc-01-006]
  repaso_de: []          # ids de ejercicios de unidades anteriores (entrelazado)
recompensa: { xp: 300, insignia: "domador-de-limites" }
```

Reglas: todos los ids referenciados existen (`propias` en la misma unidad, `repaso_de` en unidades previas); mínimo 6 preguntas propias por jefe (menos genera advertencia); al menos 1 pregunta de dificultad ≥ 4 (si no, advertencia). Las preguntas de tipo `autoevaluacion` no se usan en jefes cronometrados.

## Identificadores

- Prefijo de materia para ids de ejercicio: `calc`, `prog`, `disc`, `econ`, `alg`, `cmv`, `edo`, `prob`, `mav`, etc. Se registra en la sección "Prefijos" de `ESTADO.md` al crear una materia.
- Los ids nunca se reutilizan ni se renumeran (las tarjetas FSRS y los intentos dependen de ellos). Un ejercicio retirado se marca `retirado: true`.
