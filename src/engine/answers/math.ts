import { all, create, type FactoryFunctionMap, type MathNode } from "mathjs/number";

/**
 * Evaluación de expresiones para los verificadores (ADR-007). Se usa la versión `number` de
 * mathjs (sin complejos ni BigNumber): `sqrt(-1)` da `NaN` y ese punto se descarta.
 *
 * Por seguridad y para dar errores claros, solo se aceptan funciones de una lista blanca y
 * símbolos que sean variables declaradas o constantes conocidas.
 */
// `all` siempre existe en la versión number; sus tipos lo marcan opcional.
const math = create(all as FactoryFunctionMap, {});

const FUNCTIONS = new Set([
  "sqrt", "cbrt", "abs", "exp", "log", "log10", "log2", "ln",
  "sin", "cos", "tan", "sec", "csc", "cot", "asin", "acos", "atan",
  "sinh", "cosh", "tanh", "floor", "ceil", "round", "sign", "factorial", "nthRoot", "pow",
]);
const CONSTANTS: Readonly<Record<string, number>> = { pi: Math.PI, e: Math.E, E: Math.E, Infinity, oo: Infinity };

/** `sin x`, `sin^2 x`, `sin ^2(x+1)`, `ln x`... (la función va seguida de un argumento sin paréntesis propios). */
const FN_NO_PARENS = /\b(sinh|cosh|tanh|asin|acos|atan|sin|cos|tan|sec|csc|cot|ln|log|exp)\s*(?:\^\s*(\d+|\([^()]*\)))?\s*(?=[a-zA-Z0-9.(])((?:\d+(?:\.\d+)?)?[a-zA-Z]\w*|\d+(?:\.\d+)?|\([^()]*\))/g;

export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionError";
  }
}

/** Traduce la sintaxis de sympy y de la escritura común a la de mathjs. */
export function normalizeExpression(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/\*\*/g, "^")
    .replace(/[−–]/g, "-")
    .replace(/[·×⋅]/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, "pi")
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*([a-zA-Z0-9.]+)/g, "sqrt($1)")
    .replace(/\bAbs\(/g, "abs(")
    // Valor absoluto con barras: |x| → abs(x) (MathLive y la escritura a mano lo usan).
    .replace(/\|([^|]+)\|/g, "abs($1)")
    // Funciones sin paréntesis o con potencia antes del argumento: `sin x`, `sin ^2x`, `ln x`.
    .replace(FN_NO_PARENS, (_m, fn: string, pow: string | undefined, arg: string) => `${fn}(${arg})${pow ? `^${pow}` : ""}`)
    .replace(/\bln\(/g, "log(")
    // `x(x+1)` es multiplicación implícita, no una llamada (mathjs lo leería como función `x`).
    .replace(/([a-zA-Z_][a-zA-Z_0-9]*)\s*\(/g, (m, id: string) => (FUNCTIONS.has(id) ? m : `${id}*(`))
    .trim();
}

export interface CompiledExpression {
  readonly variables: readonly string[];
  evaluate(scope: Readonly<Record<string, number>>): number;
}

/** Compila una expresión validando funciones y símbolos. `allowed` = variables permitidas (`null` = cualquiera). */
export function compileExpression(input: string, allowed: readonly string[] | null = null): CompiledExpression {
  const source = normalizeExpression(input);
  if (!source) throw new ExpressionError("La respuesta está vacía.");
  let node: MathNode;
  try {
    node = math.parse(source);
  } catch {
    throw new ExpressionError("No entendí la expresión. Revisa paréntesis y operadores.");
  }
  const variables = new Set<string>();
  node.traverse((n, path) => {
    if (n.type === "FunctionNode") {
      const name = (n as unknown as { fn: { name?: string } }).fn.name ?? "";
      if (!FUNCTIONS.has(name)) throw new ExpressionError(`No conozco la función «${name}».`);
    } else if (n.type === "SymbolNode" && path !== "fn") {
      const name = (n as unknown as { name: string }).name;
      if (name in CONSTANTS) return;
      if (allowed && !allowed.includes(name)) throw new ExpressionError(`No esperaba la variable «${name}».`);
      variables.add(name);
    } else if (!["OperatorNode", "ConstantNode", "ParenthesisNode", "SymbolNode"].includes(n.type)) {
      throw new ExpressionError("Usa solo números, variables, operaciones y funciones.");
    }
  });
  const code = node.compile();
  return {
    variables: [...variables].sort(),
    evaluate(scope) {
      const value: unknown = code.evaluate({ ...CONSTANTS, ...scope });
      return typeof value === "number" ? value : Number.NaN;
    },
  };
}

/** Valor numérico de una expresión sin variables (`"1/3"`, `"sqrt(2)/2"`, `"0,5"`). */
export function evaluateNumber(input: string | number): number {
  if (typeof input === "number") return input;
  const text = input.trim();
  // Coma decimal: "0,5" o "-3,25" (solo si es un número simple, para no romper `log(x, 2)`).
  const decimalComma = /^[-+]?\d+,\d+$/.test(text) ? text.replace(",", ".") : text;
  const compiled = compileExpression(decimalComma, []);
  return compiled.evaluate({});
}

/** Misma regla que `close()` de verify_content.py: tolerancia absoluta o relativa mínima de 1e-9. */
export function closeEnough(got: number, expected: number, tolerance: number): boolean {
  if (expected === Infinity || expected === -Infinity) return got === expected;
  return Math.abs(got - expected) <= Math.max(tolerance, 1e-9 * Math.max(1, Math.abs(expected)));
}
