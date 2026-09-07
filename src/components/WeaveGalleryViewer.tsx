"use client";

import { useEffect, useState } from "react";

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
}

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

export default function WeaveGalleryViewer({ media, open, onClose }: { media: string[]; open: boolean; onClose: () => void }) {
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [autoplay, setAutoplay] = useState(false);

  // Se resetea al abrir/cerrar para no reabrir directo en el lightbox de la vez anterior.
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFocusIndex(null);
      setAutoplay(false);
    }
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

  // Reproducir el tejido completo: las fotos avanzan solas por tiempo, los videos al terminar.
  useEffect(() => {
    if (!autoplay || focusIndex === null || !current) return;
    if (isVideoUrl(current)) return;
    const t = setTimeout(() => setFocusIndex((i) => (i === null ? i : (i + 1) % media.length)), AUTOPLAY_IMAGE_MS);
    return () => clearTimeout(t);
  }, [autoplay, focusIndex, current, media.length]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-dark/98 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2 text-white">
          <span className="text-xl">🧶</span>
          <div>
            <p className="text-sm font-semibold">Mural del tejido</p>
            <p className="text-xs text-white/50">
              {media.length} {media.length === 1 ? "momento" : "momentos"} capturados
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
          {isVideoUrl(current) ? (
            <video
              key={current}
              src={current}
              controls
              autoPlay
              className="max-h-full max-w-full rounded-lg shadow-2xl"
              onEnded={() => autoplay && setFocusIndex((i) => (i === null ? i : (i + 1) % media.length))}
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
            {focusIndex! + 1} / {media.length}
          </span>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          {media.length === 0 ? (
            <p className="py-16 text-center text-sm text-white/40">Aún no se han subido fotos ni videos.</p>
          ) : (
            <div className="mx-auto grid max-w-5xl auto-rows-[110px] grid-cols-4 gap-2 sm:auto-rows-[140px]">
              {media.map((url, i) => (
                <button
                  key={url}
                  className={`group relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] ${LOOM_SPANS[i % LOOM_SPANS.length]}`}
                  onClick={() => setFocusIndex(i)}
                  title="Ampliar"
                >
                  {isVideoUrl(url) ? (
                    <>
                      <video src={url} className="h-full w-full object-cover" muted />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-2xl text-white opacity-90 transition-opacity group-hover:opacity-100">
                        ▶
                      </span>
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="Momento del tejido" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
