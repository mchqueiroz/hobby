"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHydrated, useLibrary } from "@/lib/store";

export default function Home() {
  const router = useRouter();
  const lib = useLibrary();
  const ready = useHydrated();
  const has = Object.keys(lib.entries).length > 0;
  useEffect(() => {
    if (ready) router.replace(has ? "/descobrir" : "/importar");
  }, [ready, has, router]);
  return <p className="muted" style={{ marginTop: 40 }}>Carregando…</p>;
}
