import { checkRequest, compileAndRun, detectSandbox, parseRunBody } from "@/runners/c-runner";

/**
 * Runner de C local (ADR-005). Solo responde con `CORTEX_LOCAL=1`, desde localhost y desde la
 * propia app. GET dice si está disponible; POST compila y ejecuta.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });

export function GET(req: Request) {
  const access = checkRequest(req.headers, "GET");
  if (!access.ok) return json({ enabled: false, message: access.message }, 200);
  return json({ enabled: true, sandbox: detectSandbox() });
}

export async function POST(req: Request) {
  const access = checkRequest(req.headers, "POST");
  if (!access.ok) return json({ error: access.message }, access.status);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  const parsed = parseRunBody(body);
  if (!parsed.ok) return json({ error: parsed.message }, 400);
  try {
    return json(await compileAndRun(parsed.code, parsed.inputs));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "No se pudo ejecutar." }, 500);
  }
}
