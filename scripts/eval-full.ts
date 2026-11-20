import { BASE_WORLD, type WorldConfig } from "../src/lib/rec/synth";
import { popular, run, v1, v2, type Ranker, type UserResult } from "../src/lib/rec/harness";
import { DEFAULT_PARAMS, type Params } from "../src/lib/rec/engine";
import { mean, pairedCI } from "../src/lib/rec/metrics";
import { table } from "./eval-rec";

const score = (rs: UserResult[]) => 0.5 * mean(rs.map((r) => r.oracle)) + 0.5 * mean(rs.map((r) => r.oracleTail));
const seeds = (xs: number[], o: Partial<WorldConfig> = {}) => xs.map((seed) => ({ ...BASE_WORLD, ...o, seed }));
const pool = (cfgs: WorldConfig[], methods: Record<string, Ranker>) => {
  const out: Record<string, UserResult[]> = {};
  for (const c of cfgs) {
    const { results } = run(c, methods);
    for (const [k, v] of Object.entries(results)) (out[k] ??= []).push(...v);
  }
  return out;
};

/* 1) ajuste por busca em coordenadas, só em mundos de validação (sementes 101–103) */
const VAL = seeds([101, 102, 103]);
const GRID: { [K in keyof Params]?: Params[K][] } = {
  priorWeight: [0.2, 0.35, 0.5, 0.7, 1],
  vibeShrink: [0.5, 1, 2, 4],
  knnWeight: [0, 0.25, 0.5, 0.75, 1],
  knnShrink: [0.5, 1, 2],
  knnPower: [1, 2, 3],
  halfLife: [120, 240, 365, 720, Infinity],
  mediaWeight: [0, 0.15, 0.3, 0.5],
  mmrLambda: [0.7, 0.85, 0.95, 1],
  priorStrength: [2, 4, 8],
};
let best: Params = { ...DEFAULT_PARAMS };
let bestScore = score(pool(VAL, { x: v2(best) }).x);
console.log("validação, ponto de partida:", bestScore.toFixed(4));
for (let round = 0; round < 2; round++) {
  for (const [k, vals] of Object.entries(GRID)) {
    for (const val of vals as unknown[]) {
      const cand = { ...best, [k]: val } as Params;
      const s = score(pool(VAL, { x: v2(cand) }).x);
      if (s > bestScore + 1e-4) {
        bestScore = s;
        best = cand;
        console.log(`  ${k}=${String(val)} -> ${s.toFixed(4)}`);
      }
    }
  }
}
console.log("\nparâmetros escolhidos:", JSON.stringify(best, (_, v) => (v === Infinity ? "Infinity" : v)));

/* 2) teste final em mundos nunca vistos (sementes 1–5) */
const TEST = seeds([1, 2, 3, 4, 5]);
const methods: Record<string, Ranker> = {
  popularidade: popular,
  v1,
  "v2 padrão (sem ajuste)": v2(),
  "v2 ajustado": v2(best),
};
table("TESTE — 5 mundos novos, 1250 pessoas", pool(TEST, methods));

/* 3) ablação: tira uma ideia por vez do v2 ajustado */
const abl: Record<string, Ranker> = {
  "v2 ajustado": v2(best),
  "− prior de qualidade": v2({ ...best, priorWeight: 0 }),
  "− nota relativa (usa nota−3)": v2({ ...best, userNorm: false }),
  "− encolhimento por vibe": v2({ ...best, vibeShrink: 0.01, knnShrink: 0.01 }),
  "− decaimento no tempo": v2({ ...best, halfLife: Infinity }),
  "− IDF": v2({ ...best, idf: false } as Partial<Params>),
  "só soma por vibe (sem kNN)": v2({ ...best, knnWeight: 0 }),
  "só kNN (sem soma por vibe)": v2({ ...best, knnWeight: 1 }),
  "mídia: sem": v2({ ...best, media: "none" }),
  "mídia: bônus fixo": v2({ ...best, media: "fixed" }),
  "− diversidade (MMR)": v2({ ...best, mmrLambda: 1 }),
};
table("ABLAÇÃO (referência = v2 ajustado)", pool(TEST, abl), "v2 ajustado");

/* 4) robustez: o ganho se mantém quando as suposições do mundo mudam? */
const cmp: Record<string, Ranker> = { popularidade: popular, v1, "v2 ajustado": v2(best) };
const grid: [string, Partial<WorldConfig>][] = [
  ["vibes quase sem ruído (0.2)", { vibeNoise: 0.2 }],
  ["vibes muito ruidosas (1.4)", { vibeNoise: 1.4 }],
  ["sem deriva de gosto", { drift: 0 }],
  ["deriva forte", { drift: 1.2 }],
  ["notas pouco enviesadas", { biasSpread: 0.15 }],
  ["notas muito enviesadas", { biasSpread: 1 }],
  ["não transfere entre mídias", { transfer: [0, 0.2] }],
  ["transfere tudo", { transfer: [0.9, 1] }],
  ["qualidade quase irrelevante (0.15)", { qualitySd: 0.15 }],
  ["qualidade dominante (0.9)", { qualitySd: 0.9 }],
  ["sem viés de seleção", { selection: 0 }],
  ["viés de seleção forte", { selection: 2.5 }],
  ["pouco histórico (4 a 14)", { eventsMin: 6, eventsMax: 20 }],
];
console.log("\n## ROBUSTEZ (oráculo / cauda; IC95 de v2 − melhor baseline no oráculo)");
for (const [name, o] of grid) {
  const r = pool(seeds([11, 12], o), cmp);
  const m = (k: string, f: "oracle" | "oracleTail") => mean(r[k].map((x) => x[f]));
  const bestBase = m("popularidade", "oracle") >= m("v1", "oracle") ? "popularidade" : "v1";
  const ci = pairedCI(r["v2 ajustado"].map((x) => x.oracle), r[bestBase].map((x) => x.oracle));
  console.log(
    name.padEnd(36) +
      `pop ${m("popularidade", "oracle").toFixed(3)}/${m("popularidade", "oracleTail").toFixed(3)}  v1 ${m("v1", "oracle").toFixed(3)}/${m("v1", "oracleTail").toFixed(3)}  v2 ${m("v2 ajustado", "oracle").toFixed(3)}/${m("v2 ajustado", "oracleTail").toFixed(3)}  Δ vs ${bestBase}: ${ci.diff >= 0 ? "+" : ""}${ci.diff.toFixed(3)} [${ci.lo.toFixed(3)},${ci.hi.toFixed(3)}]`,
  );
}

/* 5) começo a frio: por tamanho do histórico de treino */
const r = pool(TEST, cmp);
console.log("\n## POR TAMANHO DO HISTÓRICO (oráculo / cauda)");
for (const [lo, hi] of [[3, 9], [10, 19], [20, 34], [35, 99]]) {
  const sel = (k: string) => r[k].filter((x) => x.trainSize >= lo && x.trainSize <= hi);
  const n = sel("v1").length;
  const m = (k: string, f: "oracle" | "oracleTail") => mean(sel(k).map((x) => x[f])).toFixed(3);
  console.log(`${lo}–${hi} itens (n=${n})`.padEnd(22) + `pop ${m("popularidade", "oracle")}/${m("popularidade", "oracleTail")}  v1 ${m("v1", "oracle")}/${m("v1", "oracleTail")}  v2 ${m("v2 ajustado", "oracle")}/${m("v2 ajustado", "oracleTail")}`);
}
