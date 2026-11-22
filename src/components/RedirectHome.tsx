"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHydrated, useLibrary } from "@/lib/store";

/** Quem já tem registros vai direto para o Início; quem é novo continua vendo a apresentação. */
export function RedirectHome() {
  const router = useRouter();
  const lib = useLibrary();
  const ready = useHydrated();
  const has = Object.keys(lib.entries).length > 0;
  useEffect(() => { if (ready && has) router.replace("/inicio"); }, [ready, has, router]);
  return null;
}
