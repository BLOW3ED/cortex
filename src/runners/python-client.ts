"use client";

import type { HarnessResult } from "./python-harness";
import { PY_HARNESS } from "./python-harness";

/**
 * Cliente del worker de Python (Pyodide). Una sola instancia por pestaña; se carga la primera
 * vez que hace falta (~10 MB desde `public/vendor/`, luego queda en caché del navegador).
 * Si un código tarda más que el límite, se termina el worker (corta ciclos infinitos) y el
 * siguiente uso crea otro.
 */

export type PythonRun =
  | { readonly status: "ok"; readonly result: HarnessResult }
  | { readonly status: "timeout"; readonly seconds: number }
  | { readonly status: "unavailable"; readonly message: string };

interface Pending {
  resolve: (msg: { ok: boolean; json?: string; error?: string }) => void;
}

let worker: Worker | null = null;
let loading: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function spawn(): Worker {
  const w = new Worker("/vendor/python-worker.mjs", { type: "module" });
  w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; json?: string; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (p) {
      pending.delete(e.data.id);
      p.resolve(e.data);
    }
  };
  w.onerror = (e) => {
    for (const [id, p] of pending) {
      pending.delete(id);
      p.resolve({ ok: false, error: e.message || "el worker de Python falló" });
    }
  };
  return w;
}

function send(w: Worker, msg: Record<string, unknown>): Promise<{ ok: boolean; json?: string; error?: string }> {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, { resolve });
    w.postMessage({ ...msg, id });
  });
}

function kill(): void {
  worker?.terminate();
  worker = null;
  loading = null;
  for (const [id, p] of pending) {
    pending.delete(id);
    p.resolve({ ok: false, error: "terminado" });
  }
}

/** Carga Pyodide (si no está cargado). Se puede llamar de antemano para ganar tiempo. */
export function warmPython(): Promise<void> {
  if (!worker) worker = spawn();
  if (!loading) {
    const w = worker;
    loading = send(w, { type: "init", harness: PY_HARNESS }).then((r) => {
      if (!r.ok) {
        kill();
        throw new Error(r.error ?? "no se pudo cargar Python");
      }
    });
  }
  return loading;
}

export function pythonLoaded(): boolean {
  return worker !== null && loading !== null;
}

/** Ejecuta `code` y evalúa `exprs`. El límite de tiempo cuenta solo la ejecución, no la carga. */
export async function runPython(code: string, exprs: readonly string[], timeoutMs = 6000): Promise<PythonRun> {
  try {
    await warmPython();
  } catch (e) {
    return { status: "unavailable", message: e instanceof Error ? e.message : String(e) };
  }
  const w = worker;
  if (!w) return { status: "unavailable", message: "no hay worker de Python" };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  const r = await Promise.race([send(w, { type: "run", code, exprs: [...exprs] }), timeout]);
  clearTimeout(timer);
  if (r === "timeout") {
    kill();
    return { status: "timeout", seconds: Math.round(timeoutMs / 1000) };
  }
  if (!r.ok || !r.json) return { status: "unavailable", message: r.error ?? "sin respuesta" };
  return { status: "ok", result: JSON.parse(r.json) as HarnessResult };
}
