export interface Part { text: string; spoiler: boolean; }

/** Divide um texto em trechos normais e trechos de spoiler, marcados como ||assim||. Marca sem fechamento fica como texto. */
export function parseSpoilers(input: string): Part[] {
  const out: Part[] = [];
  let rest = input;
  while (rest.length) {
    const open = rest.indexOf("||");
    if (open < 0) break;
    const close = rest.indexOf("||", open + 2);
    if (close < 0) break;
    const inner = rest.slice(open + 2, close);
    if (open > 0) out.push({ text: rest.slice(0, open), spoiler: false });
    if (inner.trim()) out.push({ text: inner, spoiler: true });
    else out.push({ text: "||" + inner + "||", spoiler: false });
    rest = rest.slice(close + 2);
  }
  if (rest) out.push({ text: rest, spoiler: false });
  return out.length ? out : [{ text: input, spoiler: false }];
}

export const hasSpoiler = (t: string) => parseSpoilers(t).some((p) => p.spoiler);
