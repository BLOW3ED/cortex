"use client";

import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { StudyCatalog } from "@/content/core/study-catalog";
import { type CortexDb, DbClosedError, FutureSchemaError } from "@/db/db";
import { useCortexDb, useProfileRecord } from "@/db/use-profile";
import type { ProfileRecord } from "@/db/types";
import { useCatalog } from "@/lib/use-catalog";

export interface StudyContext {
  readonly db: CortexDb;
  readonly catalog: StudyCatalog;
  readonly profile: ProfileRecord;
}

/** Espera la base local, el catálogo y el perfil; muestra carga o error de forma uniforme. */
export function StudyGate({ children }: { children: (ctx: StudyContext) => ReactNode }) {
  const db = useCortexDb();
  const catalog = useCatalog();
  const profile = useProfileRecord(db.status === "ready" ? db.db : null);
  const error = db.status === "error" ? db.error : catalog.status === "error" ? catalog.error : null;
  if (error) {
    const msg =
      error instanceof FutureSchemaError || error instanceof DbClosedError ? error.message : `No pude abrir tus datos o el contenido: ${error.message}`;
    return (
      <div role="alert" className="flex items-start gap-3 rounded-lg border border-warning p-4 text-warning">
        <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
        <p>{msg}</p>
      </div>
    );
  }
  if (db.status !== "ready" || catalog.status !== "ready" || !profile) {
    return (
      <div aria-busy="true" className="grid gap-3">
        <div className="h-8 w-1/3 animate-pulse rounded-md bg-surface-2" />
        <div className="h-48 animate-pulse rounded-xl bg-surface-2" />
        <span className="sr-only">Cargando…</span>
      </div>
    );
  }
  return <>{children({ db: db.db, catalog: catalog.catalog, profile })}</>;
}
