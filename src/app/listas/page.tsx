"use client";

import Link from "next/link";
import { useState } from "react";
import { createList, useHydrated, useLibrary } from "@/lib/store";
import { Header } from "@/components/ui";
import { LibNav } from "@/components/LibNav";
import { getItem } from "@/lib/recommend";
import { Cover } from "@/components/ui";

export default function Listas() {
  const lib = useLibrary();
  const ready = useHydrated();
  const [name, setName] = useState("");
  if (!ready) return null;
  const lists = Object.values(lib.lists).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <>
      <Header title="Listas" sub="Agrupe do seu jeito, misturando mídias" />
      <LibNav current="/listas" />

      <form className="row gap8 mt16" onSubmit={(e) => { e.preventDefault(); if (createList(name)) setName(""); }}>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
          placeholder="Nome da nova lista" aria-label="Nome da nova lista" style={{ flex: 1 }} />
        <button type="submit" className="btn" style={{ width: "auto", minWidth: 90 }} disabled={!name.trim()}>Criar</button>
      </form>

      {lists.length === 0 && (
        <div className="empty">
          <h2>Nenhuma lista ainda</h2>
          <p>Crie uma lista acima, por exemplo “Melhores de 2026” ou “Para ver com amigos”, e adicione itens pela página de cada obra.</p>
        </div>
      )}

      <ul style={{ listStyle: "none" }} className="mt16 cols2">
        {lists.map((l) => {
          const items = l.itemIds.map((id) => getItem(lib, id)).filter((i) => !!i);
          return (
            <li key={l.id} className="card" style={{ marginBottom: 12 }}>
              <Link href={`/listas/${l.id}`} style={{ display: "block" }}>
                <strong style={{ fontFamily: "var(--display)", fontSize: 18 }}>{l.name}</strong>
                <span className="muted" style={{ fontSize: 13, display: "block", marginTop: 2 }}>
                  {l.itemIds.length === 1 ? "1 item" : `${l.itemIds.length} itens`}
                </span>
                {items.length > 0 && (
                  <span className="row gap8 mt8" style={{ overflow: "hidden" }}>
                    {items.slice(0, 5).map((it) => <Cover key={it!.id} item={it!} w={44} h={62} fs={9} />)}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
