"use client";

import { useRouter } from "next/navigation";
import { loadDemo } from "@/lib/store";

export function DemoButton() {
  const router = useRouter();
  return (
    <button type="button" className="btn ghost" data-testid="cta-demo" onClick={() => { loadDemo(); router.push("/inicio"); }}>
      Ver com dados de exemplo
    </button>
  );
}
