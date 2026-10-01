"use client";

import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { type CortexDb, DbClosedError, getDb } from "./db";
import type { ProfileRecord } from "./types";

export type DbState =
  | { status: "loading" }
  | { status: "ready"; db: CortexDb }
  | { status: "error"; error: Error };

/**
 * Abre la base local al montar. En el servidor y en el primer render siempre es `loading`. Si la
 * conexión se cierra (otra pestaña o el navegador cambió o borró la base), pasa a `error` con
 * `DbClosedError`: sin `autoOpen` ya no se reabre sola, así que hay que recargar.
 */
export function useCortexDb(): DbState {
  const [state, setState] = useState<DbState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    let opened: CortexDb | null = null;
    const onClose = () => {
      if (alive) setState({ status: "error", error: new DbClosedError() });
    };
    getDb().then(
      (db) => {
        if (!alive) return;
        opened = db;
        db.on("close", onClose);
        setState(db.isOpen() ? { status: "ready", db } : { status: "error", error: new DbClosedError() });
      },
      (error: unknown) => alive && setState({ status: "error", error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      alive = false;
      opened?.on("close").unsubscribe(onClose);
    };
  }, []);
  return state;
}

/** Lee el perfil para `useLiveQuery`; con la base ya cerrada da `undefined` en vez de romper el render. */
async function readProfile(db: CortexDb | null): Promise<ProfileRecord | undefined> {
  if (!db?.isOpen()) return undefined;
  try {
    return await db.profile.get(1);
  } catch (e) {
    if (e instanceof Dexie.DatabaseClosedError) return undefined;
    throw e;
  }
}

/** Perfil en vivo de una base ya abierta (se actualiza solo cuando cambia en IndexedDB). */
export function useProfileRecord(db: CortexDb | null): ProfileRecord | undefined {
  return useLiveQuery(() => readProfile(db), [db]);
}

export type ProfileState =
  | { status: "loading" }
  | { status: "ready"; profile: ProfileRecord }
  | { status: "error"; error: Error };

/** Perfil en vivo, con el estado de la base. */
export function useProfile(): ProfileState {
  const db = useCortexDb();
  const profile = useProfileRecord(db.status === "ready" ? db.db : null);
  if (db.status === "error") return db;
  if (!profile) return { status: "loading" };
  return { status: "ready", profile };
}
