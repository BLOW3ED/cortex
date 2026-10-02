"use client";

import { Flag } from "lucide-react";
import { useId, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getDb } from "@/db/db";
import { addReport } from "@/db/progress";
import { cn } from "@/lib/utils";

/**
 * "Reportar problema" (docs/07, capa 5): guarda un comentario en la tabla `reports` para que
 * Carlo los exporte desde Ajustes y Claude Code corrija el contenido.
 */
export function ReportButton({ exerciseId, subtle = false }: { exerciseId: string; subtle?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-ink", subtle && "text-xs")}
      >
        <Flag aria-hidden className="size-3.5" /> {sent ?? "Reportar problema"}
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reportar un problema con {exerciseId}</AlertDialogTitle>
            <AlertDialogDescription>¿Qué está mal? Respuesta equivocada, enunciado ambiguo, error de dedo… Se guarda solo en este navegador.</AlertDialogDescription>
          </AlertDialogHeader>
          <label htmlFor={id} className="sr-only">
            Describe el problema
          </label>
          <textarea id={id} rows={4} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-md border border-input bg-surface px-3 py-2" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!text.trim()}
              onClick={() => {
                const comment = text.trim();
                void getDb()
                  .then((db) => addReport(db, exerciseId, comment, Date.now()))
                  .then(
                    () => setSent("Reporte guardado"),
                    () => setSent("No se pudo guardar el reporte"),
                  );
                setText("");
              }}
            >
              Guardar reporte
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
