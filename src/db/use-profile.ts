"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { type CortexDb, getDb } from "./db";
import type { ProfileRecord } from "./types";

export type DbState =
  | { status: "loading" }
  | { status: "ready"; db: CortexDb }
  | { status: "error"; error: Error };

/** Abre la base local al montar. En el servidor y en el primer render siempre es `loading`. */
export function useCortexDb(): DbState {
  const [state, setState] = useState<DbState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    getDb().then(
      (db) => alive && setState({ status: "ready", db }),
      (error: unknown) => alive && setState({ status: "error", error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export type ProfileState =
  | { status: "loading" }
  | { status: "ready"; profile: ProfileRecord }
  | { status: "error"; error: Error };

/** Perfil en vivo (se actualiza solo cuando cambia en IndexedDB). */
export function useProfile(): ProfileState {
  const db = useCortexDb();
  const ready = db.status === "ready" ? db.db : null;
  const profile = useLiveQuery(() => ready?.profile.get(1), [ready]);
  if (db.status === "error") return db;
  if (!profile) return { status: "loading" };
  return { status: "ready", profile };
}
