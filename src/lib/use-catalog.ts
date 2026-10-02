"use client";

import { useEffect, useState } from "react";
import type { StudyCatalog } from "@/content/core/study-catalog";

let pending: Promise<StudyCatalog> | null = null;

/** Pide `/catalogo.json` una sola vez por pestaña. */
export function loadCatalog(): Promise<StudyCatalog> {
  if (!pending) {
    pending = fetch("/catalogo.json").then(
      async (r) => {
        if (!r.ok) throw new Error(`No pude cargar el contenido (HTTP ${r.status}).`);
        return (await r.json()) as StudyCatalog;
      },
      (e: unknown) => {
        pending = null;
        throw e;
      },
    );
  }
  return pending;
}

export type CatalogState = { status: "loading" } | { status: "ready"; catalog: StudyCatalog } | { status: "error"; error: Error };

export function useCatalog(): CatalogState {
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    loadCatalog().then(
      (catalog) => alive && setState({ status: "ready", catalog }),
      (e: unknown) => {
        pending = null;
        if (alive) setState({ status: "error", error: e instanceof Error ? e : new Error(String(e)) });
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
