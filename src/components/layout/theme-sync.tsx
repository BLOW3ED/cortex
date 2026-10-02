"use client";

import { useEffect } from "react";
import { useCortexDb, useProfileRecord } from "@/db/use-profile";

export const THEME_KEY = "cortex-theme";

/** Aplica el tema guardado en el perfil (oscuro por defecto) y lo copia a localStorage para el próximo arranque. */
export function ThemeSync() {
  const db = useCortexDb();
  const profile = useProfileRecord(db.status === "ready" ? db.db : null);
  const theme = profile?.preferences.theme;
  useEffect(() => {
    if (!theme) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Sin localStorage: solo se pierde el arranque instantáneo del tema claro.
    }
  }, [theme]);
  return null;
}

/** Se corre antes de pintar: evita el destello oscuro si elegiste el tema claro. */
export const THEME_BOOT = `try{if(localStorage.getItem("${THEME_KEY}")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;
