"use client";

import { loadSupabase } from "./supabase";

export interface ReportedComment {
  comment_id: string;
  body: string;
  author_id: string;
  author_handle: string | null;
  target_user: string;
  target_item: string;
  hidden: boolean;
  reports: number;
  reasons: string[];
  last_report: string;
}

export type ModerateAction = "hide" | "restore" | "delete";

/** Só quem está na tabela `admins` recebe true. Qualquer falha vale false (nada de painel por engano). */
export async function isAdmin(): Promise<boolean> {
  try {
    const { data, error } = await (await loadSupabase())!.rpc("is_admin");
    return !error && data === true;
  } catch { return false; }
}

export function parseReported(raw: unknown): ReportedComment | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.comment_id !== "string" || typeof r.body !== "string" || typeof r.author_id !== "string") return null;
  return {
    comment_id: r.comment_id, body: r.body.slice(0, 500), author_id: r.author_id,
    author_handle: typeof r.author_handle === "string" ? r.author_handle : null,
    target_user: String(r.target_user ?? ""), target_item: String(r.target_item ?? ""),
    hidden: r.hidden === true, reports: Number(r.reports) || 0,
    reasons: Array.isArray(r.reasons) ? r.reasons.filter((x): x is string => typeof x === "string") : [],
    last_report: String(r.last_report ?? ""),
  };
}

export async function adminReports(): Promise<ReportedComment[]> {
  const { data, error } = await (await loadSupabase())!.rpc("admin_reports");
  if (error) throw error;
  return ((data ?? []) as unknown[]).map(parseReported).filter((r): r is ReportedComment => !!r);
}

export async function adminModerate(commentId: string, action: ModerateAction): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await (await loadSupabase())!.rpc("admin_moderate", { p_comment: commentId, p_action: action });
  return error ? { ok: false, error: "Não consegui aplicar a ação." } : { ok: true };
}
