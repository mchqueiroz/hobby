import { describe, expect, it } from "vitest";
import { cacheFor } from "../sources";
import type { RemoteResult } from "../remote";

const res = (musicbrainz: "ok" | "error"): RemoteResult => ({
  items: [],
  sources: { tmdb: "ok", igdb: "off", anilist: "ok", openlibrary: "ok", musicbrainz },
});

describe("cacheFor", () => {
  it("guarda pouco tempo quando alguma fonte falhou", () => {
    expect(cacheFor(res("error"), 600, 3600)).toBe("public, max-age=0, s-maxage=30");
  });
  it("usa o cache longo quando tudo respondeu", () => {
    expect(cacheFor(res("ok"), 600, 3600)).toBe("public, max-age=0, s-maxage=600, stale-while-revalidate=3600");
  });
});
