import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BackupPanel } from "@/components/settings/backup-panel";
import { SoundToggle } from "@/components/settings/sound-toggle";
import { ChestOddsTable, ReportsPanel, StudyPreferences } from "@/components/settings/study-settings";
import { StorageStatus } from "@/components/settings/storage-status";
import { APP_NAME } from "@/lib/app";

export const metadata: Metadata = { title: `Ajustes · ${APP_NAME}` };

function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border bg-surface p-5 sm:p-6">
      <h2 id={id} className="console-label mb-5">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  return (
    <div className="max-w-3xl">
      <header className="mb-10">
        <p className="console-label">Local-first</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">Ajustes</h1>
        <p className="mt-3 text-ink-2">Tus datos viven solo en este navegador. Desde aquí los cuidas.</p>
      </header>
      <div className="grid gap-6">
        <Panel id="preferencias" title="Preferencias">
          <div className="grid gap-6">
            <SoundToggle />
            <StudyPreferences />
          </div>
        </Panel>
        <Panel id="cofre" title="Probabilidades del cofre">
          <ChestOddsTable />
        </Panel>
        <Panel id="reportes" title="Reportes de contenido">
          <ReportsPanel />
        </Panel>
        <Panel id="datos" title="Tus datos">
          <div className="grid gap-6">
            <StorageStatus />
            <div className="border-t pt-6">
              <BackupPanel />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
