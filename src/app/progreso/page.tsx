import type { Metadata } from "next";
import { ProgressClient } from "@/components/pages/insight-pages";
import { APP_NAME } from "@/lib/app";

export const metadata: Metadata = { title: `Progreso · ${APP_NAME}` };

export default function ProgressPage() {
  return (
    <div className="max-w-5xl">
      <header className="mb-8">
        <p className="console-label">Compites contra ti</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.03em]">Progreso</h1>
      </header>
      <ProgressClient />
    </div>
  );
}
