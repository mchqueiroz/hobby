"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Imported } from "@/lib/anilist";
import { USER_RE } from "@/lib/anilist";
import { Consent } from "@/components/Consent";
import { parseBooks, parseLetterboxd, parseMalXml } from "@/lib/importers";
import { importHistory, loadDemo, track } from "@/lib/store";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

type Source = "anilist" | "mal" | "letterboxd" | "livros";

type State =
  | { s: "idle" }
  | { s: "loading"; from: Source }
  | { s: "error"; msg: string; from: Source }
  | { s: "done"; imp: Imported; added: number; unit: string; note?: string };

async function readText(file: File): Promise<string> {
  if (/\.gz$/i.test(file.name) && typeof DecompressionStream !== "undefined") {
    const stream = file.stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  }
  return await file.text();
}

export default function Importar() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [st, setSt] = useState<State>({ s: "idle" });
  const valid = USER_RE.test(user.trim());

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || st.s === "loading") return;
    setSt({ s: "loading", from: "anilist" });
    track("import_start", { source: "anilist" });
    try {
      const res = await fetch(`/api/anilist?user=${encodeURIComponent(user.trim())}`);
      const body = await res.json();
      if (!res.ok) {
        track("import_fail", { reason: String(body.error ?? res.status), source: "anilist" });
        setSt({ s: "error", from: "anilist", msg: body.message ?? "Não foi possível importar agora." });
        return;
      }
      const imp = body as Imported;
      const { added } = importHistory(imp);
      track("import_done", { items: imp.items.length, added, source: "anilist" });
      setSt({ s: "done", imp, added, unit: "animes" });
    } catch {
      track("import_fail", { reason: "network", source: "anilist" });
      setSt({ s: "error", from: "anilist", msg: "Sem conexão com o servidor. Tente de novo." });
    }
  }

  /** Importação por arquivo: o arquivo é lido no próprio aparelho; só títulos e notas vão ao servidor para achar gêneros. */
  async function fromFiles(source: "mal" | "letterboxd" | "livros", files: FileList | null) {
    if (!files || files.length === 0 || st.s === "loading") return;
    const fail = (reason: string, msg: string) => {
      track("import_fail", { reason, source });
      setSt({ s: "error", from: source, msg });
    };
    setSt({ s: "loading", from: source });
    track("import_start", { source });
    try {
      let url: string;
      let payload: unknown;
      let unit: string;
      let note: (b: Record<string, number>) => string | undefined;
      if (source === "mal") {
        const entries = parseMalXml(await readText(files[0]));
        if (entries.length === 0) return fail("empty", "Não encontramos animes nesse arquivo. Envie o animelist.xml exportado do MyAnimeList.");
        url = "/api/import/mal";
        payload = { entries };
        unit = "animes";
        note = (b) => (b.unknown > 0 ? `${b.unknown} título${b.unknown === 1 ? "" : "s"} não foi encontrado no AniList e ficou de fora.` : undefined);
      } else if (source === "livros") {
        const { books, total } = parseBooks(await files[0].text());
        if (books.length === 0) return fail("empty", "Não encontramos livros nesse arquivo. Envie o CSV exportado do Goodreads ou do StoryGraph.");
        url = "/api/import/livros";
        payload = { books };
        unit = "livros";
        note = (b) => {
          const parts: string[] = [];
          if (total > books.length) parts.push(`Importamos ${books.length} dos ${total} livros, priorizando os que você avaliou.`);
          if (b.missing > 0) parts.push(`${b.missing} não ${b.missing === 1 ? "foi encontrado" : "foram encontrados"} no Open Library.`);
          return parts.join(" ") || undefined;
        };
      } else {
        const list = await Promise.all(Array.from(files).map(async (f) => ({ name: f.name, text: await f.text() })));
        const { films, total } = parseLetterboxd(list);
        if (films.length === 0) return fail("empty", "Não encontramos filmes nesses arquivos. Envie ratings.csv, watched.csv e/ou watchlist.csv do export do Letterboxd.");
        url = "/api/import/letterboxd";
        payload = { films };
        unit = "filmes";
        note = (b) => {
          const parts: string[] = [];
          if (total > films.length) parts.push(`Importamos ${films.length} dos ${total} filmes, priorizando os que você avaliou.`);
          if (b.missing > 0) parts.push(`${b.missing} não ${b.missing === 1 ? "foi encontrado" : "foram encontrados"} no TMDB.`);
          return parts.join(" ") || undefined;
        };
      }
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json();
      if (!res.ok) return fail(String(body.error ?? res.status), body.message ?? "Não foi possível importar agora.");
      const imp = body as Imported;
      const { added } = importHistory(imp);
      track("import_done", { items: imp.items.length, added, source });
      setSt({ s: "done", imp, added, unit, note: note(body) });
    } catch {
      fail("network", "Não foi possível ler o arquivo ou falar com o servidor. Tente de novo.");
    }
  }

  const total = st.s === "done" ? st.imp.items.length : 0;

  return (
    <>
      <div className="word">hobby</div>
      <h1 style={{ marginTop: 30 }}>Traga seu histórico.</h1>
      <p className="sub">Importe de onde você já registra e comece com recomendações prontas.</p>

      <form onSubmit={run} className="mt24">
        <div className="card" style={{ borderColor: "var(--ink)", borderWidth: 2 }}>
          <label htmlFor="user" style={{ fontWeight: 700, fontSize: 16 }}>AniList</label>
          <p className="muted" style={{ fontSize: 13, margin: "2px 0 10px" }}>
            Digite seu nome de usuário. Sua lista precisa estar pública. Não pedimos senha.
          </p>
          <input
            id="user" className="field" value={user} onChange={(e) => setUser(e.target.value)}
            placeholder="seu_usuario" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            aria-describedby={st.s === "error" && st.from === "anilist" ? "erro" : undefined}
          />
          <button type="submit" className="btn mt12" disabled={!valid || st.s === "loading"}>
            {st.s === "loading" && st.from === "anilist" ? "Importando…" : "Importar anime"}
          </button>
          {st.s === "error" && st.from === "anilist" && <p id="erro" role="alert" className="err">{st.msg}</p>}
        </div>
      </form>

      <section className="card mt12" aria-labelledby="mal-t">
        <h2 id="mal-t" style={{ fontSize: 16 }}>MyAnimeList</h2>
        <p className="muted" style={{ fontSize: 13, margin: "2px 0 10px" }}>
          No MyAnimeList, abra Perfil, Exportar lista e baixe o animelist.xml (também aceita o .gz). Escolha o arquivo aqui. Ele é lido no seu aparelho.
        </p>
        <label className="btn ghost small" style={{ cursor: "pointer" }}>
          {st.s === "loading" && st.from === "mal" ? "Importando…" : "Escolher animelist.xml"}
          <input type="file" accept=".xml,.gz,text/xml" hidden aria-label="Arquivo do MyAnimeList"
            onChange={(e) => { void fromFiles("mal", e.target.files); e.target.value = ""; }} />
        </label>
        {st.s === "error" && st.from === "mal" && <p id="erro-mal" role="alert" className="err">{st.msg}</p>}
      </section>

      <section className="card mt12" aria-labelledby="lb-t">
        <h2 id="lb-t" style={{ fontSize: 16 }}>Letterboxd</h2>
        <p className="muted" style={{ fontSize: 13, margin: "2px 0 10px" }}>
          No Letterboxd, em Configurações, Dados, exporte seus dados, descompacte o zip e escolha ratings.csv, watched.csv e/ou watchlist.csv (pode marcar vários).
        </p>
        <label className="btn ghost small" style={{ cursor: "pointer" }}>
          {st.s === "loading" && st.from === "letterboxd" ? "Importando…" : "Escolher arquivos .csv"}
          <input type="file" accept=".csv,text/csv" multiple hidden aria-label="Arquivos do Letterboxd"
            onChange={(e) => { void fromFiles("letterboxd", e.target.files); e.target.value = ""; }} />
        </label>
        {st.s === "error" && st.from === "letterboxd" && <p id="erro-lb" role="alert" className="err">{st.msg}</p>}
      </section>

      <section className="card mt12" aria-labelledby="gr-t">
        <h2 id="gr-t" style={{ fontSize: 16 }}>Goodreads ou StoryGraph</h2>
        <p className="muted" style={{ fontSize: 13, margin: "2px 0 10px" }}>
          No Goodreads, abra My Books, Import and export, Export Library. No StoryGraph, Manage Account, Export StoryGraph Library. Escolha o .csv baixado.
        </p>
        <label className="btn ghost small" style={{ cursor: "pointer" }}>
          {st.s === "loading" && st.from === "livros" ? "Importando…" : "Escolher arquivo .csv"}
          <input type="file" accept=".csv,text/csv" hidden aria-label="Arquivo do Goodreads ou StoryGraph"
            onChange={(e) => { void fromFiles("livros", e.target.files); e.target.value = ""; }} />
        </label>
        {st.s === "error" && st.from === "livros" && <p id="erro-gr" role="alert" className="err">{st.msg}</p>}
      </section>

      <Consent />

      {st.s === "done" && (
        <section className="card mt16" aria-live="polite">
          <p className="label" style={{ margin: 0 }}>Importação concluída</p>
          <p style={{ fontFamily: "var(--display)", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            {total} <span style={{ fontSize: 18, fontWeight: 500 }}>{st.unit}</span>
          </p>
          <div className="bar mt8"><i style={{ width: "100%", background: "var(--jogo)" }} /></div>
          <p className="muted mt12" style={{ fontSize: 13 }}>
            <b style={{ color: "var(--ink)" }}>{plural(st.imp.counts.concluido, "concluído", "concluídos")}</b> ·{" "}
            <b style={{ color: "var(--ink)" }}>{st.imp.counts.andamento}</b> em andamento ·{" "}
            <b style={{ color: "var(--ink)" }}>{st.imp.counts.quero}</b> quero ver ·{" "}
            <b style={{ color: "var(--ink)" }}>{plural(st.imp.counts.abandonei, "abandonado", "abandonados")}</b>
          </p>
          {st.imp.withoutVibes > 0 && (
            <p className="muted mt8" style={{ fontSize: 13 }}>
              {st.imp.withoutVibes === 1
                ? "1 título não trouxe gêneros e não influencia as recomendações."
                : `${st.imp.withoutVibes} títulos não trouxeram gêneros e não influenciam as recomendações.`}
            </p>
          )}
          {st.note && <p className="muted mt8" style={{ fontSize: 13 }}>{st.note}</p>}
          {total === 0 && <p className="muted mt8" style={{ fontSize: 13 }}>Essa lista está vazia.</p>}
        </section>
      )}

      <div className="mt24">
        <Link href="/favoritos" className="btn" style={{ background: st.s === "done" ? "var(--ink)" : "transparent", color: st.s === "done" ? "var(--paper)" : "var(--ink)", border: "1.5px solid var(--ink)" }}>
          {st.s === "done" ? "Escolher favoritos de jogos e filmes" : "Não uso AniList: escolher favoritos"}
        </Link>
        <button type="button" className="btn ghost small mt12" onClick={() => { loadDemo(); router.push("/descobrir"); }}>
          Ver com dados de exemplo
        </button>
      </div>
    </>
  );
}
