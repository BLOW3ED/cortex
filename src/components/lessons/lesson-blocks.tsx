import type { ReactNode } from "react";
import { InlineMarkdown } from "./inline-markdown";

/*
 * Componentes PROVISIONALES de la Fase 0 (decisión D6): muestran el contenido, sin estado ni
 * interactividad, para que las lecciones carguen. Las versiones interactivas llegan en la Fase 1.
 * Los nombres en español (`Predice`, `Concepto`...) son la API del contenido (ver registry.ts).
 */

function Block({ kind, title, children }: { kind: string; title?: ReactNode; children: ReactNode }) {
  return (
    <section className="lesson-block" data-kind={kind}>
      <p className="lesson-block-label">{title}</p>
      <div className="lesson-block-body">{children}</div>
    </section>
  );
}

export function PredictPrompt({ pregunta, revela }: { pregunta: string; revela?: string }) {
  return (
    <Block kind="predice" title="Predice antes de seguir">
      <p>
        <InlineMarkdown text={pregunta} />
      </p>
      {revela ? (
        <details>
          <summary>Ver la idea</summary>
          <p>
            <InlineMarkdown text={revela} />
          </p>
        </details>
      ) : null}
    </Block>
  );
}

export function ConceptBox({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <Block kind="concepto" title={titulo ? <InlineMarkdown text={titulo} /> : "Concepto"}>
      {children}
    </Block>
  );
}

export function WorkedExample({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <Block kind="ejemplo" title={<>Ejemplo resuelto{titulo ? <>: <InlineMarkdown text={titulo} /></> : null}</>}>
      {children}
    </Block>
  );
}

export function FadedExample({
  titulo,
  pasos = [],
  respuestas = [],
}: {
  titulo?: string;
  pasos?: readonly string[];
  respuestas?: readonly (string | number)[];
}) {
  return (
    <Block kind="desvanecido" title={<>Ahora tú completas{titulo ? <>: <InlineMarkdown text={titulo} /></> : null}</>}>
      <ol>
        {pasos.map((paso, i) => (
          <li key={i}>
            <InlineMarkdown text={paso} />
          </li>
        ))}
      </ol>
      {respuestas.length ? (
        <details>
          <summary>Ver respuestas</summary>
          <ol>
            {respuestas.map((r, i) => (
              <li key={i}>
                <InlineMarkdown text={r} />
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </Block>
  );
}

export function Pitfall({ children }: { children: ReactNode }) {
  return (
    <Block kind="ojo" title="Ojo: error común">
      {children}
    </Block>
  );
}

export function Connection({ materia, children }: { materia?: string; children: ReactNode }) {
  return (
    <Block kind="conexion" title={materia ? `Conexión con ${materia}` : "Conexión"}>
      {children}
    </Block>
  );
}

export function Summary({ children }: { children: ReactNode }) {
  return (
    <Block kind="resumen" title="Resumen">
      {children}
    </Block>
  );
}

export function FeynmanChallenge({ children }: { children: ReactNode }) {
  return (
    <Block kind="feynman" title="Reto Feynman">
      {children}
    </Block>
  );
}

export function VisualPlaceholder({ id }: { id: string }) {
  return (
    <Block kind="visual" title="Visual interactivo">
      <p>El visual «{id}» llega en una fase posterior.</p>
    </Block>
  );
}
