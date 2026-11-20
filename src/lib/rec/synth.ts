import { VIBES as ALL_VIBES } from "../vibes";

// o laboratório usa os 30 vibes originais (os de música entram quando houver dados reais); mudar isto muda toda a sequência aleatória
const VIBES = ALL_VIBES.slice(0, 30);
import { perMedia, type Item, type Media } from "../types";
import type { Interaction } from "./engine";

/**
 * Mundo sintético com verdade conhecida, para testar o código e a sensibilidade dos métodos.
 * AVISO: isso reflete as nossas suposições. Prova que o método funciona sob elas, não que funciona com gente de verdade.
 *
 * Cada obra tem um vetor latente z (não observável pelo recomendador) e uma qualidade q. As vibes são uma
 * visão ruidosa de z. Cada pessoa tem gosto u, viés de nota, escala de nota, afinidade por mídia e transferência
 * entre mídias. As pessoas escolhem o que ver com viés de seleção (tendem a ver o que esperam gostar e o que é popular).
 */

export interface WorldConfig {
  seed: number;
  users: number;
  items: number;
  dim: number;
  /** ruído nas vibes; maior = vibes menos informativas */
  vibeNoise: number;
  /** quanto o gosto muda ao longo do tempo (0 = nada) */
  drift: number;
  /** dispersão do viés de nota entre pessoas */
  biasSpread: number;
  /** faixa da transferência entre mídias: 1 = o gosto vale igual em todas, 0 = não transfere */
  transfer: [number, number];
  eventsMin: number;
  eventsMax: number;
  /** intensidade do viés de seleção */
  selection: number;
  /** dias de histórico */
  horizon: number;
  /** dispersão da qualidade intrínseca das obras */
  qualitySd: number;
}

export const BASE_WORLD: WorldConfig = {
  seed: 1,
  users: 250,
  items: 600,
  dim: 8,
  vibeNoise: 0.6,
  drift: 0.5,
  biasSpread: 0.5,
  transfer: [0.3, 1],
  eventsMin: 12,
  eventsMax: 60,
  selection: 1,
  horizon: 720,
  qualitySd: 0.5,
};

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r: () => number): number {
  const u = Math.max(1e-12, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const unit = (a: number[]) => {
  const n = Math.sqrt(dot(a, a)) || 1;
  return a.map((x) => x / n);
};
// o laboratório usa as três mídias originais; as novas entram quando houver dados reais
const LAB: Media[] = ["anime", "jogo", "filme"];

export interface World {
  config: WorldConfig;
  items: Item[];
  /** qualidade intrínseca de cada obra (índice = item) */
  quality: number[];
  /** vetor latente de cada obra: só o laboratório enxerga */
  zs: number[][];
  /** índice do item pelo id */
  index: Map<string, number>;
  users: SynthUser[];
}

export interface SynthUser {
  id: number;
  home: Media;
  /** gosto atual no fim do horizonte, para a verdade de referência */
  tasteEnd: number[];
  mediaOffset: Record<Media, number>;
  transfer: number;
  bias: number;
  scale: number;
  events: (Interaction & { gain: number })[];
}

export function buildWorld(cfg: WorldConfig): World {
  const r = mulberry32(cfg.seed);
  const { dim } = cfg;
  const clusters = Array.from({ length: 7 }, () => unit(Array.from({ length: dim }, () => gauss(r))));
  const loadings = VIBES.map(() => Array.from({ length: dim }, () => gauss(r)));

  // mesma ordem de sorteio de antes, para os resultados documentados continuarem reproduzíveis
  const mediaShift = perMedia(() => new Array<number>(dim).fill(0));
  for (const m of LAB) mediaShift[m] = Array.from({ length: dim }, () => 0.25 * gauss(r));
  const zs: number[][] = [];
  const items: Item[] = [];
  const quality: number[] = [];
  for (let i = 0; i < cfg.items; i++) {
    const media = LAB[i % 3];
    const c = clusters[Math.floor(r() * clusters.length)];
    const z = unit(c.map((x, k) => x + 0.7 * gauss(r) + mediaShift[media][k]));
    zs.push(z);
    const logits = loadings.map((w) => dot(w, z) + cfg.vibeNoise * gauss(r));
    const k = 3 + Math.floor(r() * 4);
    const top = logits.map((l, j) => [l, j] as const).sort((a, b) => b[0] - a[0]).slice(0, k).map(([, j]) => VIBES[j] as string);
    items.push({ id: `s${i}`, title: `Obra ${i}`, media, vibes: top, source: "seed" });
    quality.push(cfg.qualitySd * gauss(r));
  }
  const index = new Map(items.map((it, i) => [it.id, i]));

  const users: SynthUser[] = [];
  for (let u = 0; u < cfg.users; u++) {
    const base = clusters[Math.floor(r() * clusters.length)];
    const second = clusters[Math.floor(r() * clusters.length)];
    const t0 = unit(base.map((x, k) => x + 0.5 * second[k] + 0.35 * gauss(r)));
    const dir = unit(Array.from({ length: dim }, () => gauss(r)));
    const tasteEnd = unit(t0.map((x, k) => x + cfg.drift * dir[k]));
    const home = LAB[Math.floor(r() * 3)];
    const mediaOffset = perMedia(() => 0);
    for (const m of LAB) mediaOffset[m] = 0.4 * gauss(r);
    const transfer = cfg.transfer[0] + r() * (cfg.transfer[1] - cfg.transfer[0]);
    const bias = 3.6 + cfg.biasSpread * gauss(r);
    const scale = 0.6 + 0.8 * r();

    const tasteAt = (t: number) => unit(t0.map((x, k) => x + cfg.drift * (t / cfg.horizon) * dir[k]));
    const util = (i: number, t: number, ta = tasteAt(t)) => {
      const m = items[i].media;
      const raw = 2.2 * dot(ta, zs[i]);
      return (m === home ? raw : transfer * raw) + mediaOffset[m] + quality[i];
    };

    const n = cfg.eventsMin + Math.floor(r() * (cfg.eventsMax - cfg.eventsMin + 1));
    const days = Array.from({ length: n }, () => Math.floor(r() * cfg.horizon)).sort((a, b) => a - b);
    const taken = new Set<number>();
    const events: SynthUser["events"] = [];
    for (const day of days) {
      const ta = tasteAt(day);
      let total = 0;
      const w = new Float64Array(items.length);
      for (let i = 0; i < items.length; i++) {
        if (taken.has(i)) continue;
        const mediaPref = items[i].media === home ? 1 : 0.25;
        const pop = Math.exp(1.2 * quality[i]);
        w[i] = mediaPref * pop * Math.exp(cfg.selection * 0.5 * util(i, day, ta));
        total += w[i];
      }
      let x = r() * total;
      let pick = -1;
      for (let i = 0; i < items.length; i++) {
        if (!w[i]) continue;
        x -= w[i];
        if (x <= 0) {
          pick = i;
          break;
        }
      }
      if (pick < 0) continue;
      taken.add(pick);
      const latent = bias + scale * util(pick, day, ta) + 0.4 * gauss(r);
      const clipped = Math.max(0.5, Math.min(5, Math.round(latent * 2) / 2));
      const bad = latent < 2 && r() < 0.5;
      const status = bad ? "abandonei" : "concluido";
      const rating = bad ? undefined : r() < 0.85 ? clipped : undefined;
      events.push({ item: items[pick], status, rating, day, gain: latent });
    }
    users.push({ id: u, home, tasteEnd, mediaOffset, transfer, bias, scale, events });
  }
  return { config: cfg, items, quality, zs, index, users };
}

/** Utilidade verdadeira, no fim do horizonte, de todo o catálogo para uma pessoa (a referência "sem viés de seleção"). */
export function trueUtility(world: World, user: SynthUser): number[] {
  return world.items.map((it, i) => {
    const raw = 2.2 * dot(user.tasteEnd, world.zs[i]);
    return (it.media === user.home ? raw : user.transfer * raw) + user.mediaOffset[it.media] + world.quality[i];
  });
}
