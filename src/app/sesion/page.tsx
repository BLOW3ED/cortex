import type { Metadata } from "next";
import { SessionPageClient } from "@/components/pages/study-pages";
import { APP_NAME } from "@/lib/app";

export const metadata: Metadata = { title: `Sesión de hoy · ${APP_NAME}` };

export default function SessionPage() {
  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <p className="console-label">15–25 min</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.03em]">Sesión de hoy</h1>
      </header>
      <SessionPageClient />
    </div>
  );
}
