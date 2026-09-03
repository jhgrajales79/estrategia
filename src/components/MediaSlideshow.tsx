"use client";

import { useEffect, useState } from "react";

interface Slide {
  url: string;
  caption?: string;
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
}

const IMAGE_DURATION_MS = 6000;

export default function MediaSlideshow({ slides, className = "" }: { slides: Slide[]; className?: string }) {
  const [index, setIndex] = useState(0);
  // Si la lista de medios cambia (se sube/borra algo) y el índice queda fuera de rango,
  // se lee la primera diapositiva en vez de forzar un setState extra dentro de un efecto.
  const safeIndex = index < slides.length ? index : 0;
  const current = slides[safeIndex] as Slide | undefined;

  useEffect(() => {
    if (!current || slides.length <= 1 || isVideoUrl(current.url)) return;
    // Las fotos avanzan solas por tiempo; los videos avanzan al terminar (onEnded) o si fallan (onError).
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), IMAGE_DURATION_MS);
    return () => clearTimeout(t);
  }, [current, slides.length]);

  if (!current) return null;

  function goTo(i: number) {
    setIndex(i);
  }
  function next() {
    setIndex((i) => (i + 1) % slides.length);
  }

  return (
    <div className={`relative overflow-hidden rounded-xl bg-dark ${className}`}>
      {isVideoUrl(current.url) ? (
        <video
          key={current.url}
          src={current.url}
          className="h-full w-full object-contain"
          autoPlay
          muted
          playsInline
          onEnded={next}
          onError={next}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={current.url} src={current.url} alt={current.caption ?? "Foto de la sesión"} className="h-full w-full object-contain" />
      )}
      {(current.caption || slides.length > 1) && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/75 to-transparent px-4 pb-3 pt-8">
          {current.caption && <p className="self-start text-sm font-medium text-white">{current.caption}</p>}
          {slides.length > 1 && (
            <div className="flex justify-center gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.url + i}
                  onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all ${i === safeIndex ? "w-5 bg-white" : "w-1.5 bg-white/40"}`}
                  aria-label={`Ir al elemento ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
