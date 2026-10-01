import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HudBar } from "@/components/hud/hud-bar";
import { Lives } from "@/components/hud/lives";
import { StreakChip } from "@/components/hud/streak-chip";
import { XpBar } from "@/components/hud/xp-bar";
import { InlineMarkdown } from "@/components/lessons/inline-markdown";
import { ConceptBox, FadedExample, Pitfall, PredictPrompt } from "@/components/lessons/lesson-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { APP_NAME } from "@/lib/app";

export const metadata: Metadata = { title: `Sistema visual · ${APP_NAME}` };

const SWATCHES = [
  ["bg", "fondo"],
  ["surface", "superficie"],
  ["surface-2", "superficie 2"],
  ["border-strong", "borde fuerte"],
  ["ink", "tinta"],
  ["ink-2", "tinta 2"],
  ["muted", "apagado"],
  ["brand", "acento (menta)"],
  ["xp", "XP"],
  ["streak", "racha"],
  ["life", "vida"],
  ["warning", "aviso"],
  ["info", "info"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-14 first:mt-0">
      <h2 id={id} className="console-label mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatches() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {SWATCHES.map(([token, label]) => (
        <li key={token} className="overflow-hidden rounded-md border bg-surface">
          <div className="h-12 border-b" style={{ background: `var(--${token})` }} />
          <div className="px-2.5 py-2">
            <p className="text-xs font-medium">{label}</p>
            <p className="font-mono text-[0.6875rem] text-muted-foreground">--{token}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Controls() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Empezar sesión</Button>
      <Button variant="secondary">Secundario</Button>
      <Button variant="outline">Contorno</Button>
      <Button variant="ghost">Fantasma</Button>
      <Button variant="destructive">Reemplazar datos</Button>
      <Button disabled>Deshabilitado</Button>
      <Badge>Backlog</Badge>
      <Badge variant="brand">Con contenido</Badge>
      <Badge variant="xp">+25 XP</Badge>
      <Badge variant="streak">Racha 4</Badge>
      <Badge variant="outline">Fase 3</Badge>
      <label className="flex items-center gap-2 text-sm">
        <Switch aria-label="Sonido" /> Sonido
      </label>
    </div>
  );
}

export default function StylePage() {
  return (
    <div>
      <header className="mb-12">
        <p className="console-label">Fase 0 · catálogo vivo</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">Sistema visual</h1>
        <p className="mt-3 max-w-2xl text-ink-2">
          Consola de laboratorio para leer; física de arcade para lo que se toca o se gana. Los colores cumplen
          contraste AA en ambos temas (lo revisa <code className="font-mono text-sm">src/styles/tokens.test.ts</code>) y
          todo movimiento se apaga con «reducir movimiento».
        </p>
      </header>

      <Section id="tokens-oscuro" title="Tokens · tema oscuro (por defecto)">
        <Swatches />
      </Section>

      <Section id="tokens-claro" title="Tokens · tema claro (el interruptor llega en la Fase 1)">
        <div className="theme-light rounded-xl border bg-background p-4 text-foreground sm:p-6">
          <Swatches />
          <div className="mt-6">
            <Controls />
          </div>
        </div>
      </Section>

      <Section id="tipografia" title="Tipografía · Geist Sans + Geist Mono">
        <div className="grid gap-5">
          <p className="font-mono text-6xl font-semibold tracking-tight tabular-nums">
            1,240<span className="ml-2 align-top text-base text-xp">XP</span>
          </p>
          <p className="text-5xl font-extrabold tracking-[-0.03em]">Domina el límite</p>
          <p className="text-2xl font-bold tracking-[-0.02em]">Encabezado de sección</p>
          <p className="text-lg font-semibold">Encabezado menor</p>
          <p className="max-w-[68ch] text-[1.0625rem] leading-[1.7]">
            Texto de lección: 17 px con interlineado amplio y líneas de ~68 caracteres para leer 20 minutos sin cansarse.
          </p>
          <p className="text-sm text-muted-foreground">Texto secundario y ayudas.</p>
          <p className="console-label">Etiqueta de consola</p>
        </div>
      </Section>

      <Section id="controles" title="Controles">
        <Controls />
      </Section>

      <Section id="hud" title="HUD · estados límite (los números los calcula la Fase 1)">
        <div className="grid gap-4">
          {(
            [
              ["Cargando", null],
              ["Recién creado", { xpTotal: 0, level: 1, currentStreak: 0, levelProgress: 0 }],
              ["A media semana", { xpTotal: 1240, level: 5, currentStreak: 4, levelProgress: 0.45 }],
              ["Nivel casi lleno", { xpTotal: 98_760, level: 38, currentStreak: 120, levelProgress: 0.97 }],
            ] as const
          ).map(([label, data]) => (
            <div key={label} className="flex flex-wrap items-center gap-6 rounded-lg border bg-surface px-4 py-3">
              <span className="w-36 text-sm text-ink-2">{label}</span>
              <HudBar data={data} />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-6 rounded-lg border bg-surface px-4 py-3">
            <span className="w-36 text-sm text-ink-2">Barra de XP</span>
            <XpBar progress={0.62} className="h-4" />
            <StreakChip days={1} />
            <Lives current={3} max={3} />
            <Lives current={1} max={3} />
            <Lives current={0} max={3} />
          </div>
        </div>
      </Section>

      <Section id="tarjetas" title="Tarjetas">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Panel de consola</CardTitle>
              <CardDescription>Para leer: borde de 1 px, sin sombra.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-ink-2">El contenido respira; el acento aparece poco y con intención.</CardContent>
          </Card>
          <Card className="arcade border-2 border-border-strong">
            <CardHeader>
              <CardTitle>Objeto arcade</CardTitle>
              <CardDescription>Para tocar: sombra sólida desplazada.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-ink-2">Se usa en lo que tiene acción: materias con contenido, botones, el HUD.</CardContent>
          </Card>
        </div>
      </Section>

      <Section id="bloques" title="Bloques de lección">
        <div className="lesson-prose">
          <PredictPrompt pregunta="¿A qué número se acerca $\dfrac{x^2-9}{x-3}$ cuando $x \to 3$?" revela="A 6: factoriza y cancela." />
          <ConceptBox titulo="Límite">
            <InlineMarkdown text="Lo que importa es lo que pasa **cerca** de $a$, no **en** $a$." />
          </ConceptBox>
          <FadedExample titulo="Racionalizar" pasos={["Multiplica por el conjugado.", "El numerador queda ___ ."]} respuestas={["x-1"]} />
          <Pitfall>
            <InlineMarkdown text="$0/0$ no es un número: es una señal de que hay que trabajar más." />
          </Pitfall>
        </div>
      </Section>
    </div>
  );
}
