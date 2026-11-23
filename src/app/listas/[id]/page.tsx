"use client";

import { ArrowDown, ArrowUp, CaretLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { getItem } from "@/lib/recommend";
import { deleteList, moveInList, renameList, toggleInList, useHydrated, useLibrary } from "@/lib/store";
import { encodeList } from "@/lib/shareList";
import { useShell } from "@/components/Shell";
import { Cover, MediaTag } from "@/components/ui";

export default function ListaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const lib = useLibrary();
  const ready = useHydrated();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState(false);
  const { toast } = useShell();
  const list = lib.lists[id];

  if (!ready) return null;
  if (!list) {
    return (
      <div className="empty">
        <h2>Lista não encontrada</h2>
        <Link href="/listas" className="btn mt16">Voltar às listas</Link>
      </div>
    );
  }
  const items = list.itemIds.map((i) => getItem(lib, i)).filter((i): i is NonNullable<typeof i> => !!i);

  return (
    <>
      <div className="row between"><Link href="/listas" style={{ fontWeight: 600, minHeight: 44, display: "inline-flex", alignItems: "center", gap: 4 }}><CaretLeft size={16} weight="bold" aria-hidden="true" />Listas</Link><span className="word" style={{ fontSize: 18 }}>hobby</span></div>

      {editing ? (
        <form className="row gap8 mt16" onSubmit={(e) => { e.preventDefault(); renameList(id, name); setEditing(false); }}>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Novo nome da lista" style={{ flex: 1 }} autoFocus />
          <button type="submit" className="btn small" style={{ width: "auto" }} disabled={!name.trim()}>Salvar</button>
        </form>
      ) : (
        <h1 style={{ marginTop: 16 }}>{list.name}</h1>
      )}
      <p className="sub">{items.length === 1 ? "1 item" : `${items.length} itens`}</p>

      {items.length === 0 && (
        <div className="empty">
          <h2>Lista vazia</h2>
          <p>Abra uma obra e use “Adicionar a uma lista” para colocar itens aqui.</p>
        </div>
      )}

      <ul style={{ listStyle: "none" }} className="mt16">
        {items.map((item, idx) => (
          <li key={item.id} className="row" style={{ gap: 12, padding: "8px 0", borderBottom: "1px solid var(--line)", alignItems: "center" }}>
            <span className="muted" style={{ width: 22, textAlign: "right", fontWeight: 700 }} aria-hidden="true">{idx + 1}</span>
            <Link href={`/item/${encodeURIComponent(item.id)}`} className="row" style={{ gap: 12, flex: 1, minHeight: 64 }}>
              <Cover item={item} w={44} h={60} fs={11} />
              <span>
                <strong style={{ fontSize: 15, display: "block" }}>{item.title}</strong>
                <span className="row gap8" style={{ marginTop: 4 }}><MediaTag media={item.media} />{item.year && <span className="muted" style={{ fontSize: 12 }}>{item.year}</span>}</span>
              </span>
            </Link>
            <span className="row" style={{ gap: 2 }}>
              <button type="button" className="btn ghost small" style={{ width: 40, padding: 0 }} disabled={idx === 0} onClick={() => moveInList(id, item.id, -1)} aria-label={`Subir ${item.title} para a posição ${idx}`}><ArrowUp size={16} weight="bold" aria-hidden="true" /></button>
              <button type="button" className="btn ghost small" style={{ width: 40, padding: 0 }} disabled={idx === items.length - 1} onClick={() => moveInList(id, item.id, 1)} aria-label={`Descer ${item.title} para a posição ${idx + 2}`}><ArrowDown size={16} weight="bold" aria-hidden="true" /></button>
            </span>
            <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={() => toggleInList(id, item)} aria-label={`Tirar ${item.title} da lista`}>Tirar</button>
          </li>
        ))}
      </ul>

      <div className="row gap8 mt24" style={{ flexWrap: "wrap" }}>
        {items.length > 0 && (
          <button type="button" className="btn small" style={{ width: "auto" }} data-testid="compartilhar-lista" onClick={async () => {
            const url = `${window.location.origin}/listas/ver#d=${encodeList(list.name, items)}`;
            try {
              if (navigator.share) await navigator.share({ title: list.name, text: `Minha lista no Hobby: ${list.name}`, url });
              else { await navigator.clipboard.writeText(url); toast("Link da lista copiado"); }
            } catch { /* a pessoa cancelou o compartilhamento */ }
          }}>Compartilhar</button>
        )}
        {!editing && <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={() => { setName(list.name); setEditing(true); }}>Renomear</button>}
        {!confirm ? (
          <button type="button" className="btn danger small" style={{ width: "auto" }} onClick={() => setConfirm(true)}>Excluir lista</button>
        ) : (
          <>
            <button type="button" className="btn danger small" style={{ width: "auto" }} onClick={() => { deleteList(id); router.push("/listas"); }}>Confirmar exclusão</button>
            <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={() => setConfirm(false)}>Cancelar</button>
          </>
        )}
      </div>
    </>
  );
}
