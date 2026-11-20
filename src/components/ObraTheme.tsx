"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useCover } from "@/lib/covers";
import { dominantFromPixels, obraTheme, vibePalette, type Hsl } from "@/lib/palette";
import type { Item } from "@/lib/types";

const KEY = "hobby:palette";

function cached(url: string): Hsl | undefined {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Hsl>)[url];
  } catch {
    return undefined;
  }
}
function remember(url: string, c: Hsl) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Hsl>;
    all[url] = c;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* sem armazenamento: recalcula na próxima visita */
  }
}

/** Lê a capa num canvas pequeno. Falha em silêncio quando a imagem não permite leitura (CORS). */
function sample(url: string, done: (c: Hsl | null) => void) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 24;
      canvas.height = 36;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx!.drawImage(img, 0, 0, 24, 36);
      done(dominantFromPixels(ctx!.getImageData(0, 0, 24, 36).data));
    } catch {
      done(null);
    }
  };
  img.onerror = () => done(null);
  img.src = url;
}

/**
 * Área própria de cada obra: o fundo e os realces da página pegam a tonalidade dominante da capa.
 * Sem capa legível, usa um tom derivado das vibes.
 */
export function ObraTheme({ item, children }: { item: Item; children: ReactNode }) {
  const url = useCover(item);
  const [sampled, setSampled] = useState<{ url: string; color: Hsl | null } | null>(null);

  useEffect(() => {
    if (!url) return;
    let live = true;
    void Promise.resolve(cached(url)).then((hit) => {
      if (!live) return;
      if (hit) return setSampled({ url, color: hit });
      sample(url, (c) => {
        if (!live) return;
        if (c) remember(url, c);
        setSampled({ url, color: c });
      });
    });
    return () => {
      live = false;
    };
  }, [url]);

  const fromCover = url && sampled?.url === url ? sampled.color : null;
  const color = fromCover ?? vibePalette(item.vibes, item.media);
  const t = obraTheme(color);
  const style = {
    "--w-l": t.washLight, "--w-d": t.washDark,
    "--a-l": t.accentLight, "--on-l": t.onLight,
    "--a-d": t.accentDark, "--on-d": t.onDark,
  } as CSSProperties;
  return (
    <div className="obra" style={style} data-tone={fromCover ? "capa" : "vibes"}>
      {children}
    </div>
  );
}
