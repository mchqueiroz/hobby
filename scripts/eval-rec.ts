import { BASE_WORLD, type WorldConfig } from "../src/lib/rec/synth";
import { popular, random, run, v1, v2, type Ranker } from "../src/lib/rec/harness";
import { mean, pairedCI } from "../src/lib/rec/metrics";
import type { UserResult } from "../src/lib/rec/harness";

const f = (x: number, d = 3) => x.toFixed(d);
const col = (rs: UserResult[], k: keyof UserResult) => rs.map((r) => (r[k] as number | undefined) ?? NaN).filter((x) => !Number.isNaN(x));

export function table(title: string, res: Record<string, UserResult[]>, ref = "v1") {
  console.log(`\n## ${title}`);
  console.log("método".padEnd(26) + "oráculo  ±ref(IC95)          cauda  P@10   logged  hit@10  crossHit  divers  novidade  mídias");
  const base = res[ref];
  for (const [name, rs] of Object.entries(res)) {
    const ci = pairedCI(rs.map((r) => r.oracle), base.map((r) => r.oracle));
    const cross = col(rs, "crossHit");
    console.log(
      name.padEnd(26) +
        f(mean(col(rs, "oracle"))).padEnd(9) +
        `${ci.diff >= 0 ? "+" : ""}${f(ci.diff)} [${f(ci.lo)},${f(ci.hi)}]`.padEnd(22) +
        f(mean(col(rs, "oracleTail"))).padEnd(7) +
        f(mean(col(rs, "oracleP10"))).padEnd(7) +
        f(mean(col(rs, "logged"))).padEnd(8) +
        f(mean(col(rs, "hit"))).padEnd(8) +
        f(mean(cross)).padEnd(10) +
        f(mean(col(rs, "diversity"))).padEnd(8) +
        f(mean(col(rs, "novelty")), 2).padEnd(10) +
        f(mean(col(rs, "spread")), 2),
    );
  }
}

if (process.argv[1]?.endsWith("eval-rec.ts")) main();
function main() {
const methods: Record<string, Ranker> = {
  random,
  popularidade: popular,
  v1: v1,
  "v2 sem prior": v2({ priorWeight: 0 }),
  v2: v2(),
};
const cfg: WorldConfig = { ...BASE_WORLD };
const { results } = run(cfg, methods);
table("mundo base", results);
}
