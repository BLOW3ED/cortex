"use client";

import type { CRunResponse } from "@/engine/code/types";

/** Cliente del runner de C local (`/api/run-c`, ADR-005). */

export type CStatus = { readonly enabled: true; readonly sandbox: string } | { readonly enabled: false; readonly message: string };

let status: Promise<CStatus> | null = null;

/** ¿Está disponible el runner? (se pregunta una vez por pestaña). */
export function cRunnerStatus(): Promise<CStatus> {
  status ??= fetch("/api/run-c", { cache: "no-store" })
    .then(async (r) => {
      const body = (await r.json()) as { enabled?: boolean; sandbox?: string; message?: string };
      return body.enabled ? { enabled: true as const, sandbox: body.sandbox ?? "?" } : { enabled: false as const, message: body.message ?? "El runner de C no está disponible." };
    })
    .catch(() => ({ enabled: false as const, message: "No pude hablar con el runner de C (¿la app corre con `pnpm dev`?)." }));
  return status;
}

export type CRun = { readonly status: "ok"; readonly response: CRunResponse } | { readonly status: "unavailable"; readonly message: string };

export async function runC(code: string, inputs: readonly string[]): Promise<CRun> {
  const s = await cRunnerStatus();
  if (!s.enabled) return { status: "unavailable", message: s.message };
  try {
    const r = await fetch("/api/run-c", {
      method: "POST",
      headers: { "content-type": "application/json", "x-cortex-runner": "1" },
      body: JSON.stringify({ code, inputs: inputs.length ? inputs : [""] }),
    });
    const body = (await r.json()) as CRunResponse & { error?: string };
    if (!r.ok) return { status: "unavailable", message: body.error ?? `HTTP ${r.status}` };
    return { status: "ok", response: body };
  } catch (e) {
    return { status: "unavailable", message: e instanceof Error ? e.message : String(e) };
  }
}
