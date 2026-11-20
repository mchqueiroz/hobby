import { BASE_WORLD, type WorldConfig } from "../src/lib/rec/synth";
import { popular, run, v1, v2, type Ranker, type UserResult } from "../src/lib/rec/harness";
import { DEFAULT_PARAMS, type Params } from "../src/lib/rec/engine";
import { mean } from "../src/lib/rec/metrics";

const BEST: Params = { ...DEFAULT_PARAMS, priorStrength: 8, halfLife: 720, vibeShrink: 4, knnWeight: 0.25, mediaWeight: 0.5, mmrLambda: 1, priorWeight: 0.35 };
const cfgs: WorldConfig[] = [1, 2, 3].map((seed) => ({ ...BASE_WORLD, seed }));
const pool = (m: Record<string, Ranker>) => {
  const out: Record<string, UserResult[]> = {};
  for (const c of cfgs) for (const [k, v] of Object.entries(run(c, m).results)) (out[k] ??= []).push(...v);
  return out;
};
const show = (title: string, r: Record<string, UserResult[]>) => {
  console.log(`\n## ${title}\n` + "config".padEnd(28) + "oráculo cauda   diversid. novidade mídias hit@10");
  for (const [k, rs] of Object.entries(r)) {
    const g = (f: keyof UserResult) => mean(rs.map((x) => x[f] as number));
    console.log(k.padEnd(28) + [g("oracle"), g("oracleTail"), g("diversity"), g("novelty"), g("spread"), g("hit")].map((x) => x.toFixed(3).padEnd(8)).join(""));
  }
};
const A: Record<string, Ranker> = { popularidade: popular, v1 };
for (const l of [1, 0.95, 0.9, 0.85, 0.8, 0.7]) A[`v2 diversidade λ=${l}`] = v2({ ...BEST, mmrLambda: l });
show("diversidade (MMR)", pool(A));
const B: Record<string, Ranker> = {};
for (const w of [0, 0.1, 0.2, 0.35, 0.5, 0.8]) B[`v2 peso do prior=${w}`] = v2({ ...BEST, priorWeight: w, mmrLambda: 0.9 });
show("quanto confiar na popularidade (descoberta × acerto)", pool(B));
const C: Record<string, Ranker> = { "v2 com IDF": v2({ ...BEST, mmrLambda: 1 }), "v2 sem IDF": v2({ ...BEST, mmrLambda: 1, idf: false }), "v2 sem prior, tudo ajustado": v2({ ...BEST, priorWeight: 0, mmrLambda: 1 }), v1 };
show("IDF e v2 sem prior", pool(C));
