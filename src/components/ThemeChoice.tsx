"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, readTheme, subscribeTheme, type Theme } from "@/lib/theme";
import { Chips } from "./ui";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "auto", label: "Automático" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];

export function ThemeChoice() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "auto" as Theme);
  return (
    <>
      <p className="label">Aparência</p>
      <Chips label="Aparência" options={OPTIONS} value={theme} onChange={applyTheme} />
    </>
  );
}
