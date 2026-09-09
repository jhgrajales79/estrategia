"use client";

import { useEffect, useState } from "react";
import { isVideoUrl, isHeicUrl } from "@/lib/media";

// Tamaños alternados tipo telar: un patrón fijo (no aleatorio) para que el mosaico se vea
// igual para todos y no salte al recargar. Se repite cada 7 azulejos.
const LOOM_SPANS = [
  "col-span-2 row-span-2",
  "col-span-1 row-span-1",
  "col-span-1 row-span-2",
  "col-span-1 row-span-1",
  "col-span-2 row-span-1",
  "col-span-1 row-span-1",
  "col-span-1 row-span-1",
];

const AUTOPLAY_IMAGE_MS = 4000;

export interface MediaGroup {
  label: string;
  media: string[];
}

export default function WeaveGalleryViewer({
  media,
  open,
  onClose,
  initialIndex = null,
  title = "Mural del tejido",
  icon = "🧶",
  itemLabelSingular = "momento",
  itemLabelPlural = "momentos capturados",
  groups,
}: {
  media: string[];
  open: boolean;
  onClose: () => void;
  initialIndex?: number | null;
  title?: string;
  icon?: string;
  itemLabelSingular?: string;
  itemLabelPlural?: string;
  // Si viene, el mosaico se muestra por secciones (una por sesión) en vez de una sola grilla
  // mezclada. Debe cubrir exactamente los mismos elementos que `media`, en el mismo orden
  // (concatenar groups[].media == media) — la navegación con flechas usa `media` tal cual.
  groups?: MediaGroup[];
}) {
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [autoplay, setAutoplay] = useState(false);
  // Un video con códec no soportado (HEVC de iPhone en "Alta eficiencia", típicamente) no
  // falla al subir — solo al intentar reproducirlo. Se detecta con onError y se trata igual
  // que un HEIC: aviso en vez de un recuadro vacío.
  const [failedVideos, setFailedVideos] = useState<Set<string>>(new Set());
  function markVideoFailed(url: string) {
    setFailedVideos((s) => new Set(s).add(url));
  }
  function isUnsupported(url: string) {
    return isHeicUrl(url) || (isVideoUrl(url) && failedVideos.has(url));
  }

  // Al abrir, enfoca el elemento indicado (si viene de un clic sobre una miniatura puntual);
  // al cerrar se resetea para no reabrir directo en el lightbox de la vez anterior.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFocusIndex(initialIndex);
    } else {
      setFocusIndex(null);
      setAutoplay(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (focusIndex !== null) setFocusIndex(null);
        else onClose();
      }
      if (focusIndex === null) return;
      if (e.key === "ArrowRight") setFocusIndex((i) => (i === null ? i : (i + 1) % media.length));
      if (e.key === "ArrowLeft") setFocusIndex((i) => (i === null ? i : (i - 1 + media.length) % media.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, focusIndex, media.length]);

  const current = focusIndex !== null ? media[focusIndex] : null;

  function groupLabelForIndex(i: number): string | null {
    if (!groups) return null;
    let offset = 0;
    for (const g of groups) {
      if (i < offset + g.media.length) return g.label;
      offset += g.media.length;
    }
    return null;
  }
  const currentGroupLabel = focusIndex !== null ? groupLabelForIndex(focusIndex) : null;

  // Reproducir el tejido completo: las fotos (y los archivos sin vista previa, para no
  // quedarse trabado esperando un "onEnded" que nunca llega) avanzan solas por tiempo; los
  // videos reproducibles avanzan al terminar.
  useEffect(() => {
    if (!autoplay || focusIndex === null || !current) return;
    if (isVideoUrl(current) && !isUnsupported(current)) return;
    const t = setTimeout(() => setFocusIndex((i) => (i === null ? i : (i + 1) % media.length)), AUTOPLAY_IMAGE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, focusIndex, current, media.length, failedVideos]);

  function Tile({ url, spanClass, onClick }: { url: string; spanClass: string; onClick: () => void }) {
    return (
      <button
        className={`group relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] ${spanClass}`}
        onClick={onClick}
        title="Ampliar"
      >
        {isUnsupported(url) ? (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-white/[0.04] text-center text-[11px] text-white/50">
            <span className="text-xl">⚠️</span>
            Sin vista previa
          </span>
        ) : isVideoUrl(url) ? (
          <>
            <video src={url} className="h-full w-full object-cover" muted onError={() => markVideoFailed(url)} />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-2xl text-white opacity-90 transition-opacity group-hover:opacity-100">
              ▶
            </span>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Momento del tejido" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        )}
      </button>
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-dark/98 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2 text-white">
          <span className="text-xl">{icon}</span>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-white/50">
              {media.length} {media.length === 1 ? itemLabelSingular : itemLabelPlural}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {current && (
            <button
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                autoplay ? "border-transparent bg-brand text-dark" : "border-white/20 bg-white/[0.06] text-white/70 hover:bg-white/[0.12]"
              }`}
              onClick={() => setAutoplay((v) => !v)}
            >
              {autoplay ? "⏸ Pausar" : "▶ Reproducir tejido"}
            </button>
          )}
          <button
            className="rounded-full border border-white/20 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/[0.12]"
            onClick={() => (current ? setFocusIndex(null) : onClose())}
          >
            {current ? "← Mosaico" : "✕ Cerrar"}
          </button>
        </div>
      </div>

      {current ? (
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
          <button
            className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
            onClick={() => setFocusIndex((i) => (i === null ? i : (i - 1 + media.length) % media.length))}
            aria-label="Anterior"
          >
            ‹
          </button>
          {isUnsupported(current) ? (
            <div className="flex flex-col items-center gap-3 rounded-lg bg-white/5 px-8 py-12 text-center text-white/70">
              <span className="text-3xl">⚠️</span>
              <p>Este archivo no se puede previsualizar en el navegador.</p>
              <a
                href={current}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold hover:bg-white/10"
              >
                Abrir original
              </a>
            </div>
          ) : isVideoUrl(current) ? (
            <video
              key={current}
              src={current}
              controls
              autoPlay
              className="max-h-full max-w-full rounded-lg shadow-2xl"
              onEnded={() => autoplay && setFocusIndex((i) => (i === null ? i : (i + 1) % media.length))}
              onError={() => markVideoFailed(current)}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={current} src={current} alt="Momento del tejido" className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
          )}
          <button
            className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
            onClick={() => setFocusIndex((i) => (i === null ? i : (i + 1) % media.length))}
            aria-label="Siguiente"
          >
            ›
          </button>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs text-white/70">
            {currentGroupLabel && <strong className="text-white/90">{currentGroupLabel}</strong>} {currentGroupLabel && "·"} {focusIndex! + 1} / {media.length}
          </span>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          {media.length === 0 ? (
            <p className="py-16 text-center text-sm text-white/40">Aún no se han subido fotos ni videos.</p>
          ) : groups ? (
            <div className="mx-auto max-w-5xl space-y-6">
              {(() => {
                let offset = 0;
                return groups
                  .filter((g) => g.media.length > 0)
                  .map((g) => {
                    const groupOffset = offset;
                    offset += g.media.length;
                    return (
                      <div key={g.label}>
                        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/50">
                          {g.label}
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60">{g.media.length}</span>
                        </h3>
                        <div className="grid auto-rows-[110px] grid-cols-4 gap-2 sm:auto-rows-[140px]">
                          {g.media.map((url, i) => (
                            <Tile key={url} url={url} spanClass={LOOM_SPANS[i % LOOM_SPANS.length]} onClick={() => setFocusIndex(groupOffset + i)} />
                          ))}
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>
          ) : (
            <div className="mx-auto grid max-w-5xl auto-rows-[110px] grid-cols-4 gap-2 sm:auto-rows-[140px]">
              {media.map((url, i) => (
                <Tile key={url} url={url} spanClass={LOOM_SPANS[i % LOOM_SPANS.length]} onClick={() => setFocusIndex(i)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
