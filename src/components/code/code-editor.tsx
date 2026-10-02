"use client";

import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { drawSelection, EditorView, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef } from "react";

/**
 * Editor de código (CodeMirror 6, docs/02). Colores del sistema visual (tokens CSS, ambos temas).
 * `Tab` indenta; para salir del editor con teclado: `Esc` y luego `Tab`. `Ctrl/Cmd + Enter` envía.
 */

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.modifier], color: "var(--info)", fontWeight: "600" },
  { tag: [t.string, t.special(t.string), t.character], color: "var(--brand)" },
  { tag: [t.number, t.bool, t.null], color: "var(--xp-text)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--muted)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: "var(--streak)" },
  { tag: [t.typeName, t.standard(t.typeName)], color: "var(--life)" },
  { tag: [t.processingInstruction, t.meta], color: "var(--warning)" },
]);

const theme = EditorView.theme({
  "&": { backgroundColor: "var(--surface-2)", color: "var(--ink)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)", fontSize: "0.9rem" },
  "&.cm-focused": { outline: "2px solid var(--ring)", outlineOffset: "2px" },
  ".cm-content": { fontFamily: "var(--font-mono)", caretColor: "var(--brand)", padding: "0.5rem 0" },
  ".cm-gutters": { backgroundColor: "var(--surface)", color: "var(--muted)", border: "none", borderRight: "1px solid var(--border)", borderRadius: "var(--radius-md) 0 0 var(--radius-md)" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--brand) 7%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--ink)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--brand) 25%, transparent) !important" },
  ".cm-cursor": { borderLeftColor: "var(--brand)" },
  ".cm-scroller": { overflow: "auto", maxHeight: "28rem" },
});

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  onSubmit,
  label,
  minLines = 6,
}: {
  value: string;
  onChange?: (code: string) => void;
  language: "python" | "c";
  readOnly?: boolean;
  onSubmit?: () => void;
  label: string;
  minLines?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const handlers = useRef({ onChange, onSubmit });
  const editable = useRef(new Compartment());
  useEffect(() => {
    handlers.current = { onChange, onSubmit };
  });

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          highlightActiveLine(),
          indentUnit.of("    "),
          EditorState.tabSize.of(4),
          language === "python" ? python() : cpp(),
          syntaxHighlighting(highlight),
          theme,
          editable.current.of([EditorView.editable.of(!readOnly), EditorState.readOnly.of(readOnly)]),
          keymap.of([
            // Ctrl+Enter en todas partes; en Mac también Cmd+Enter (Mod).
            { key: "Mod-Enter", run: () => (handlers.current.onSubmit?.(), true) },
            { key: "Ctrl-Enter", run: () => (handlers.current.onSubmit?.(), true) },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) handlers.current.onChange?.(u.state.doc.toString());
          }),
          EditorView.contentAttributes.of({ "aria-label": label, spellcheck: "false", autocapitalize: "off" }),
          EditorView.theme({ ".cm-content": { minHeight: `${minLines * 1.45}em` } }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // El editor se crea una vez; el contenido externo se sincroniza abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, label]);

  // Si el valor cambia desde fuera (reiniciar a la plantilla), se reemplaza el documento.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: editable.current.reconfigure([EditorView.editable.of(!readOnly), EditorState.readOnly.of(readOnly)]) });
  }, [readOnly]);

  return <div ref={host} className="min-w-0" />;
}
