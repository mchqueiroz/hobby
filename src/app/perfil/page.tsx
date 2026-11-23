"use client";

import { getItem } from "@/lib/recommend";
import { useHydrated, useLibrary } from "@/lib/store";
import { MEDIAS, MEDIA_PLURAL, perMedia, type Media } from "@/lib/types";
import { Favorites, Hero } from "@/components/ProfileParts";
import { LibNav } from "@/components/LibNav";
import { LibraryView } from "@/components/LibraryView";

/** Perfil: quem você é (cartão, números e vitrine) e, logo abaixo, a sua biblioteca. Ajustes ficam na engrenagem. */
export default function Perfil() {
  const lib = useLibrary();
  const ready = useHydrated();
  if (!ready) return null;

  const done = Object.values(lib.entries).filter((e) => e.status === "concluido");
  const counts = perMedia((m: Media) => done.filter((e) => getItem(lib, e.itemId)?.media === m).length);
  const total = Object.values(lib.entries).filter((e) => getItem(lib, e.itemId)).length;

  return (
    <>
      <div className="word">hobby</div>
      <h1 className="sr">Perfil</h1>
      <div className="mt16"><Hero lib={lib} counts={counts} total={total} /></div>

      <ul className="statrow" aria-label="Concluídos por mídia">
        {MEDIAS.map((m) => (
          <li key={m}>
            <b style={{ color: `var(--${m}-t)` }}>{counts[m]}</b>
            <span>{MEDIA_PLURAL[m]}</span>
          </li>
        ))}
      </ul>

      <Favorites lib={lib} />

      <div className="mt24"><LibNav current="/perfil" /></div>
      <LibraryView />
    </>
  );
}
