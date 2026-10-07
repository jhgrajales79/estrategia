"use client";

import { useEffect, useState } from "react";
import { useSubmission, fetchLatestContent } from "@/lib/useSubmission";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import { isPresenter } from "@/lib/presenter";
import { supabase } from "@/lib/supabase";
import { ieGroup } from "@/components/charts/IEMatrixGrid";
import { ActivityComponentProps, inputCls, btnPrimary, SaveIndicator, PresenterHint, DeleteButton, uid } from "./shared";

interface SourceRow {
  peso: number;
  calificacion: number;
  aspiration_id: number | null;
}
interface Note {
  id: string;
  text: string;
  author: string;
  author_id: string;
}
interface Content extends Record<string, unknown> {
  notes: Note[];
}

const GROUP_LABEL: Record<string, string> = {
  crecer: "Crecer y construir",
  mantener: "Mantener y sostener",
  cosechar: "Cosechar o desinvertir",
};

function total(rows: SourceRow[], aspirationId: number | null) {
  const filtered = rows.filter((r) => r.aspiration_id === aspirationId);
  const sum = filtered.reduce((a, r) => a + (Number(r.peso) || 0) * (Number(r.calificacion) || 0), 0);
  return sum;
}

// La Matriz IE ya no se llena a mano: la posición (Crecer/Mantener/Cosechar) se calcula
// automáticamente a partir de los totales ponderados de la Matriz EFI y la Matriz EFE de la
// misma aspiración (igual principio que el DOFA cruzado automático) — el equipo solo aporta
// notas de acción dentro del cuadrante que le resultó.
export default function MatrizIE({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const [efiId, efeId] = (activity.config.inputsFrom as number[]) ?? [];
  const presenter = isPresenter(participant);
  const [activeAspId, setActiveAspId] = useState<number | null>(() => aspirations[0]?.id ?? null);
  useEffect(() => {
    if (activeAspId === null && aspirations.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveAspId(aspirations[0].id);
    }
  }, [aspirations, activeAspId]);

  const [efiRows, setEfiRows] = useState<SourceRow[]>([]);
  const [efeRows, setEfeRows] = useState<SourceRow[]>([]);

  useEffect(() => {
    async function load() {
      const [efi, efe] = await Promise.all([
        supabase.from("submissions").select("content").eq("activity_id", efiId),
        supabase.from("submissions").select("content").eq("activity_id", efeId),
      ]);
      const efiAll = (efi.data ?? []).flatMap((s) => ((s.content as { rows?: SourceRow[] } | null)?.rows ?? []));
      const efeAll = (efe.data ?? []).flatMap((s) => ((s.content as { rows?: SourceRow[] } | null)?.rows ?? []));
      setEfiRows(efiAll);
      setEfeRows(efeAll);
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`matriz-ie-fuentes-${activity.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${efiId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${efeId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [efiId, efeId, activity.id]);

  const emptyContent: Content = { notes: [] };
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    activeAspId,
    participant,
    emptyContent
  );
  const [draft, setDraft] = useState("");

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  async function mutateContent(fn: (latest: Content) => Content) {
    const latest = await fetchLatestContent<Content>(activity.id, activeAspId, emptyContent);
    await save(fn(latest));
  }
  function addNote() {
    const text = draft.trim();
    if (!text) return;
    mutateContent((latest) => ({ notes: [...latest.notes, { id: uid(), text, author: participant.name, author_id: participant.id }] }));
    setDraft("");
  }
  function removeNote(id: string) {
    mutateContent((latest) => ({ notes: latest.notes.filter((n) => n.id !== id) }));
  }

  const efiTotal = total(efiRows, activeAspId);
  const efeTotal = total(efeRows, activeAspId);
  const hasData = efiTotal > 0 && efeTotal > 0;
  const group = hasData ? ieGroup(efiTotal, efeTotal) : null;
  const canEdit = !presenter;

  return (
    <div className="space-y-4">
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PresenterHint />
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5"
            title="Ver el mapa de las 3 aspiraciones en una pestaña nueva"
            onClick={() => window.open(`/matrizie/${activity.id}`, "_blank", "noopener,noreferrer")}
          >
            ⛶ Ver tablero
          </button>
        </div>
      )}

      {aspirations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {aspirations.map((a) => {
            const cls = aspClasses(a.number);
            const active = activeAspId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setActiveAspId(a.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active ? `border-transparent ${cls.bg} text-dark` : `${cls.border} ${cls.text} bg-card hover:bg-black/5`
                }`}
              >
                Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        {!hasData ? (
          <p className="text-sm text-muted">
            Aún no hay totales de la Matriz EFI/EFE para esta aspiración — complétalas primero para calcular la posición.
          </p>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Posición calculada</p>
            <p className="mt-1 text-lg font-bold text-foreground">{GROUP_LABEL[group!]}</p>
            <p className="mt-1 text-xs text-muted">
              EFI: <span className="font-semibold text-foreground">{efiTotal.toFixed(2)}</span> · EFE:{" "}
              <span className="font-semibold text-foreground">{efeTotal.toFixed(2)}</span>
            </p>
          </>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Notas / acciones estratégicas para este cuadrante</p>
        {content.notes.length === 0 && <p className="text-sm text-muted">Aún no hay notas registradas.</p>}
        {content.notes.map((n) => {
          const canDelete = n.author_id === participant.id;
          return (
            <div key={n.id} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-3">
              <div>
                <p className="text-sm text-foreground">{n.text}</p>
                <p className="mt-1 text-xs text-muted">{n.author}</p>
              </div>
              {canDelete && <DeleteButton label="quitar" onConfirm={() => removeNote(n.id)} />}
            </div>
          );
        })}
        {canEdit && (
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="Agregar nota o acción…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNote()}
            />
            <button className={btnPrimary} onClick={addNote}>
              + Agregar
            </button>
          </div>
        )}
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} sticky />
    </div>
  );
}
