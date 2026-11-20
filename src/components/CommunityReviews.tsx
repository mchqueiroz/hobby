"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cloudAvailable } from "@/lib/cloud";
import { commentCounts, loadItemReviews, type CommunityReview } from "@/lib/community";
import { threadKey } from "@/lib/social";
import { ActivityLine, PersonAvatar } from "./Social";

/** Resenhas públicas de outras pessoas sobre esta obra, com conversa. Some se as contas não estão ativas. */
export function CommunityReviews({ itemId }: { itemId: string }) {
  const [st, setSt] = useState<{ reviews: CommunityReview[]; counts: Map<string, number> } | "erro" | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!cloudAvailable()) return;
    let live = true;
    loadItemReviews(itemId)
      .then(async (reviews) => {
        const counts = await commentCounts(reviews.map((r) => ({ user: r.userId, item: itemId })));
        if (live) setSt({ reviews, counts });
      })
      .catch(() => live && setSt("erro"));
    return () => { live = false; };
  }, [itemId, tick]);

  if (!cloudAvailable() || st === null) return null;
  if (st === "erro") return null; // discussão é um extra: se falhar, a página da obra segue normal
  return (
    <section className="mt24" aria-labelledby="comunidade-resenhas" data-testid="resenhas-comunidade">
      <p className="label" id="comunidade-resenhas">O que a comunidade achou</p>
      {st.reviews.length === 0 ? (
        <p className="card" style={{ fontSize: 14 }}>Ninguém publicou resenha desta obra ainda. Escreva a sua e marque “mostrar resenhas” em <Link href="/comunidade">Comunidade</Link> para abrir a conversa.</p>
      ) : (
        <ul className="stack gap8">
          {st.reviews.map((r) => (
            <div key={r.userId}>
              <ActivityLine r={r.row} when={r.at} hideTitle who={
                <Link href={`/u/${r.user.handle}`} className="row gap8" style={{ display: "inline-flex", alignItems: "center", fontWeight: 700 }}>
                  <PersonAvatar p={r.user} size={22} />{r.user.name}
                </Link>
              } thread={{ user: r.userId, item: itemId }} count={st.counts.get(threadKey(r.userId, itemId)) ?? 0} onThreadChange={() => setTick((t) => t + 1)} />
            </div>
          ))}
        </ul>
      )}
    </section>
  );
}
