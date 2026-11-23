"use client";

import { CaretLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { decodeList } from "@/lib/shareList";
import { cacheItem, saveSharedList, useHydrated } from "@/lib/store";
import type { Item } from "@/lib/types";
import { Cover, MediaTag } from "@/components/ui";

/** Lista recebida por link (#d=...). Nada é gravado até a pessoa tocar em "Salvar uma cópia". */
export default function ListaCompartilhada() {
  const router = useRouter();
  const ready = useHydrated();
  const [shared, setShared] = useState<{ name: string; items: Item[] } | null | undefined>(undefined);

  useEffect(() => {
    const d = new URLSearchParams(window.location.hash.slice(1)).get("d");
    // o fragmento só existe no navegador: ler aqui (e não no render) evita diferença com o HTML do servidor
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShared(d ? decodeList(d) : null);
  }, []);

  if (!ready || shared === undefined) return null;
  if (!shared) {
    return (
      <div className="empty">
        <h2>Link de lista inválido</h2>
        <p>O link pode ter sido cortado ao copiar. Peça para a pessoa enviar de novo.</p>
        <Link href="/listas" className="btn mt16">Ir para as suas listas</Link>
      </div>
    );
  }

  return (
    <>
      <div className="row between"><Link href="/listas" style={{ fontWeight: 600, minHeight: 44, display: "inline-flex", alignItems: "center", gap: 4 }}><CaretLeft size={16} weight="bold" aria-hidden="true" />Listas</Link><span className="word" style={{ fontSize: 18 }}>hobby</span></div>
      <p className="label mt16" style={{ margin: 0 }}>Lista compartilhada</p>
      <h1 style={{ marginTop: 6 }} data-testid="lista-compartilhada">{shared.name}</h1>
      <p className="sub">{shared.items.length === 1 ? "1 item" : `${shared.items.length} itens`}</p>

      <button type="button" className="btn mt16" onClick={() => {
        const id = saveSharedList(shared.name, shared.items);
        if (id) router.push(`/listas/${id}`);
      }}>Salvar uma cópia nas minhas listas</button>

      <ol style={{ listStyle: "none" }} className="mt16">
        {shared.items.map((item, idx) => (
          <li key={item.id} className="row" style={{ gap: 12, padding: "8px 0", borderBottom: "1px solid var(--line)", alignItems: "center" }}>
            <span className="muted" style={{ width: 22, textAlign: "right", fontWeight: 700 }} aria-hidden="true">{idx + 1}</span>
            <Link href={`/item/${encodeURIComponent(item.id)}`} onClick={() => cacheItem(item)} className="row" style={{ gap: 12, flex: 1, minHeight: 64 }}>
              <Cover item={item} w={44} h={60} fs={11} />
              <span>
                <strong style={{ fontSize: 15, display: "block" }}>{item.title}</strong>
                <span className="row gap8" style={{ marginTop: 4 }}><MediaTag media={item.media} />{item.year && <span className="muted" style={{ fontSize: 12 }}>{item.year}</span>}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
