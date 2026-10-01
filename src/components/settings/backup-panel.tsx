"use client";

import { Download, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  backupFileName,
  backupSizeError,
  type BackupSummary,
  exportBackup,
  importBackup,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  summarizeDb,
  utf8ByteLength,
} from "@/db/backup";
import type { Backup } from "@/db/backup-schema";
import { type CortexDb, DbClosedElsewhereError, FutureSchemaError, getDb } from "@/db/db";
import { DATA_TABLES, type DataTableName } from "@/db/schema";
import { useCortexDb } from "@/db/use-profile";
import { APP_NAME, APP_VERSION } from "@/lib/app";
import { downloadText } from "@/lib/download";

const TABLE_LABELS: Record<DataTableName, string> = {
  profile: "Perfil",
  unitProgress: "Progreso por unidad",
  attempts: "Intentos",
  cards: "Tarjetas de repaso",
  sessions: "Sesiones",
  missions: "Misiones",
  records: "Récords",
  ghosts: "Fantasmas",
  achievements: "Logros",
  gymResults: "Gimnasio",
  mistakes: "Cuaderno de errores",
  reports: "Reportes",
};

const formatDate = (iso: string) => new Date(iso).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" });

interface Pending {
  readonly backup: Backup;
  readonly summary: BackupSummary;
  readonly current: Readonly<Record<DataTableName, number>>;
  readonly fileName: string;
}

/** Exportar e importar el respaldo JSON (ADR-015). Importar reemplaza todo, tras confirmar (D7). */
export function BackupPanel() {
  const inputId = useId();
  const db = useCortexDb();
  const ready: CortexDb | null = db.status === "ready" ? db.db : null;
  const input = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const errorsRef = useRef<HTMLDivElement>(null);
  // Se confirmó el reemplazo: el botón que abrió el diálogo va a desaparecer, así que Radix no
  // debe devolverle el foco; lo recibe el resultado (aviso de estado o de error).
  const confirmed = useRef(false);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [focusAfterImport, setFocusAfterImport] = useState<{ target: "status" | "errors" } | null>(null);

  useEffect(() => {
    if (!focusAfterImport) return;
    (focusAfterImport.target === "status" ? statusRef : errorsRef).current?.focus();
  }, [focusAfterImport]);

  if (db.status === "error") {
    return (
      <div role="alert" className="rounded-lg border border-warning p-4 text-sm">
        <p className="font-semibold text-warning">
          {db.error instanceof FutureSchemaError
            ? `Tus datos son de una versión más nueva de ${APP_NAME}`
            : db.error instanceof DbClosedElsewhereError
              ? "Otra pestaña cambió tus datos"
              : "No pude abrir tus datos"}
        </p>
        <p className="mt-1 text-ink-2">{db.error.message}</p>
      </div>
    );
  }

  // Los manejadores piden la base a getDb() (misma promesa compartida): así no dependen de un
  // render anterior en el que todavía no estaba lista.
  const download = async () => {
    try {
      const name = backupFileName();
      const text = serializeBackup(await exportBackup(await getDb(), APP_VERSION));
      downloadText(name, text);
      // Nunca un respaldo "exitoso" que luego no se pueda importar sin que lo sepas.
      const tooBig = backupSizeError(utf8ByteLength(text));
      setStatus(
        tooBig
          ? `Respaldo descargado: ${name}. Ojo: ${tooBig} Guárdalo y pide que se suba el límite antes de importarlo.`
          : `Respaldo descargado: ${name}`,
      );
    } catch (e) {
      setErrors([`No se pudo descargar el respaldo: ${e instanceof Error ? e.message : String(e)}`]);
    }
  };

  const choose = async (file: File | undefined) => {
    setErrors([]);
    setPending(null);
    setStatus("");
    if (!file) return;
    // El tamaño se revisa antes de leer: un archivo enorme ni siquiera se carga en memoria.
    const tooBig = backupSizeError(file.size);
    if (tooBig) {
      setErrors([tooBig]);
      return;
    }
    try {
      const parsed = parseBackup(await file.text());
      if (!parsed.ok) {
        setErrors(parsed.errors);
        return;
      }
      const current = await summarizeDb(await getDb());
      setPending({ backup: parsed.backup, summary: summarizeBackup(parsed.backup), current, fileName: file.name });
      setStatus(`Respaldo listo para revisar: ${file.name}. Compara abajo y confirma si quieres reemplazar.`);
    } catch (e) {
      setErrors([`No pude leer ese archivo: ${e instanceof Error ? e.message : String(e)}`]);
    }
  };

  const replace = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await importBackup(await getDb(), pending.backup);
      setStatus(`Listo: tus datos se restauraron · respaldo del ${formatDate(pending.summary.exportedAt)}`);
      setPending(null);
      setFileName("");
      if (input.current) input.current.value = "";
      setFocusAfterImport({ target: "status" });
    } catch (e) {
      setErrors([`No se pudo importar y tus datos quedaron como estaban: ${e instanceof Error ? e.message : String(e)}`]);
      setFocusAfterImport({ target: "errors" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="font-semibold">Descargar respaldo</p>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Un archivo JSON con todo tu progreso. Guárdalo donde quieras; nada sale de tu máquina.
          </p>
        </div>
        <Button onClick={() => void download()} disabled={!ready}>
          <Download aria-hidden /> Descargar respaldo
        </Button>
      </div>

      <div className="border-t pt-6">
        <label htmlFor={inputId} className="font-semibold">
          Importar respaldo
        </label>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Reemplaza <strong className="text-ink">todos</strong> tus datos por los del archivo. Antes te muestro qué trae y te pido
          confirmación.
        </p>
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-3">
          {/* El input nativo queda accesible (enfocable con Tab) pero oculto; el botón visible es su etiqueta en español. */}
          <input
            ref={input}
            id={inputId}
            type="file"
            accept=".json,application/json"
            disabled={!ready}
            onChange={(e) => {
              setFileName(e.target.files?.[0]?.name ?? "");
              void choose(e.target.files?.[0]);
            }}
            className="peer sr-only"
          />
          <label
            htmlFor={inputId}
            aria-hidden
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-surface-2 px-3 text-sm font-semibold hover:bg-surface-3 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ring)]"
          >
            <Upload aria-hidden className="size-4" /> Elegir archivo…
          </label>
          <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{fileName || "Ningún archivo elegido"}</span>
        </div>
      </div>

      {errors.length ? (
        <div ref={errorsRef} tabIndex={-1} role="alert" className="rounded-lg border border-danger p-4 text-sm outline-offset-4">
          <p className="font-semibold text-danger">Ese archivo no se puede importar. Tus datos no cambiaron.</p>
          <ul className="mt-2 list-disc pl-5 text-ink-2">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {pending ? (
        <section aria-labelledby="resumen-respaldo" className="min-w-0 rounded-lg border-2 border-border-strong bg-surface-2 p-4">
          <h3 id="resumen-respaldo" className="font-semibold">
            {pending.fileName}
          </h3>
          <p className="mt-1 text-sm text-ink-2">
            Respaldo del {formatDate(pending.summary.exportedAt)} · nivel {pending.summary.level} · {pending.summary.xpTotal} XP
          </p>
          <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Registros por tabla: ahora y en el respaldo</caption>
            <thead>
              <tr className="text-left font-mono text-[0.6875rem] tracking-[0.12em] text-muted-foreground uppercase">
                <th scope="col" className="py-1 font-medium">Tabla</th>
                <th scope="col" className="py-1 pl-3 text-right font-medium">Ahora</th>
                <th scope="col" className="py-1 pl-3 text-right font-medium">Respaldo</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {DATA_TABLES.map((t) => (
                <tr key={t} className="border-t">
                  <th scope="row" className="py-1 text-left font-sans font-normal">
                    {TABLE_LABELS[t]}
                  </th>
                  <td className="py-1 pl-3 text-right">{pending.current[t]}</td>
                  <td className="py-1 pl-3 text-right">{pending.summary.counts[t]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="mt-4 h-auto min-h-9 py-2 whitespace-normal"
                disabled={busy}
                onClick={() => {
                  confirmed.current = false;
                }}
              >
                Reemplazar mis datos con este respaldo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent
              // Tras confirmar, el botón que abrió el diálogo desaparece: el foco va al aviso de estado.
              onCloseAutoFocus={(e) => {
                if (confirmed.current) e.preventDefault();
              }}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>¿Reemplazar todos tus datos?</AlertDialogTitle>
                <AlertDialogDescription>
                  Lo que tienes ahora se sustituye por el respaldo hecho el {formatDate(pending.summary.exportedAt)} · si algo falla a
                  la mitad, nada cambia
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Button variant="outline" className="h-auto min-h-9 py-2 whitespace-normal" onClick={() => void download()}>
                <Download aria-hidden /> Descargar mis datos actuales primero
              </Button>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    confirmed.current = true;
                    void replace();
                  }}
                >
                  Sí, reemplazar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      ) : null}

      <p ref={statusRef} tabIndex={-1} aria-live="polite" role="status" className="text-sm text-brand outline-offset-4">
        {status}
      </p>
    </div>
  );
}
