import http from "node:http";

const e = (id, title, status, score, genres, tags = []) => ({
  status, score,
  media: { id, seasonYear: 2010, countryOfOrigin: "JP", title: { romaji: title, english: null }, coverImage: { large: `https://s4.anilist.co/file/x/bx${id}.jpg` }, genres, tags: tags.map(([name, rank]) => ({ name, rank })) },
});
const ENTRIES = [
  e(1535, "Death Note", "COMPLETED", 10, ["Mystery", "Psychological", "Thriller"], [["Detective", 90], ["Philosophy", 70]]),
  e(1, "Cowboy Bebop", "COMPLETED", 9, ["Action", "Adventure", "Sci-Fi"], [["Space", 88], ["Noir", 60]]),
  e(19, "Monster", "COMPLETED", 9, ["Drama", "Mystery", "Psychological", "Thriller"], [["Detective", 80]]),
  e(9253, "Steins;Gate", "COMPLETED", 10, ["Drama", "Sci-Fi", "Thriller"], [["Time Manipulation", 95]]),
  e(20, "Naruto", "COMPLETED", 7, ["Action", "Adventure", "Comedy"], []),
  e(16498, "Attack on Titan", "COMPLETED", 8, ["Action", "Drama", "Fantasy", "Mystery"], [["War", 80], ["Post-Apocalyptic", 70]]),
  e(5114, "Fullmetal Alchemist: Brotherhood", "COMPLETED", 9, ["Action", "Adventure", "Drama", "Fantasy"], [["War", 60]]),
  e(21, "One Piece", "CURRENT", 0, ["Action", "Adventure", "Comedy", "Drama", "Fantasy"], []),
  e(30, "Neon Genesis Evangelion", "DROPPED", 4, ["Action", "Drama", "Mecha", "Psychological", "Sci-Fi"], [["Philosophy", 80]]),
  e(32, "Haikyu!!", "PLANNING", 0, ["Comedy", "Drama", "Sports"], []),
  e(33, "Anime sem generos", "COMPLETED", 6, [], []),
];
const DATA = { data: { MediaListCollection: { lists: [
  { entries: ENTRIES },
  { entries: [ENTRIES[0], ENTRIES[1]] },           // lista personalizada repete obras
] } } };

const EVENTS = [];
const TABLES = { profiles: [], activity: [], follows: [], comments: [], blocks: [], reports: [], likes: [] }; const T_PROFILES = () => TABLES.profiles;
const USERS = new Map(), LIBS = new Map(), SAVES = [], DELETED = [], RECOVER = [], FAIL = { sync: false };
const AUTH = { tmdb: "Bearer tmdbtoken", igdbId: "cid", igdbTok: "Bearer tok" };
const TMDB_MOVIES = [
  { id: 438631, poster_path: "/duna.jpg", media_type: "movie", title: "Duna", release_date: "2021-09-15", genre_ids: [878, 12], origin_country: ["US"] },
  { id: 777, media_type: "person", name: "Alguém" },
  { id: 85552, media_type: "tv", name: "Euphoria", first_air_date: "2019-06-16", genre_ids: [18], origin_country: ["US"] },
];
const DISC_MOVIE = [{ id: 603, title: "Matrix", release_date: "1999-03-30", genre_ids: [878, 28], origin_country: ["US"] }];
const DISC_TV = [{ id: 1396, name: "Mr. Robot", first_air_date: "2015-06-24", genre_ids: [18, 80], origin_country: ["US"] }];
const IGDB_SEARCH = [{ id: 119133, cover: { image_id: "co4jni" }, name: "Elden Ring", first_release_date: 1645747200, genres: [{ name: "Role-playing (RPG)" }], themes: [{ name: "Fantasy" }] }];
const IGDB_DISC = [{ id: 1942, name: "The Witcher 3 Clone", first_release_date: 1431993600, genres: [{ name: "Role-playing (RPG)" }], themes: [{ name: "Fantasy" }] }];
const AL_MEDIA = (id, title, genres) => ({ id, seasonYear: 2012, countryOfOrigin: "JP", title: { romaji: title, english: null }, coverImage: { large: `https://s4.anilist.co/file/x/bx${id}.jpg` }, genres, tags: [] });
const AL_SEARCH = [AL_MEDIA(777001, "Psycho-Pass", ["Sci-Fi", "Psychological", "Thriller"])];
const AL_DISC = [AL_MEDIA(777002, "Ergo Proxy", ["Sci-Fi", "Psychological", "Mystery"])];

const AL_MANGA_SEARCH = [AL_MEDIA(888001, "Pluto Mock", ["Sci-Fi", "Mystery"])];
const AL_MANGA_DISC = [AL_MEDIA(888002, "Gantz Mock", ["Sci-Fi", "Horror"])];
const OL_DOC = (key, title, author, subject) => ({ key: `/works/${key}`, title, author_name: [author], first_publish_year: 1949, subject, cover_i: 12345, ratings_average: 4.1, ratings_count: 900 });
const OL_SEARCH = [OL_DOC("OL777W", "Arrakis Mock", "Frank Mock", ["Science fiction", "Adventure"])];
const OL_DISC = [OL_DOC("OL778W", "Neuromante Mock", "William Mock", ["Cyberpunk", "Science fiction"])];

const MB_ID1 = "11111111-1111-4111-8111-111111111111", MB_ID2 = "22222222-2222-4222-8222-222222222222", MB_LIVE = "33333333-3333-4333-8333-333333333333";
const MB_GROUP = (id, title, artist, tags, sec = []) => ({ id, title, "primary-type": "Album", "secondary-types": sec, "first-release-date": "1997-05-21", "artist-credit": [{ name: artist }], tags });
const MB_SEARCH = [MB_GROUP(MB_ID1, "Disco Mock", "Banda Mock", [{ name: "alternative rock", count: 9 }, { name: "electronic", count: 4 }]), MB_GROUP(MB_LIVE, "Disco Mock Ao Vivo", "Banda Mock", [{ name: "rock", count: 5 }], ["Live"])];
const MB_DISC = [MB_GROUP(MB_ID2, "Descoberta Mock", "Outra Banda", [{ name: "indie", count: 7 }, { name: "folk", count: 3 }]), MB_GROUP("44444444-4444-4444-8444-444444444444", "Obscuro Mock", "Ninguem", [{ name: "indie", count: 1 }])];

http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
    const send = (code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };

    if (url.pathname === "/__events") return send(200, EVENTS);
    if (url.pathname === "/rest/v1/test_events" && req.method === "POST") {
      if (!req.headers.apikey) return send(401, {});
      EVENTS.push(JSON.parse(body)); return send(201, {});
    }

    // ---- Supabase (GoTrue + PostgREST) falso, só para os e2e de conta e sync ----
    if (url.pathname.startsWith("/auth/v1/") || url.pathname.startsWith("/rest/v1/")) {
      const b = (() => { try { return JSON.parse(body || "{}"); } catch { return {}; } })();
      const mkSession = (u) => {
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
        const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", exp })}.sig`;
        return { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: `rt-${u.id}`, user: userObj(u) };
      };
      const userObj = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: new Date().toISOString(), identities: [{ id: u.id }], app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
      const authUser = () => {
        const t = (req.headers.authorization ?? "").replace("Bearer ", "");
        try { const sub = JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()).sub; return [...USERS.values()].find((u) => u.id === sub); } catch { return undefined; }
      };
      if (url.pathname === "/auth/v1/settings") return send(200, { external: { email: true, google: false, apple: false }, disable_signup: false, mailer_autoconfirm: false });
      if (url.pathname === "/auth/v1/signup") {
        const email = String(b.email).toLowerCase();
        if (String(b.password ?? "").length < 8) return send(422, { code: 422, error_code: "weak_password", msg: "Password should be at least 8 characters." });
        if (USERS.has(email)) return send(200, { ...userObj({ id: "fake", email }), identities: [] });
        const u = { id: `u-${USERS.size + 1}`, email, password: b.password, confirmed: !email.startsWith("confirma") };
        USERS.set(email, u);
        return send(200, u.confirmed ? mkSession(u) : userObj(u));
      }
      if (url.pathname === "/auth/v1/token") {
        const grant = url.searchParams.get("grant_type");
        if (grant === "refresh_token") {
          const u = [...USERS.values()].find((x) => `rt-${x.id}` === b.refresh_token);
          return u ? send(200, mkSession(u)) : send(400, { code: 400, error_code: "refresh_token_not_found", msg: "x" });
        }
        const u = USERS.get(String(b.email).toLowerCase());
        if (!u || u.password !== b.password) return send(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
        if (!u.confirmed) return send(400, { code: 400, error_code: "email_not_confirmed", msg: "Email not confirmed" });
        return send(200, mkSession(u));
      }
      if (url.pathname === "/auth/v1/user") { const u = authUser(); return u ? send(200, userObj(u)) : send(401, { code: 401, error_code: "bad_jwt", msg: "x" }); }
      if (url.pathname === "/auth/v1/logout") { res.statusCode = 204; return res.end(); }
      if (url.pathname === "/auth/v1/recover") { RECOVER.push(b.email); return send(200, {}); }
      if (url.pathname === "/rest/v1/libraries" && req.method === "GET") {
        const u = authUser(); if (!u) return send(401, { message: "JWT" });
        if (FAIL.sync) return send(500, { message: "banco fora do ar" });
        const row = LIBS.get(u.id);
        const one = /pgrst\.object/.test(req.headers.accept ?? "");
        if (one) return row ? send(200, row) : send(406, { code: 406, error_code: "PGRST116", msg: "no rows" });
        return send(200, row ? [row] : []);
      }

      // ---- tabelas sociais, com as mesmas regras (RLS) e restrições do banco real ----
      const TBL = url.pathname.match(/^\/rest\/v1\/(profiles|activity|follows|comments|blocks|reports|likes)$/)?.[1];
      if (TBL) {
        const me = authUser();
        const uid = me?.id;
        const T = TABLES[TBL];
        const isPublic = (id) => T_PROFILES().find((r) => r.id === id)?.is_public;
        const visible = (r) => TBL === "profiles" ? (r.is_public || r.id === uid)
          : TBL === "activity" ? (r.user_id === uid || isPublic(r.user_id))
          : TBL === "comments" ? ((r.author_id === uid || r.target_user === uid || isPublic(r.target_user))
              && (!r.hidden || r.author_id === uid || r.target_user === uid)
              && !TABLES.blocks.some((x) => x.blocker === uid && x.blocked === r.author_id))
          : TBL === "likes" ? ((r.user_id === uid || r.target_user === uid || isPublic(r.target_user)) && !TABLES.blocks.some((x) => x.blocker === uid && x.blocked === r.user_id))
          : TBL === "blocks" ? r.blocker === uid
          : TBL === "reports" ? r.reporter === uid
          : (r.follower_id === uid || r.followee_id === uid);
        if (!me && TBL === "follows") return send(401, { code: "42501", message: "permission denied for table follows" });
        const params = [...url.searchParams.entries()].filter(([k]) => !["select", "order", "limit", "on_conflict", "or"].includes(k));
        const match = (r) => params.every(([k, v]) => {
          if (v === "not.is.null") return r[k] !== null && r[k] !== undefined;
          if (v.startsWith("eq.")) return String(r[k]) === v.slice(3);
          if (v.startsWith("in.(")) return v.slice(4, -1).split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(r[k]));
          return true;
        }) && (() => {
          const or = url.searchParams.get("or"); if (!or) return true;
          return or.slice(1, -1).split(",").some((c) => { const [col, op, ...val] = c.split("."); const pat = val.join(".").replace(/%/g, ""); return op === "ilike" && String(r[col] ?? "").toLowerCase().includes(pat.toLowerCase()); });
        })();
        const keyOf = (r) => TBL === "profiles" ? r.id : TBL === "activity" ? `${r.user_id}|${r.item_id}` : TBL === "comments" || TBL === "reports" ? r.id : TBL === "likes" ? `${r.user_id}|${r.target_user}|${r.target_item}` : TBL === "blocks" ? `${r.blocker}|${r.blocked}` : `${r.follower_id}|${r.followee_id}`;
        const checkProfile = (r) => {
          if (!/^[a-z0-9_]{3,20}$/.test(r.handle ?? "") || ["admin","hobby","suporte","api","perfil","entrar","conta","comunidade","u","root","support"].includes(r.handle)) return "23514";
          if ((r.bio ?? "").length > 160 || (r.name ?? "").length > 40) return "23514";
          if (T.some((o) => o.handle === r.handle && o.id !== r.id)) return "23505";
          return null;
        };
        const proj = (r) => { const sel = url.searchParams.get("select"); if (!sel || sel === "*") return r; return Object.fromEntries(sel.split(",").map((c) => [c, r[c]])); };
        if (req.method === "GET") {
          let rows = T.filter((r) => visible(r) && match(r));
          const ord = url.searchParams.get("order"); if (ord) { const [c, d] = ord.split("."); rows.sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1) * (d === "desc" ? -1 : 1)); }
          const lim = Number(url.searchParams.get("limit")); if (lim) rows = rows.slice(0, lim);
          rows = rows.map(proj);
          if (/pgrst\.object/.test(req.headers.accept ?? "")) return rows.length === 1 ? send(200, rows[0]) : send(406, { code: "PGRST116", message: "no rows" });
          return send(200, rows);
        }
        if (!me) return send(401, { code: "42501", message: "permission denied" });
        const now = new Date().toISOString();
        if (req.method === "POST") {
          const list = Array.isArray(b) ? b : [b];
          const ignore = /ignore-duplicates/.test(req.headers.prefer ?? "");
          const merge = /merge-duplicates/.test(req.headers.prefer ?? "");
          for (const r0 of list) {
            const r = { ...r0 };
            if (TBL === "profiles" && r.id !== uid) return send(403, { code: "42501", message: "new row violates row-level security policy" });
            if (TBL === "activity") {
              if (r.user_id !== uid || !isPublic(uid)) return send(403, { code: "42501", message: "new row violates row-level security policy for table activity" });
              const pr = T_PROFILES().find((x) => x.id === uid);
              if (r.review && !pr.share_reviews) return send(403, { code: "42501", message: "new row violates row-level security policy for table activity" });
              r.updated_at = now;
            }
            if (TBL === "likes") {
              const pr = T_PROFILES().find((x) => x.id === uid);
              if (r.user_id !== uid || r.target_user === uid || !pr?.is_public || !isPublic(r.target_user) || TABLES.blocks.some((x) => x.blocker === r.target_user && x.blocked === uid)) return send(403, { code: "42501", message: "new row violates row-level security policy for table likes" });
              if (!TABLES.activity.some((a) => a.user_id === r.target_user && a.item_id === r.target_item)) return send(409, { code: "23503", message: "foreign key" });
              r.created_at = now;
            }
            if (TBL === "comments") {
              const pr = T_PROFILES().find((x) => x.id === uid);
              if (TABLES.blocks.some((x) => x.blocker === r.target_user && x.blocked === uid)) return send(403, { code: "42501", message: "new row violates row-level security policy for table comments" });
              if (r.author_id !== uid || !pr?.is_public || !isPublic(r.target_user)) return send(403, { code: "42501", message: "new row violates row-level security policy for table comments" });
              const body = String(r.body ?? "").trim();
              if (body.length < 1 || body.length > 500) return send(400, { code: "23514", message: "check constraint" });
              if (!TABLES.activity.some((a) => a.user_id === r.target_user && a.item_id === r.target_item)) return send(409, { code: "23503", message: "foreign key" });
              const recent = T.filter((c) => c.author_id === uid && Date.now() - Date.parse(c.created_at) < 60000).length;
              if (recent >= 10) return send(400, { code: "54000", message: "muitos comentários em pouco tempo" });
              if (r.parent_id) { const par = T.find((c) => c.id === r.parent_id); if (!par || par.parent_id || par.target_user !== r.target_user || par.target_item !== r.target_item) return send(400, { code: "23514", message: "resposta inválida" }); }
              r.id = `c-${T.length + 1}-${Math.random().toString(36).slice(2, 8)}`; r.created_at = now;
            }
            if (TBL === "blocks") return send(403, { code: "42501", message: "permission denied for table blocks" });
            if (TBL === "reports") {
              const c = TABLES.comments.find((x) => x.id === r.comment_id);
              if (r.reporter !== uid || !c || c.author_id === uid) return send(403, { code: "42501", message: "new row violates row-level security policy for table reports" });
              if (!["spam", "ofensivo", "outro"].includes(r.reason)) return send(400, { code: "23514", message: "check constraint" });
              if (T.some((x) => x.reporter === uid && x.comment_id === r.comment_id)) return send(409, { code: "23505", message: "duplicate" });
              if (T.filter((x) => x.reporter === uid && Date.now() - Date.parse(x.created_at) < 3600000).length >= 20) return send(400, { code: "54000", message: "muitas denúncias" });
              r.id = `r-${T.length + 1}`; r.created_at = now;
              T.push(r);
              if (new Set(T.filter((x) => x.comment_id === r.comment_id).map((x) => x.reporter)).size >= 3) c.hidden = true;
              continue;
            }
            if (TBL === "follows") {
              if (TABLES.blocks.some((x) => x.blocker === r.followee_id && x.blocked === uid)) return send(403, { code: "42501", message: "new row violates row-level security policy for table follows" });
              if (r.follower_id !== uid || !isPublic(r.followee_id) || r.follower_id === r.followee_id) return send(403, { code: "42501", message: "new row violates row-level security policy for table follows" });
              r.created_at = now;
            }
            if (TBL === "profiles") { const full = { is_public: false, share_reviews: false, bio: "", ...r, updated_at: now }; const c = checkProfile(full); if (c) return send(c === "23505" ? 409 : 400, { code: c, message: "constraint" }); Object.assign(r, full); }
            const i = T.findIndex((o) => keyOf(o) === keyOf(r));
            if (i >= 0) { if (ignore) continue; if (!merge) return send(409, { code: "23505", message: "duplicate" }); T[i] = { ...T[i], ...r }; } else T.push(r);
          }
          res.statusCode = 201; return res.end();
        }
        if (req.method === "PATCH") {
          if (TBL === "comments") {
            const bodyTxt = String(b.body ?? "").trim();
            if (b.body !== undefined && (bodyTxt.length < 1 || bodyTxt.length > 500)) return send(400, { code: "23514", message: "check constraint" });
            for (const r of T.filter((c) => c.author_id === uid && match(c))) { if (b.body !== undefined) r.body = b.body; if (b.edited_at) r.edited_at = b.edited_at; }
            res.statusCode = 204; return res.end();
          }
          const mine = T.filter((r) => (TBL === "profiles" ? r.id === uid : r.user_id === uid) && match(r));
          for (const r of mine) Object.assign(r, b, { updated_at: now });
          res.statusCode = 204; return res.end();
        }
        if (req.method === "DELETE") {
          const own = (r) => (TBL === "profiles" ? r.id === uid : TBL === "activity" ? r.user_id === uid : TBL === "comments" ? (r.author_id === uid || r.target_user === uid) : TBL === "blocks" ? r.blocker === uid : TBL === "reports" ? false : TBL === "likes" ? r.user_id === uid : r.follower_id === uid);
          for (let i = T.length - 1; i >= 0; i--) if (own(T[i]) && match(T[i])) {
            const gone = T.splice(i, 1)[0];
            if (TBL === "activity") { TABLES.comments = TABLES.comments.filter((c) => !(c.target_user === gone.user_id && c.target_item === gone.item_id)); TABLES.likes = TABLES.likes.filter((l) => !(l.target_user === gone.user_id && l.target_item === gone.item_id)); } // ON DELETE CASCADE
          }
          res.statusCode = 204; return res.end();
        }
      }
      if (url.pathname === "/rest/v1/rpc/save_library") {
        const u = authUser(); if (!u) return send(401, { message: "JWT" });
        if (FAIL.sync) return send(500, { message: "banco fora do ar" });
        const row = LIBS.get(u.id);
        SAVES.push({ user: u.email, expected: b.p_expected });
        if (b.p_expected === 0) { if (row) return send(200, null); LIBS.set(u.id, { data: b.p_data, rev: 1 }); return send(200, 1); }
        if (!row || row.rev !== b.p_expected) return send(200, null);
        row.data = b.p_data; row.rev += 1; return send(200, row.rev);
      }
      const ADMINS = ["admin@ex.com"];
      if (url.pathname === "/rest/v1/rpc/is_admin") { const u = authUser(); if (!u) return send(401, { message: "JWT" }); return send(200, ADMINS.includes(u.email)); }
      if (url.pathname === "/rest/v1/rpc/admin_reports") {
        const u = authUser(); if (!u) return send(401, { message: "JWT" });
        if (!ADMINS.includes(u.email)) return send(403, { code: "42501", message: "não autorizado" });
        const out = TABLES.comments.filter((c) => TABLES.reports.some((r) => r.comment_id === c.id)).map((c) => {
          const rs = TABLES.reports.filter((r) => r.comment_id === c.id);
          return { comment_id: c.id, body: c.body, author_id: c.author_id, author_handle: T_PROFILES().find((p) => p.id === c.author_id)?.handle ?? null, target_user: c.target_user, target_item: c.target_item, hidden: !!c.hidden, reports: rs.length, reasons: [...new Set(rs.map((r) => r.reason))], last_report: rs[rs.length - 1].created_at };
        }).sort((a, b) => b.reports - a.reports);
        return send(200, out);
      }
      if (url.pathname === "/rest/v1/rpc/admin_moderate") {
        const u = authUser(); if (!u) return send(401, { message: "JWT" });
        if (!ADMINS.includes(u.email)) return send(403, { code: "42501", message: "não autorizado" });
        if (b.p_action === "hide") TABLES.comments.forEach((c) => { if (c.id === b.p_comment) c.hidden = true; });
        else if (b.p_action === "restore") { TABLES.comments.forEach((c) => { if (c.id === b.p_comment) c.hidden = false; }); TABLES.reports = TABLES.reports.filter((r) => r.comment_id !== b.p_comment); }
        else if (b.p_action === "delete") { TABLES.comments = TABLES.comments.filter((c) => c.id !== b.p_comment); TABLES.reports = TABLES.reports.filter((r) => r.comment_id !== b.p_comment); }
        else return send(400, { code: "22023", message: "ação inválida" });
        res.statusCode = 204; return res.end();
      }
      if (url.pathname === "/rest/v1/rpc/block_user") {
        const u = authUser(); if (!u) return send(401, { message: "JWT" });
        if (!b.p_user || b.p_user === u.id) return send(400, { code: "22023", message: "alvo inválido" });
        if (!TABLES.blocks.some((x) => x.blocker === u.id && x.blocked === b.p_user)) TABLES.blocks.push({ blocker: u.id, blocked: b.p_user, created_at: new Date().toISOString() });
        TABLES.follows = TABLES.follows.filter((f) => !((f.follower_id === u.id && f.followee_id === b.p_user) || (f.follower_id === b.p_user && f.followee_id === u.id)));
        res.statusCode = 204; return res.end();
      }
      if (url.pathname === "/rest/v1/rpc/delete_my_account") {
        const u = authUser(); if (!u) return send(401, { message: "JWT" });
        LIBS.delete(u.id); USERS.delete(u.email);
        for (const t of ["profiles", "activity", "follows", "comments", "blocks", "reports", "likes"]) TABLES[t] = TABLES[t].filter((r) => ![r.id, r.user_id, r.follower_id, r.followee_id, r.author_id, r.target_user, r.blocker, r.blocked, r.reporter].includes(u.id)); DELETED.push(u.email); res.statusCode = 204; return res.end();
      }
    }
    // controles de teste
    const b = (() => { try { return JSON.parse(body || "{}"); } catch { return {}; } })();
    if (url.pathname === "/__cloud") return send(200, { libs: Object.fromEntries([...LIBS].map(([k, v]) => [k, v])), tables: TABLES, saves: SAVES, deleted: DELETED, recover: RECOVER, users: [...USERS.keys()] });
    if (url.pathname === "/__putlib" && req.method === "POST") { // simula outro aparelho gravando
      const u = USERS.get(b.email); const row = LIBS.get(u.id);
      LIBS.set(u.id, { data: b.data, rev: (row?.rev ?? 0) + 1 }); return send(200, {});
    }
    if (url.pathname === "/__fail" && req.method === "POST") { FAIL.sync = !!b.sync; return send(200, {}); }
    if (url.pathname === "/oauth2/token") {
      return url.searchParams.get("client_id") === AUTH.igdbId && url.searchParams.get("client_secret") === "csecret"
        ? send(200, { access_token: "tok", expires_in: 3600 }) : send(400, {});
    }
    if (url.pathname.startsWith("/3/")) {
      if (req.headers.authorization !== AUTH.tmdb) return send(401, {});
      if (url.pathname === "/3/search/multi") {
        const qq = url.searchParams.get("query");
        if (qq === "boom") return send(500, {});
        if (/blade runner/i.test(qq)) return send(200, { results: [{ id: 78, media_type: "movie", title: "Blade Runner", poster_path: "/br.jpg", release_date: "1982-06-25", genre_ids: [878] }] });
        return send(200, { results: /dune|duna/i.test(qq) ? TMDB_MOVIES : [] });
      }
      if (url.pathname === "/3/search/movie") {
        const q = url.searchParams.get("query");
        const M = {
          "Duna": { id: 438631, title: "Duna", release_date: "2021-09-15", genre_ids: [878, 12], origin_country: ["US"] },
          "Cidade de Deus, o filme": { id: 598, title: "Cidade de Deus", release_date: "2002-08-30", genre_ids: [80, 18], origin_country: ["BR"] },
          "Matrix": { id: 603, title: "Matrix", release_date: "1999-03-30", genre_ids: [878, 28], origin_country: ["US"] },
        };
        return send(200, { results: M[q] ? [M[q]] : [] });
      }
      if (url.pathname === "/3/movie/438631") return send(200, {
        release_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        overview: "Um jovem herdeiro viaja ao planeta deserto Arrakis.", runtime: 155, vote_average: 8.1, vote_count: 9000,
        genres: [{ name: "Ficção científica" }, { name: "Aventura" }],
        credits: { cast: [{ name: "Timothée Chalamet" }, { name: "Zendaya" }], crew: [{ name: "Denis Villeneuve", job: "Director" }] },
        videos: { results: [{ site: "YouTube", type: "Trailer", key: "duneTrailer1", official: true }] },
        "watch/providers": { results: { BR: { link: "https://www.themoviedb.org/movie/438631/watch?locale=BR", flatrate: [{ provider_name: "Max" }], rent: [{ provider_name: "Apple TV" }], buy: [{ provider_name: "Google Play Filmes" }] } } },
      });
      if (url.pathname === "/3/discover/movie") return send(200, { results: DISC_MOVIE });
      if (url.pathname === "/3/discover/tv") return send(200, { results: DISC_TV });
    }
    if (url.pathname === "/v4/games") {
      if (req.headers["client-id"] !== AUTH.igdbId || req.headers.authorization !== AUTH.igdbTok) return send(401, {});
      if (/summary, first_release_date, total_rating/.test(body)) return send(200, !/hades/i.test(body) ? [] : [{ first_release_date: Math.floor(Date.now() / 1000) + 20 * 86400, summary: "Fuja do submundo grego.", total_rating: 91, total_rating_count: 200, platforms: [{ name: "PC" }], websites: [{ category: 13, url: "https://store.steampowered.com/app/1145360" }, { category: 1, url: "https://oficial.example" }], genres: [{ name: "Indie" }], involved_companies: [{ developer: true, company: { name: "Supergiant Games" } }], videos: [{ video_id: "hadesVid123" }], similar_games: [{ name: "Dead Cells" }] }]);
      if (/hades/i.test(body)) return send(200, [{ id: 7, name: "Hades", cover: { image_id: "hadescover" }, genres: [], themes: [] }]);
      return send(200, body.startsWith("search") ? (/dune|elden/i.test(body) ? IGDB_SEARCH : []) : IGDB_DISC);
    }
    // MusicBrainz
    if (url.pathname === "/ws/2/release-group") {
      const q = url.searchParams.get("query") ?? "";
      if (req.headers["user-agent"] === undefined) return send(400, {}); // o MusicBrainz exige User-Agent
      if (/boommb/i.test(q)) return send(503, {});
      return send(200, { "release-groups": /tag:/.test(q) ? MB_DISC : /disco|mock|banda|dune/i.test(q) ? MB_SEARCH : [] });
    }
    if (url.pathname === `/ws/2/release-group/${MB_ID1}`) return send(200, { "primary-type": "Album", "first-release-date": "1997-05-21", "artist-credit": [{ name: "Banda Mock" }], tags: [{ name: "alternative rock", count: 9 }, { name: "electronic", count: 4 }] });
    // Open Library
    if (url.pathname === "/search.json") {
      const q = url.searchParams.get("q") ?? "";
      return send(200, { docs: q.includes("subject:") ? OL_DISC : /dune|arrakis|mock/i.test(q) ? OL_SEARCH : [] });
    }
    if (url.pathname === "/works/OL777W.json") return send(200, { description: { value: "Um duque muda de planeta.\r\n----------\r\nlinks de fonte" }, subjects: ["Science fiction", "Accessible book", "Adventure"] });
    // AniList (POST /)
    const parsed = JSON.parse(body || "{}");
    const v = parsed.variables ?? {};
    if (v.ids !== undefined) return send(200, { data: { Page: { media: ENTRIES.filter((e) => v.ids.includes(e.media.id)).map((e) => ({ ...e.media, idMal: e.media.id })) } } });
    if ((parsed.query ?? "").includes("Media(")) return send(200, { data: { Media: { nextAiringEpisode: { airingAt: Math.floor(Date.now() / 1000) + 2 * 86400, episode: 5 }, description: "Um estudante acha um caderno.<br>Ele muda o mundo.", format: "TV", episodes: 37, averageScore: 85, trailer: { id: "dnTrailer12", site: "youtube" }, studios: { nodes: [{ name: "Madhouse", isAnimationStudio: true }] }, recommendations: { nodes: [] } } } });
    const isManga = (parsed.query ?? "").includes("type: MANGA");
    if (v.q !== undefined) return send(200, { data: { Page: { media: isManga ? (/dune|pluto|mock/i.test(v.q) ? AL_MANGA_SEARCH : []) : /dune|psycho/i.test(v.q) ? AL_SEARCH : [] } } });
    if (v.g !== undefined) return send(200, { data: { Page: { media: isManga ? AL_MANGA_DISC : AL_DISC } } });
    const user = v.userName;
    if (user === "mockuser") return send(200, DATA);
    if (user === "privado") return send(403, { errors: [{ message: "Private User", status: 403 }] });
    if (user === "slow429") return send(429, { errors: [{ message: "Too Many Requests.", status: 429 }] });
    send(404, { errors: [{ message: "User not found", status: 404 }] });
  });
}).listen(4010, () => console.log("mock apis on 4010"));
