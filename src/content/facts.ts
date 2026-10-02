/**
 * Datos curiosos del cofre (docs/03: "dato curioso ligado a lo que estudiaste"). Regla de
 * contenido: solo hechos históricos o matemáticos bien establecidos, con su fuente. Nada inventado.
 */
export interface Fact {
  readonly subject: string;
  readonly text: string;
  readonly source: string;
}

export const FACTS: readonly Fact[] = [
  {
    subject: "programacion",
    text: "Python se llama así por el grupo de comedia Monty Python, no por la serpiente.",
    source: "Python Software Foundation, «General Python FAQ: Why is it called Python?»",
  },
  {
    subject: "programacion",
    text: "El lenguaje C lo creó Dennis Ritchie en los Laboratorios Bell a principios de los años 70, para reescribir Unix.",
    source: "D. M. Ritchie, «The Development of the C Language», HOPL-II, 1993",
  },
  {
    subject: "programacion",
    text: "El programa «hello, world» se volvió famoso con el libro The C Programming Language de Kernighan y Ritchie (1978).",
    source: "B. W. Kernighan y D. M. Ritchie, The C Programming Language, 1978",
  },
  {
    subject: "programacion",
    text: "En 1947 el equipo de la Harvard Mark II pegó en su bitácora una polilla atrapada en un relevador: «primer caso real de bug encontrado».",
    source: "Smithsonian National Museum of American History, bitácora de la Mark II (9 de septiembre de 1947)",
  },
  {
    subject: "programacion",
    text: "En 1968 Edsger Dijkstra publicó la carta «Go To Statement Considered Harmful», que impulsó la programación estructurada.",
    source: "E. W. Dijkstra, Communications of the ACM 11(3), 1968",
  },
  {
    subject: "programacion",
    text: "Ada Lovelace publicó en 1843 un algoritmo para calcular números de Bernoulli con la Máquina Analítica de Babbage; se le considera el primer programa publicado.",
    source: "A. A. Lovelace, notas a la traducción del artículo de L. F. Menabrea, 1843",
  },
  {
    subject: "programacion",
    text: "Los enteros de Python no tienen tamaño fijo: 2**1000 se calcula exacto, con sus 302 dígitos.",
    source: "Documentación de Python, «Numeric Types — int»",
  },
  {
    subject: "programacion",
    text: "El estándar IEEE 754 de aritmética de punto flotante, el que usan float y double, se publicó en 1985.",
    source: "IEEE Std 754-1985",
  },
  {
    subject: "programacion",
    text: "Ordenar comparando pares necesita, en el peor caso, del orden de n·log n comparaciones: ningún algoritmo de comparación lo hace mejor.",
    source: "Cota inferior por árboles de decisión; Cormen et al., Introduction to Algorithms, cap. 8",
  },
  {
    subject: "calculo",
    text: "La definición formal de límite se consolidó en el siglo XIX: Cauchy la planteó en 1821 y Weierstrass le dio la forma ε–δ que se usa hoy.",
    source: "A.-L. Cauchy, Cours d'analyse (1821); historia del análisis en J. Stewart, Cálculo",
  },
  {
    subject: "calculo",
    text: "La notación dy/dx y el símbolo ∫ de la integral son de Leibniz.",
    source: "F. Cajori, A History of Mathematical Notations, vol. II",
  },
  {
    subject: "calculo",
    text: "Como sen(x)/x → 1, para ángulos pequeños en radianes sen x ≈ x: así se simplifica el péndulo en física.",
    source: "Consecuencia directa del límite notable sen(x)/x",
  },
  {
    subject: "calculo",
    text: "El número e es el límite de (1 + 1/n)^n cuando n crece; vale aproximadamente 2.71828.",
    source: "Definición estándar de e; J. Stewart, Cálculo",
  },
];

export function factsFor(subjects: readonly string[]): string[] {
  const pool = FACTS.filter((f) => subjects.length === 0 || subjects.includes(f.subject));
  return (pool.length ? pool : FACTS).map((f) => `${f.text} (Fuente: ${f.source}.)`);
}
