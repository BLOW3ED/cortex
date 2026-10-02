import type { Metadata } from "next";
import { ReviewPageClient } from "@/components/pages/study-pages";
import { APP_NAME } from "@/lib/app";

export const metadata: Metadata = { title: `Repaso · ${APP_NAME}` };

export default function ReviewPage() {
  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <p className="console-label">Repaso espaciado (FSRS)</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.03em]">Repaso</h1>
        <p className="mt-2 text-ink-2">Las tarjetas vencidas, primero las que fallaste con mucha confianza y de fácil a difícil.</p>
      </header>
      <ReviewPageClient />
    </div>
  );
}
