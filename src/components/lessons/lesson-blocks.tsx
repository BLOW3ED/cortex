import type { ReactNode } from "react";
import { BLANK } from "@/content/core/lesson-api";
import { InlineMarkdown } from "./inline-markdown";

/*
 * Componentes PROVISIONALES de la Fase 0 (decisión D6): muestran el contenido, sin estado ni
 * interactividad, para que las lecciones carguen. Las versiones interactivas llegan en la Fase 1.
 * Sus props las valida el compilador contra LESSON_API (src/content/core/lesson-api.ts).
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

/** Un paso con huecos `___`: cada hueco se dibuja como un espacio visible para completar. */
function StepWithBlanks({ text }: { text: string }) {
  const parts = text.split(BLANK);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part ? <InlineMarkdown text={part} inline /> : null}
          {i < parts.length - 1 ? (
            <span className="lesson-blank" role="img" aria-label="hueco por completar">
              {"  "}
            </span>
          ) : null}
        </span>
      ))}
    </>
  );
}

export function PredictPrompt({ pregunta, revela }: { pregunta: string; revela?: string }) {
  return (
    <Block kind="predice" label="Predice">
      <InlineMarkdown text={pregunta} />
      {revela ? (
        <details>
          <summary>Ver la idea</summary>
          <InlineMarkdown text={revela} />
        </details>
      ) : null}
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
  return (
    <Block kind="desvanecido" label="Ahora tú completas" title={titulo}>
      <ol className="lesson-steps">
        {pasos.map((paso, i) => (
          <li key={i}>
            <StepWithBlanks text={paso} />
          </li>
        ))}
      </ol>
      {respuestas.length ? (
        <details>
          <summary>Ver respuestas</summary>
          <ol className="lesson-steps">
            {respuestas.map((r, i) => (
              <li key={i}>
                <InlineMarkdown text={r} inline />
              </li>
            ))}
          </ol>
        </details>
      ) : null}
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
