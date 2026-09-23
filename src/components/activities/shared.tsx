"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";
import type { StoredParticipant } from "@/lib/participant";

export interface ActivityComponentProps {
  activity: ActivityRow;
  session: SessionRow;
  aspirationId: number | null;
  aspirations: Aspiration[];
  participant: StoredParticipant;
}

export const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/40";

export const textareaCls = inputCls + " resize-y min-h-16";

export const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-dark hover:bg-brand-hover transition-colors disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 transition-colors";

export const btnDanger =
  "text-xs text-red-600 hover:text-red-800 hover:underline";

export function SaveIndicator({
  saving,
  updatedAt,
  error,
  sticky = false,
}: {
  saving: boolean;
  updatedAt: string | null;
  error?: string | null;
  /** Flota sobre el contenido en vez de quedar al final de la página — visible sin
   * necesidad de scroll en celular, importante cuando falla el guardado por wifi débil. */
  sticky?: boolean;
}) {
  let inner: ReactNode;
  if (saving) inner = <span className="text-xs text-muted">Guardando…</span>;
  else if (error)
    inner = (
      <span className="text-xs font-medium text-red-600" title={error}>
        ⚠ No se pudo guardar
      </span>
    );
  else if (updatedAt)
    inner = (
      <span className="text-xs text-muted">
        Guardado {new Date(updatedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  else inner = <span className="text-xs text-muted">Sin guardar</span>;

  if (!sticky) return inner;
  return (
    <div
      className={`sticky bottom-2 z-10 inline-flex items-center rounded-full border px-3 py-1.5 shadow-sm backdrop-blur ${
        error ? "border-red-200 bg-red-50/95" : "border-border bg-card/95"
      }`}
    >
      {inner}
    </div>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  bgClass,
  isFacilitador,
  size = "md",
}: {
  name: string;
  bgClass: string;
  isFacilitador?: boolean;
  size?: "sm" | "md";
}) {
  const dims = size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-xs";
  return (
    <span className={`relative inline-flex ${dims} shrink-0 items-center justify-center rounded-full font-bold text-white ${bgClass}`}>
      {initials(name)}
      {isFacilitador && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand text-[8px] leading-none" title="Facilitador">
          🎤
        </span>
      )}
    </span>
  );
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Etiqueta de oportunidad/amenaza para actividades tipo "notas" (p. ej. Mundo café) que activan
// `config.polarityTags` — compartida entre el tablero en vivo (NotasColectivas) y las vistas de
// solo lectura (NotesBoardView / fullscreen) para que ambas la pinten igual.
export const POLARITY_META = {
  // `badgeCls` (tono pastel) es para la etiqueta sobre una nota ya guardada, donde solo debe
  // identificar sin competir visualmente. `selectedCls` (color sólido) es para el botón del
  // selector cuando está elegido — necesita un verde bien distinto del fondo verde clarito que
  // ya usan la mesa activa y el propio badge, si no, "elegido" y "no elegido" se confunden.
  oportunidad: { label: "Oportunidad", icon: "🟢", badgeCls: "bg-emerald-100 text-emerald-700", selectedCls: "bg-emerald-600 text-white" },
  amenaza: { label: "Amenaza", icon: "🔴", badgeCls: "bg-red-100 text-red-700", selectedCls: "bg-red-600 text-white" },
} as const;
export type NotePolarity = keyof typeof POLARITY_META;

const ROTATIONS = [-2.5, 1.5, -1, 2, -1.8, 1, -2, 2.2];

// Paletas automáticas: nunca se elige el color a mano.
export const NEUTRAL_PALETTE = ["bg-postit-yellow", "bg-postit-pink", "bg-postit-blue", "bg-postit-green", "bg-postit-orange"];
export const ROUND_PALETTE = ["bg-postit-yellow", "bg-postit-blue", "bg-postit-pink", "bg-postit-green", "bg-postit-orange"];
// Variantes translúcidas (mismo orden) para superficies que no deben congestionar la vista, como el radar.
export const ROUND_PALETTE_SOFT = ["bg-postit-yellow/50", "bg-postit-blue/50", "bg-postit-pink/50", "bg-postit-green/50", "bg-postit-orange/50"];

export function autoBg(index: number, palette: string[] = NEUTRAL_PALETTE) {
  return palette[index % palette.length];
}

export function PostIt({
  bgClass,
  index = 0,
  highlighted = false,
  className = "",
  children,
}: {
  bgClass?: string;
  index?: number;
  highlighted?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const rotate = highlighted ? 0 : ROTATIONS[index % ROTATIONS.length];
  return (
    <div
      className={`relative rounded-sm p-3 text-sm shadow-md ${bgClass ?? autoBg(index)} ${
        highlighted ? "ring-2 ring-brand shadow-lg scale-105" : ""
      } ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <span className="absolute -top-1.5 left-1/2 h-3 w-8 -translate-x-1/2 rounded-sm bg-black/10" />
      {highlighted && <span className="absolute -right-1.5 -top-1.5 text-sm">📌</span>}
      {children}
    </div>
  );
}

export interface NewsStory {
  id: string;
  headline: string;
  author: string;
  tag?: ReactNode;
  // Reutiliza el "destacar" (📌) que ya existe en otras actividades de notas, pero aquí cambia
  // de significado: en vez de solo resaltar, una nota destacada se vuelve la NOTA PRINCIPAL de
  // la edición — portada a ancho completo, como en un periódico real — y el resto fluye como
  // notas de columna más pequeñas debajo.
  highlighted?: boolean;
  actions?: ReactNode;
}

// Página de periódico para actividades de visualización guiada (p. ej. "Socya en 2029"), donde
// el aporte de cada persona ES literalmente una noticia — mostrarlas como post-its sueltos, o
// incluso como recortes individuales, no transmite lo que sí logra verlas todas juntas
// componiendo una sola edición: masthead, portada y columnas de notas, como un periódico real.
export function NewsPage({
  title,
  notes,
  large = false,
}: {
  title: string;
  notes: NewsStory[];
  large?: boolean;
}) {
  const lead = notes.filter((n) => n.highlighted);
  const rest = notes.filter((n) => !n.highlighted);

  return (
    <div className={`rounded-sm border border-[#d8cfb4] bg-[#faf6ea] shadow-sm ${large ? "p-8" : "p-5"}`}>
      <div className="text-center">
        <p className={`font-serif font-black uppercase tracking-[0.06em] text-[#2b2620] ${large ? "text-4xl" : "text-2xl"}`}>{title}</p>
        <div className="mx-auto mt-2 h-[3px] w-full bg-[#2b2620]" />
        <div className="mx-auto mt-[3px] h-px w-full bg-[#2b2620]" />
        <p className="mt-1.5 font-serif text-[11px] uppercase tracking-[0.2em] text-[#8a6d3b]">
          Edición especial · {notes.length} {notes.length === 1 ? "noticia" : "noticias"}
        </p>
      </div>

      {notes.length === 0 && (
        <p className="mt-6 text-center font-serif text-sm italic text-[#8a7f66]">
          Aún no hay noticias — la primera que se guarde abre esta edición.
        </p>
      )}

      {lead.length > 0 && (
        <div className="mt-5 space-y-4 border-b-2 border-[#2b2620] pb-4">
          {lead.map((n) => (
            <article key={n.id}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 font-serif text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a6d3b]">
                  📌 Portada {n.tag}
                </span>
                {n.actions}
              </div>
              <h3 className={`font-serif font-bold leading-tight text-[#2b2620] ${large ? "text-3xl" : "text-xl"}`}>{n.headline}</h3>
              <p className="mt-1 font-serif text-sm italic text-[#6b6151]">Por {n.author}</p>
            </article>
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div
          className={`mt-5 ${large ? "columns-3 gap-8" : "columns-2 gap-6"}`}
          style={{ columnRule: "1px solid #d8cfb4" }}
        >
          {rest.map((n) => (
            <article key={n.id} className="mb-4 break-inside-avoid border-b border-[#e3dcc7] pb-3">
              <div className="mb-1 flex items-center justify-between gap-1">
                {n.tag}
                {n.actions}
              </div>
              <h4 className={`font-serif font-bold leading-snug text-[#2b2620] ${large ? "text-lg" : "text-sm"}`}>{n.headline}</h4>
              <p className="mt-1 font-serif text-xs italic text-[#6b6151]">Por {n.author}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function PresenterHint({ text = "Modo presentador: solo puedes visualizar, resaltar y controlar la actividad." }: { text?: string }) {
  return <p className="rounded-md bg-brand/10 px-3 py-2 text-xs text-brand-dark">🎤 {text}</p>;
}

export function PinToggle({ pinned, onClick, title = "Destacar" }: { pinned: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`text-xs ${pinned ? "opacity-100" : "opacity-40 hover:opacity-80"}`}
    >
      📌
    </button>
  );
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 select-none" onClick={(e) => e.stopPropagation()}>
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-1 ${
          checked ? "bg-brand" : "bg-black/20"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

export function DeleteButton({
  onConfirm,
  label = "eliminar",
}: {
  onConfirm: () => void;
  label?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          className="min-h-9 rounded-md px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
          onClick={onConfirm}
        >
          Sí, borrar
        </button>
        <button
          type="button"
          className="min-h-9 rounded-md px-2.5 py-1.5 text-xs text-muted hover:bg-black/5"
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      className="min-h-9 rounded-md px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-800 transition-colors"
      onClick={() => setConfirming(true)}
    >
      {label}
    </button>
  );
}

export function Stepper({
  value,
  min = 0,
  max,
  onChange,
  ariaLabel,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  ariaLabel?: string;
}) {
  const canDec = value > min;
  const canInc = max === undefined || value < max;
  const btnCls =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border text-lg font-semibold text-foreground hover:bg-black/5 transition-colors disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        disabled={!canDec}
        onClick={() => onChange(value - 1)}
        className={btnCls}
        aria-label={ariaLabel ? `Restar de ${ariaLabel}` : "Restar"}
      >
        −
      </button>
      <span className="w-6 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        disabled={!canInc}
        onClick={() => onChange(value + 1)}
        className={btnCls}
        aria-label={ariaLabel ? `Sumar a ${ariaLabel}` : "Sumar"}
      >
        +
      </button>
    </span>
  );
}

export function LockBadge({ text = "Bloqueada" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-muted">
      🔒 {text}
    </span>
  );
}
