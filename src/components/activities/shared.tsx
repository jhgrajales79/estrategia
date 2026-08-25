"use client";

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
