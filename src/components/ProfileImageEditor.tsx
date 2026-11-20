"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CENTER, checkFile, ACCEPTED_TYPES, drawCrop, exportJpeg, loadImage, MAX_ZOOM, panBy, type Crop, type Loaded } from "@/lib/image";
import { MEDIA_HUE, bannerGradient } from "@/lib/palette";
import { updateProfile, type Banner, type Profile } from "@/lib/profile";
import { MEDIAS, MEDIA_LABEL, type Media } from "@/lib/types";

const AVATAR = { w: 320, h: 320 };
const BANNER = { w: 1200, h: 400 };

/** Estilo de fundo de um banner que não é foto. `auto` usa a cor que o Hero calculou do gosto. */
export function bannerStyle(b: Banner | undefined, auto: string): CSSProperties {
  if (b?.kind === "image") return { backgroundImage: `url(${b.data})`, backgroundSize: "cover", backgroundPosition: "center" };
  if (b?.kind === "media") return { backgroundImage: bannerGradient({ h: MEDIA_HUE[b.media], s: 0.5, l: 0.45 }) };
  return { backgroundImage: auto };
}

/**
 * Janela para trocar a foto ou o banner. Enquadramento por arrastar e por controles
 * (zoom, horizontal, vertical), para funcionar também com teclado e leitor de tela.
 * O que aparece na prévia é exatamente o que será salvo.
 */
export function ProfileImageEditor({
  kind, profile, mainMedia, autoBanner, onClose,
}: { kind: "avatar" | "banner"; profile: Profile; mainMedia: Media; autoBanner: string; onClose: () => void }) {
  const isAvatar = kind === "avatar";
  const size = isAvatar ? AVATAR : BANNER;
  const aspect = size.w / size.h;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [crop, setCrop] = useState<Crop>(CENTER);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<Banner>(profile.banner ?? { kind: "auto" });
  const [color, setColor] = useState<Media | undefined>(profile.color);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const loadedRef = useRef<Loaded | null>(null);
  const title = isAvatar ? "Foto de perfil" : "Banner do perfil";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => () => loadedRef.current?.dispose(), []);

  useEffect(() => {
    if (loaded && canvas.current) drawCrop(canvas.current, loaded, crop);
  }, [loaded, crop]);

  async function pickFile(f: File | undefined) {
    if (!f) return;
    const bad = checkFile(f);
    if (bad) return setError(bad);
    setError("");
    try {
      const img = await loadImage(f);
      loadedRef.current?.dispose();
      loadedRef.current = img;
      setCrop(CENTER);
      setLoaded(img);
    } catch {
      setError("Não consegui abrir essa imagem. Tente outra.");
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !loaded) return;
    const w = e.currentTarget.getBoundingClientRect().width || 1;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    drag.current = { id: d.id, x: e.clientX, y: e.clientY };
    setCrop((c) => panBy(loaded.width, loaded.height, aspect, c, w, dx, dy));
  }

  function save() {
    setBusy(true);
    setError("");
    try {
      let ok: boolean;
      if (isAvatar) {
        ok = loaded
          ? updateProfile({ avatar: exportJpeg(loaded, AVATAR.w, AVATAR.h, crop), color: color ?? null })
          : updateProfile({ color: color ?? null });
      } else {
        const banner: Banner = loaded ? { kind: "image", data: exportJpeg(loaded, BANNER.w, BANNER.h, crop) } : choice;
        ok = updateProfile({ banner });
      }
      if (!ok) return setError("O navegador não deixou guardar a imagem (sem espaço ou armazenamento bloqueado).");
      onClose();
    } catch {
      setError("Não consegui preparar essa imagem. Tente uma menor.");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (isAvatar) updateProfile({ avatar: null });
    else updateProfile({ banner: { kind: "auto" } });
    onClose();
  }

  const hasStored = isAvatar ? !!profile.avatar : profile.banner?.kind === "image";
  const swatch = (m: Media): CSSProperties => ({ backgroundImage: bannerGradient({ h: MEDIA_HUE[m], s: 0.5, l: 0.45 }) });

  // no <body>: um ancestral com transform/animação prenderia o "fixed" dentro do cartão
  return createPortal(
    <>
      <div className="backdrop" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" aria-hidden="true" />
        <h2>{title}</h2>

        {/* prévia */}
        <div className="mt16" style={{ display: "grid", placeItems: "center" }}>
          {loaded ? (
            <canvas
              ref={canvas} width={size.w / (isAvatar ? 1 : 2)} height={size.h / (isAvatar ? 1 : 2)}
              className={isAvatar ? "crop-avatar" : "crop-banner"}
              aria-label={`Prévia. Arraste para ajustar o enquadramento.`}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}
            />
          ) : isAvatar ? (
            <div className="crop-avatar" aria-label="Prévia" role="img"
              style={profile.avatar ? { backgroundImage: `url(${profile.avatar})`, backgroundSize: "cover" } : { background: `var(--${color ?? mainMedia})` }}>
              {!profile.avatar && <span className="sr">Sem foto: iniciais sobre a cor escolhida</span>}
            </div>
          ) : (
            <div className="crop-banner" role="img" aria-label="Prévia" style={bannerStyle(choice, autoBanner)} />
          )}
        </div>

        {loaded && (
          <div className="mt12" style={{ display: "grid", gap: 6 }}>
            <label className="row" style={{ gap: 10, fontSize: 13 }}>
              <span style={{ width: 84 }}>Zoom</span>
              <input type="range" min={1} max={MAX_ZOOM} step={0.05} value={crop.zoom} style={{ flex: 1 }}
                onChange={(e) => setCrop({ ...crop, zoom: Number(e.target.value) })} />
            </label>
            <label className="row" style={{ gap: 10, fontSize: 13 }}>
              <span style={{ width: 84 }}>Horizontal</span>
              <input type="range" min={-1} max={1} step={0.02} value={crop.x} style={{ flex: 1 }}
                onChange={(e) => setCrop({ ...crop, x: Number(e.target.value) })} />
            </label>
            <label className="row" style={{ gap: 10, fontSize: 13 }}>
              <span style={{ width: 84 }}>Vertical</span>
              <input type="range" min={-1} max={1} step={0.02} value={crop.y} style={{ flex: 1 }}
                onChange={(e) => setCrop({ ...crop, y: Number(e.target.value) })} />
            </label>
          </div>
        )}

        <div className="row gap8 mt12" style={{ flexWrap: "wrap" }}>
          <label className="btn ghost small" style={{ width: "auto", cursor: "pointer" }}>
            {loaded ? "Escolher outra" : isAvatar ? "Escolher foto" : "Enviar imagem"}
            <input type="file" className="sr" data-testid={`file-${kind}`} accept={ACCEPTED_TYPES.join(",")}
              onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {hasStored && !loaded && (
            <button type="button" className="btn ghost small" style={{ width: "auto" }} onClick={remove}>
              {isAvatar ? "Remover foto" : "Remover imagem"}
            </button>
          )}
        </div>

        {/* cor do avatar (sem foto) ou presets do banner */}
        {isAvatar ? (
          !profile.avatar && !loaded && (
            <>
              <p className="label">Cor do avatar</p>
              <div className="row gap8" style={{ flexWrap: "wrap" }} role="group" aria-label="Cor do avatar">
                <button type="button" className="chip" aria-pressed={!color} onClick={() => setColor(undefined)}>Automática</button>
                {MEDIAS.map((m) => (
                  <button key={m} type="button" className="chip" aria-pressed={color === m} onClick={() => setColor(m)}>
                    <i className="dot" style={{ background: `var(--${m})`, marginRight: 6 }} />{MEDIA_LABEL[m]}
                  </button>
                ))}
              </div>
            </>
          )
        ) : (
          !loaded && (
            <>
              <p className="label">Ou escolha um degradê</p>
              <div className="row gap8" style={{ flexWrap: "wrap" }} role="group" aria-label="Degradê do banner">
                <button type="button" className="chip" aria-pressed={choice.kind === "auto"} onClick={() => setChoice({ kind: "auto" })}>
                  <i className="swatch" style={{ backgroundImage: autoBanner }} />Pelo seu gosto
                </button>
                {MEDIAS.map((m) => (
                  <button key={m} type="button" className="chip" aria-pressed={choice.kind === "media" && choice.media === m}
                    onClick={() => setChoice({ kind: "media", media: m })}>
                    <i className="swatch" style={swatch(m)} />{MEDIA_LABEL[m]}
                  </button>
                ))}
              </div>
            </>
          )
        )}

        <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>
          A imagem é recortada e reduzida aqui no seu aparelho, sem os dados da câmera (como o local da foto), e fica só neste navegador. Ela não é enviada a ninguém.
        </p>
        {error && <p role="alert" style={{ color: "var(--danger)", fontSize: 14, marginTop: 10 }}>{error}</p>}

        <div className="row gap8 mt16">
          <button type="button" className="btn ghost small" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn small" disabled={busy} onClick={save}>Salvar</button>
        </div>
      </div>
    </>,
    document.body,
  );
}
