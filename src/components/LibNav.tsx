"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const TABS = [
  { href: "/biblioteca", label: "Itens" },
  { href: "/diario", label: "Diário" },
  { href: "/lancamentos", label: "Lançamentos" },
  { href: "/listas", label: "Listas" },
  { href: "/estatisticas", label: "Estatísticas" },
];

/** Navegação interna da área Biblioteca. A aba aberta sempre aparece inteira, mesmo em tela estreita. */
export function LibNav({ current }: { current: string }) {
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
    // só mexe na rolagem horizontal da barra, nunca na da página
    if (el && nav.current) nav.current.scrollLeft = el.offsetLeft - (nav.current.clientWidth - el.offsetWidth) / 2;
  }, [current]);
  return (
    <nav className="subnav" aria-label="Biblioteca" ref={nav}>
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === current ? "page" : undefined}>{t.label}</Link>
      ))}
    </nav>
  );
}
