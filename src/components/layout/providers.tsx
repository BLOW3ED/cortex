"use client";

import type { ReactNode } from "react";
import { CelebrationProvider } from "@/components/study/celebrations";
import { ThemeSync } from "./theme-sync";

/** Proveedores de cliente de toda la app: celebraciones y tema. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <CelebrationProvider>
      <ThemeSync />
      {children}
    </CelebrationProvider>
  );
}
