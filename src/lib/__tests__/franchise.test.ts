import { describe, expect, it } from "vitest";
import { franchiseWords, indexFranchises, inKnownFranchise } from "../franchise";
import type { Media } from "../types";

const t = (title: string, media: Media = "anime") => ({ title, media });
const known = (...items: ReturnType<typeof t>[]) => indexFranchises(items);

describe("franquia", () => {
  it("tira marcas de temporada e parte do título", () => {
    expect(franchiseWords("Attack on Titan: The Final Season Part 2", "anime")).toEqual(["attack", "on", "titan"]);
    expect(franchiseWords("Haikyu!! 2nd Season", "anime")).toEqual(["haikyu"]);
    expect(franchiseWords("Stranger Things (Temporada 3)", "filme")).toEqual(["stranger", "things"]);
  });

  it("numeral no fim só conta como temporada em anime e mangá, e nunca o 100 de Mob Psycho 100", () => {
    expect(franchiseWords("Mob Psycho 100 II", "anime")).toEqual(["mob", "psycho", "100"]);
    expect(franchiseWords("Mob Psycho 100", "anime")).toEqual(["mob", "psycho", "100"]);
    expect(franchiseWords("Persona 5", "jogo")).toEqual(["persona", "5"]);
  });

  it("segunda temporada de um anime visto é a mesma franquia", () => {
    expect(inKnownFranchise(known(t("Haikyu!!")), t("Haikyu!! Second Season"))).toBe(true);
    expect(inKnownFranchise(known(t("Mob Psycho 100")), t("Mob Psycho 100 II"))).toBe(true);
  });

  it("subtítulo depois do nome conta como a mesma franquia em anime", () => {
    expect(inKnownFranchise(known(t("Fullmetal Alchemist")), t("Fullmetal Alchemist: Brotherhood"))).toBe(true);
    expect(inKnownFranchise(known(t("Steins;Gate")), t("Steins;Gate 0"))).toBe(true);
  });

  it("título de uma palavra só casa por igualdade: Monster não engole Monster Musume", () => {
    expect(inKnownFranchise(known(t("Monster")), t("Monster Musume"))).toBe(false);
    expect(inKnownFranchise(known(t("Monster")), t("Monster"))).toBe(true);
  });

  it("filme só casa por igualdade depois de tirar a temporada", () => {
    expect(inKnownFranchise(known(t("Star Wars", "filme")), t("Star Wars: Andor", "filme"))).toBe(false);
    expect(inKnownFranchise(known(t("Stranger Things", "filme")), t("Stranger Things (Temporada 3)", "filme"))).toBe(true);
  });

  it("jogo, livro e álbum ficam de fora: Hades II é sugestão boa para quem zerou Hades", () => {
    expect(inKnownFranchise(known(t("Hades", "jogo")), t("Hades II", "jogo"))).toBe(false);
  });

  it("outra mídia não conta: o mangá de Death Note continua sugestão para quem viu o anime", () => {
    expect(inKnownFranchise(known(t("Death Note", "anime")), t("Death Note", "manga"))).toBe(false);
  });
});
