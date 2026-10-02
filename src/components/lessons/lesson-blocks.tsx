import type { ReactNode } from "react";
import { splitBlanks } from "@/content/core/blanks";
import { InlineMarkdown } from "./inline-markdown";
import { FadedInteractive, PredictInteractive } from "./lesson-interactive";

/*
 * Componentes de lección (docs/05). Los textos de los atributos se dibujan en el servidor
 * (Markdown + KaTeX); `<Predice>` y `<Desvanecido>` son interactivos desde la Fase 1 (su estado vive
 * en `lesson-interactive.tsx`). Sus props las valida el compilador contra LESSON_API.
 */

function Block({ kind, label, title, children }: { kind: string; label: string; title?: string; children: ReactNode }) {
  return (
    <section className="lesson-block" data-kind={kind}>
      <header className="lesson-block-head">
        <span className="lesson-block-label">{label}</span>
        {title ? (
          <span className="lesson-block-title">
            <InlineMarkdown text={title} inline />
          </span>
        ) : null}
      </header>
      <div className="lesson-block-body">{children}</div>
    </section>
  );
}

export function PredictPrompt({ pregunta, revela }: { pregunta: string; revela?: string }) {
  return (
    <Block kind="predice" label="Predice">
      <InlineMarkdown text={pregunta} />
      <PredictInteractive reveal={revela ? <InlineMarkdown text={revela} /> : null} />
    </Block>
  );
}

export function ConceptBox({ titulo, children }: { titulo?: string; children?: ReactNode }) {
  return (
    <Block kind="concepto" label="Concepto" title={titulo}>
      {children}
    </Block>
  );
}

export function WorkedExample({ titulo, children }: { titulo?: string; children?: ReactNode }) {
  return (
    <Block kind="ejemplo" label="Ejemplo resuelto" title={titulo}>
      {children}
    </Block>
  );
}

export function FadedExample({
  titulo,
  pasos,
  respuestas = [],
}: {
  titulo?: string;
  pasos: readonly string[];
  respuestas?: readonly string[];
}) {
  const steps = pasos.map((paso) => splitBlanks(paso).map((part, i) => (part ? <InlineMarkdown key={i} text={part} inline /> : null)));
  return (
    <Block kind="desvanecido" label="Ahora tú completas" title={titulo}>
      <FadedInteractive steps={steps} answers={[...respuestas]} rendered={respuestas.map((r, i) => <InlineMarkdown key={i} text={r} inline />)} />
    </Block>
  );
}

export function Pitfall({ children }: { children?: ReactNode }) {
  return (
    <Block kind="ojo" label="Ojo: error común">
      {children}
    </Block>
  );
}

export function Connection({ materia, children }: { materia?: string; children?: ReactNode }) {
  return (
    <Block kind="conexion" label="Conexión" title={materia}>
      {children}
    </Block>
  );
}

export function Summary({ children }: { children?: ReactNode }) {
  return (
    <Block kind="resumen" label="Resumen">
      {children}
    </Block>
  );
}

export function FeynmanChallenge({ children }: { children?: ReactNode }) {
  return (
    <Block kind="feynman" label="Reto Feynman">
      {children}
    </Block>
  );
}

export function VisualPlaceholder({ id }: { id: string }) {
  return (
    <Block kind="visual" label="Visual interactivo">
      <p>El visual «{id}» llega en una fase posterior.</p>
    </Block>
  );
}
