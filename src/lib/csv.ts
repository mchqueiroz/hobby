import { getItem } from "./recommend";
import { dateToInput, effectiveDate } from "./stats";
import { MEDIA_LABEL, STATUS_LABEL, type Library } from "./types";

/** Uma célula de CSV. Textos que começariam com = + - @ ganham um apóstrofo, para planilhas não executarem como fórmula. */
export function cell(v: string | number | undefined): string {
  let s = v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEADER = ["titulo", "midia", "ano", "autor", "status", "nota", "data", "progresso", "total", "vezes", "etiquetas", "resenha"];

/** Biblioteca inteira em CSV (separador vírgula, com BOM para o Excel acertar os acentos). */
export function toCsv(lib: Library): string {
  const lines = [CSV_HEADER.join(",")];
  const rows = Object.values(lib.entries)
    .map((e) => ({ e, item: getItem(lib, e.itemId) }))
    .filter((r) => !!r.item)
    .sort((a, b) => effectiveDate(b.e) - effectiveDate(a.e));
  for (const { e, item } of rows) {
    lines.push([
      item!.title, MEDIA_LABEL[item!.media], item!.year, item!.author, STATUS_LABEL[e.status], e.rating,
      dateToInput(effectiveDate(e)), e.progress, e.total, e.rounds ?? (e.status === "concluido" ? 1 : undefined), (e.tags ?? []).join(" | "), e.review,
    ].map(cell).join(","));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}
