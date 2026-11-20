import Link from "next/link";

const TABS = [
  { href: "/biblioteca", label: "Itens" },
  { href: "/diario", label: "Diário" },
  { href: "/listas", label: "Listas" },
  { href: "/estatisticas", label: "Estatísticas" },
];

/** Navegação interna da área Biblioteca. */
export function LibNav({ current }: { current: string }) {
  return (
    <nav className="subnav" aria-label="Biblioteca">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === current ? "page" : undefined}>{t.label}</Link>
      ))}
    </nav>
  );
}
