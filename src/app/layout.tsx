import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { ProfileHud } from "@/components/hud/profile-hud";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/layout/providers";
import { THEME_BOOT } from "@/components/layout/theme-sync";
import { APP_NAME } from "@/lib/app";
// KaTeX: CSS y fuentes locales (desde node_modules; ninguna red).
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Estudia Ingeniería en IA (IPN, plan 2020) con práctica, repaso y jefes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`dark ${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Tema claro sin destello: se lee de localStorage antes de pintar (ThemeSync lo mantiene). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <Providers>
          <AppShell hud={<ProfileHud />}>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
