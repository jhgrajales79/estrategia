"use client";

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
  "inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark transition-colors disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 transition-colors";

export const btnDanger =
  "text-xs text-red-600 hover:text-red-800 hover:underline";

export function SaveIndicator({ saving, updatedAt }: { saving: boolean; updatedAt: string | null }) {
  if (saving) return <span className="text-xs text-muted">Guardando…</span>;
  if (updatedAt)
    return (
      <span className="text-xs text-muted">
        Guardado {new Date(updatedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  return <span className="text-xs text-muted">Sin guardar</span>;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const ROTATIONS = [-2.5, 1.5, -1, 2, -1.8, 1, -2, 2.2];

export function PostIt({
  bgClass,
  index = 0,
  className = "",
  children,
}: {
  bgClass?: string;
  index?: number;
  className?: string;
  children: ReactNode;
}) {
  const rotate = ROTATIONS[index % ROTATIONS.length];
  return (
    <div
      className={`relative rounded-sm p-3 text-sm shadow-md ${bgClass ?? "bg-postit-yellow"} ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <span className="absolute -top-1.5 left-1/2 h-3 w-8 -translate-x-1/2 rounded-sm bg-black/10" />
      {children}
    </div>
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
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-brand" : "bg-black/20"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export function LockBadge({ text = "Bloqueada" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-muted">
      🔒 {text}
    </span>
  );
}
