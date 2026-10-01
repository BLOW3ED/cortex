"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type State = { kind: "loading" } | { kind: "unsupported" } | { kind: "ready"; persisted: boolean; usedMb: number | null };

/**
 * El navegador puede borrar IndexedDB si le falta espacio. Pedir almacenamiento persistente lo
 * evita (docs/02, ADR-001). Solo se pide si Carlo aprieta el botón.
 */
async function readStorage(): Promise<State> {
  if (!navigator.storage?.persisted) return { kind: "unsupported" };
  const [persisted, estimate] = await Promise.all([navigator.storage.persisted(), navigator.storage.estimate?.()]);
  return { kind: "ready", persisted, usedMb: estimate?.usage !== undefined ? estimate.usage / 1048576 : null };
}

export function StorageStatus() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    void readStorage().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);

  const request = async () => {
    const granted = await navigator.storage.persist();
    setMessage(granted ? "Listo: el navegador no borrará tus datos para liberar espacio." : "El navegador no lo concedió; descarga respaldos de vez en cuando.");
    setState(await readStorage());
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-6">
      <div>
        <p className="font-semibold">Almacenamiento</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.kind === "loading" && "Revisando…"}
          {state.kind === "unsupported" && "Este navegador no permite pedir almacenamiento persistente."}
          {state.kind === "ready" &&
            `${state.persisted ? "Persistente: el navegador no lo borrará solo." : "Normal: el navegador podría borrarlo si le falta espacio."}${
              state.usedMb !== null ? ` · ${state.usedMb.toFixed(1)} MB usados` : ""
            }`}
        </p>
        <p aria-live="polite" className="mt-1 text-sm text-ink-2">
          {message}
        </p>
      </div>
      {state.kind === "ready" && !state.persisted ? (
        <Button variant="secondary" size="sm" onClick={() => void request()}>
          Pedir que sea persistente
        </Button>
      ) : null}
    </div>
  );
}
