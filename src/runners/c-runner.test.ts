import { readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { C_LIMITS, checkRequest, compileAndRun, detectSandbox, gccAvailable, parseRunBody, runnerEnabled } from "./c-runner";

const HAS_GCC = gccAvailable();
const leftovers = () => readdirSync(tmpdir()).filter((f) => f.startsWith("cortex-c-"));

describe.skipIf(!HAS_GCC)("runner de C (gcc local)", () => {
  it("compila y ejecuta con cada entrada", async () => {
    const before = leftovers().length;
    const r = await compileAndRun('#include <stdio.h>\nint main(void){int a,b; if(scanf("%d %d",&a,&b)!=2) return 1; printf("%d\\n", a+b); return 0;}\n', ["3 4\n", "-5 5\n"]);
    expect(r.compile.ok).toBe(true);
    expect(r.runs.map((x) => x.stdout)).toEqual(["7\n", "0\n"]);
    expect(r.runs.every((x) => x.exitCode === 0 && !x.timedOut && !x.truncated)).toBe(true);
    expect(leftovers().length).toBe(before); // la carpeta temporal se borra
  });

  it("reporta errores de compilación sin la ruta temporal", async () => {
    const r = await compileAndRun("int main(void) { return x; }\n", [""]);
    expect(r.compile.ok).toBe(false);
    expect(r.compile.output).toMatch(/x/);
    expect(r.compile.output).not.toMatch(/cortex-c-/);
    expect(r.runs).toEqual([]);
  });

  it("corta un ciclo infinito por tiempo", async () => {
    const t = Date.now();
    const r = await compileAndRun("int main(void) { for (;;) {} }\n", [""]);
    expect(r.runs[0]?.timedOut).toBe(true);
    expect(Date.now() - t).toBeLessThan(C_LIMITS.runMs + 8000);
  }, 20_000);

  it("corta una salida enorme", async () => {
    const r = await compileAndRun('#include <stdio.h>\nint main(void) { for (;;) puts("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"); }\n', [""]);
    expect(r.runs[0]?.truncated).toBe(true);
    expect((r.runs[0]?.stdout.length ?? 0)).toBeLessThanOrEqual(C_LIMITS.outputBytes);
  }, 20_000);

  it.skipIf(detectSandbox() === "ninguno")("sin red y sin escribir fuera de su carpeta; dentro sí", async () => {
    const code = `#include <stdio.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
int main(void) {
  int s = socket(AF_INET, SOCK_STREAM, 0);
  struct sockaddr_in a = {0}; a.sin_family = AF_INET; a.sin_port = htons(80);
  inet_pton(AF_INET, "1.1.1.1", &a.sin_addr);
  printf("red=%d\\n", s < 0 ? -1 : connect(s, (struct sockaddr *)&a, sizeof a));
  FILE *f = fopen("/tmp/cortex-escape-test.txt", "w");
  printf("fuera=%s\\n", f ? "si" : "no");
  FILE *g = fopen("local.txt", "w");
  if (g) { fputs("ok", g); fclose(g); }
  g = fopen("local.txt", "r");
  char b[4] = {0};
  if (g) { fgets(b, 4, g); fclose(g); }
  printf("dentro=%s\\n", b);
  return 0;
}
`;
    const r = await compileAndRun(code, [""]);
    expect(r.compile.ok).toBe(true);
    expect(r.runs[0]?.stdout).toBe("red=-1\nfuera=no\ndentro=ok\n");
  });
});

describe("candados del runner (ADR-005)", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  const ok = { host: "localhost:3000", "x-cortex-runner": "1", origin: "http://localhost:3000", "sec-fetch-site": "same-origin", "content-type": "application/json" };
  const on = { CORTEX_LOCAL: "1" } as unknown as NodeJS.ProcessEnv;

  it("solo con CORTEX_LOCAL=1", () => {
    expect(runnerEnabled({} as NodeJS.ProcessEnv).ok).toBe(false);
    expect(checkRequest(h(ok), "POST", {} as NodeJS.ProcessEnv)).toMatchObject({ ok: false, status: 403 });
    expect(checkRequest(h(ok), "POST", on)).toEqual({ ok: true });
  });

  it.each([
    ["host de red (DNS rebinding)", { ...ok, host: "evil.example:3000" }],
    ["IP de la red local", { ...ok, host: "192.168.1.5:3000" }],
    ["sin encabezado propio", { ...ok, "x-cortex-runner": "" }],
    ["otro origen", { ...ok, origin: "http://evil.example" }],
    ["petición entre sitios", { ...ok, "sec-fetch-site": "cross-site" }],
    ["sin JSON", { ...ok, "content-type": "text/plain" }],
  ])("rechaza %s", (_name, headers) => {
    expect(checkRequest(h(headers), "POST", on).ok).toBe(false);
  });

  it("acepta 127.0.0.1 y [::1]", () => {
    expect(checkRequest(h({ ...ok, host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }), "POST", on).ok).toBe(true);
    expect(checkRequest(h({ ...ok, host: "[::1]:3000", origin: "http://[::1]:3000" }), "POST", on).ok).toBe(true);
  });

  it("valida el cuerpo y sus límites", () => {
    expect(parseRunBody({ code: "int main(){}", inputs: [""] }).ok).toBe(true);
    expect(parseRunBody({ code: "", inputs: [""] }).ok).toBe(false);
    expect(parseRunBody({ code: "x", inputs: [] }).ok).toBe(false);
    expect(parseRunBody({ code: "x", inputs: [1] }).ok).toBe(false);
    expect(parseRunBody({ code: "x".repeat(C_LIMITS.codeBytes + 1), inputs: [""] }).ok).toBe(false);
    expect(parseRunBody({ code: "x", inputs: Array(C_LIMITS.inputs + 1).fill("") }).ok).toBe(false);
    expect(parseRunBody(null).ok).toBe(false);
  });
});
