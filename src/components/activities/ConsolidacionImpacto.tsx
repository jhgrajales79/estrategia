"use client";

import { useEffect, useState, type DragEvent } from "react";
import { useSubmission, effectiveAspirationId, fetchLatestContent } from "@/lib/useSubmission";
import { aspAbbrev, aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import { isPresenter } from "@/lib/presenter";
import { supabase } from "@/lib/supabase";
import { ActivityComponentProps, SaveIndicator, PresenterHint, inputCls, btnGhost, uid, POLARITY_META, NotePolarity } from "./shared";

// Nota cruda tal como la deja Mundo café (config.polarityTags + selectableAspiration): son las
// tarjetas que arrastramos desde la bandeja "Por clasificar" hacia una columna de impacto.
interface SourceNote {
  id: string;
  text: string;
  author: string;
  polarity?: NotePolarity;
  aspiration_id: number | null;
}

// Misma forma que produce el flujo manual de NotasColectivas (impactLevels) — así el import
// hacia la Matriz EFE (MatrizPonderada.importFromPci) sigue funcionando sin cambios: solo le
// importa encontrar `impact`, `category`/`polarity` y `aspiration_id` en las notas del POAM.
interface ImpactNote {
  id: string;
  category: string;
  aspiration_id: number | null;
  author: string;
  text: string;
  impact: "alto" | "medio" | "bajo";
  polarity?: NotePolarity;
  // Vínculo con la nota de origen en Mundo café — permite reclasificar (arrastrar entre
  // columnas) en vez de duplicar, y devolverla a la bandeja si se quita.
  sourceNoteId?: string;
}

interface Content extends Record<string, unknown> {
  notes: ImpactNote[];
}

const PLURAL_LABEL: Record<NotePolarity, string> = { oportunidad: "Oportunidades", amenaza: "Amenazas" };

const IMPACT_COLUMNS: { key: ImpactNote["impact"]; label: string; badgeCls: string }[] = [
  { key: "alto", label: "🔴 Impacto alto", badgeCls: "border-red-200 bg-red-50/60" },
  { key: "medio", label: "🟡 Impacto medio", badgeCls: "border-amber-200 bg-amber-50/60" },
  { key: "bajo", label: "⚪ Impacto bajo", badgeCls: "border-slate-200 bg-slate-50/60" },
];

type DragItem = { from: "pool" | "board"; id: string };

export default function ConsolidacionImpacto({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const consolidationFrom = activity.config.consolidationFrom as number | undefined;
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { notes: [] }
  );
  const [activeTab, setActiveTab] = useState<NotePolarity>("oportunidad");
  // Los 3 grupos (uno por aspiración) trabajan en paralelo sobre la misma submission
  // compartida — cada nota ya trae su `aspiration_id` desde Mundo café, así que separar por
  // aspiración aquí es solo un filtro de vista, sin necesidad de submissions independientes.
  const [activeAspId, setActiveAspId] = useState<number | "all">(() => aspirations[0]?.id ?? "all");
  const [sourceNotes, setSourceNotes] = useState<SourceNote[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [selected, setSelected] = useState<DragItem | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [manualDraft, setManualDraft] = useState<Record<string, string>>({});

  async function fetchSource() {
    if (!consolidationFrom) return;
    setSourceLoading(true);
    const { data } = await supabase
      .from("submissions")
      .select("content")
      .eq("activity_id", consolidationFrom)
      .is("aspiration_id", null)
      .maybeSingle();
    setSourceNotes(((data?.content as { notes?: SourceNote[] } | null)?.notes) ?? []);
    setSourceLoading(false);
  }

  useEffect(() => {
    fetchSource();
    if (!consolidationFrom) return;
    // El Mundo café puede seguir recibiendo notas mientras el grupo ya empezó a clasificar en el
    // POAM (facilitación en vivo) — nos suscribimos para que la bandeja se actualice sola.
    const channel = supabase
      .channel(`consolidacion-source-${consolidationFrom}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${consolidationFrom}` },
        () => fetchSource()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consolidationFrom]);

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  async function mutateNotes(fn: (notes: ImpactNote[]) => ImpactNote[]) {
    const latest = await fetchLatestContent<Content>(activity.id, submissionAspId, { notes: [] });
    save({ notes: fn(latest.notes) });
  }

  function moveToColumn(item: DragItem, column: ImpactNote["impact"]) {
    mutateNotes((notes) => {
      if (item.from === "pool") {
        const src = sourceNotes.find((n) => n.id === item.id);
        if (!src) return notes;
        const already = notes.find((n) => n.sourceNoteId === src.id);
        if (already) return notes.map((n) => (n.id === already.id ? { ...n, impact: column } : n));
        const note: ImpactNote = {
          id: uid(),
          category: activeTab,
          aspiration_id: src.aspiration_id,
          author: src.author,
          text: src.text,
          impact: column,
          polarity: src.polarity ?? activeTab,
          sourceNoteId: src.id,
        };
        return [...notes, note];
      }
      return notes.map((n) => (n.id === item.id ? { ...n, impact: column } : n));
    });
    setSelected(null);
  }

  function unclassify(noteId: string) {
    mutateNotes((notes) => notes.filter((n) => n.id !== noteId));
    setSelected(null);
  }

  function addManual(column: ImpactNote["impact"]) {
    const key = `${activeTab}-${column}`;
    const text = (manualDraft[key] ?? "").trim();
    if (!text) return;
    mutateNotes((notes) => [
      ...notes,
      {
        id: uid(),
        category: activeTab,
        aspiration_id: activeAspId === "all" ? null : activeAspId,
        author: participant.name,
        text,
        impact: column,
        polarity: activeTab,
      },
    ]);
    setManualDraft((d) => ({ ...d, [key]: "" }));
  }

  const matchesAsp = (id: number | null) => activeAspId === "all" || id === activeAspId;
  const classified = content.notes.filter((n) => (n.polarity ?? n.category) === activeTab && matchesAsp(n.aspiration_id));
  const classifiedSourceIds = new Set(classified.map((n) => n.sourceNoteId).filter(Boolean));
  const pool = sourceNotes.filter(
    (n) => (n.polarity ?? "oportunidad") === activeTab && matchesAsp(n.aspiration_id) && !classifiedSourceIds.has(n.id)
  );

  function dragProps(item: DragItem) {
    return {
      draggable: true,
      onDragStart: (e: DragEvent) => {
        e.dataTransfer.setData("text/plain", JSON.stringify(item));
        e.dataTransfer.effectAllowed = "move";
      },
      onClick: () => setSelected((prev) => (prev && prev.id === item.id && prev.from === item.from ? null : item)),
    };
  }

  function dropZoneProps(key: string, onDrop: (item: DragItem) => void) {
    return {
      onDragOver: (e: DragEvent) => {
        e.preventDefault();
        setDragOverKey(key);
      },
      onDragLeave: () => setDragOverKey((k) => (k === key ? null : k)),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        setDragOverKey(null);
        const raw = e.dataTransfer.getData("text/plain");
        if (!raw) return;
        try {
          onDrop(JSON.parse(raw) as DragItem);
        } catch {
          /* payload no reconocido, se ignora */
        }
      },
      onClick: () => {
        if (selected) onDrop(selected);
      },
    };
  }

  function Card({ item, note, sourceNote }: { item: DragItem; note?: ImpactNote; sourceNote?: SourceNote }) {
    const text = note?.text ?? sourceNote?.text ?? "";
    const author = note?.author ?? sourceNote?.author ?? "";
    const aspId = note?.aspiration_id ?? sourceNote?.aspiration_id ?? null;
    const abbrev = aspAbbrev(aspirations, aspId);
    const isSelected = selected?.id === item.id && selected?.from === item.from;
    return (
      <div
        {...dragProps(item)}
        className={`w-44 shrink-0 cursor-grab select-none rounded-md border bg-card p-2 text-xs shadow-sm transition-shadow active:cursor-grabbing ${
          isSelected ? "ring-2 ring-brand" : "border-border"
        }`}
        title="Arrastra a una columna, o haz clic y luego clic en la columna destino"
      >
        <p className="break-words text-foreground">{text}</p>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted">
          <span>{abbrev ? `${abbrev} · ${author}` : author}</span>
          {item.from === "board" && (
            <button
              type="button"
              className="text-red-500 hover:text-red-700"
              title="Devolver a la bandeja"
              onClick={(e) => {
                e.stopPropagation();
                unclassify(item.id);
              }}
            >
              ↩
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
          <PresenterHint text="Modo presentador: puedes clasificar igual que el resto del grupo, y proyectar el avance en una pantalla aparte." />
          <button
            className={btnGhost}
            title="Ampliar tablero en una pestaña nueva"
            onClick={() => window.open(`/notas/${activity.id}`, "_blank", "noopener,noreferrer")}
          >
            ⛶ Ampliar
          </button>
        </div>
      )}
      {aspirations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveAspId("all");
              setSelected(null);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeAspId === "all" ? "border-transparent bg-foreground text-card" : "border-border text-muted hover:bg-black/5"
            }`}
          >
            📊 Todas
          </button>
          {aspirations.map((a) => {
            const cls = aspClasses(a.number);
            const active = activeAspId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setActiveAspId(a.id);
                  setSelected(null);
                }}
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(Object.keys(POLARITY_META) as NotePolarity[]).map((key) => {
            const meta = POLARITY_META[key];
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveTab(key);
                  setSelected(null);
                }}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  active ? meta.selectedCls + " border-transparent" : "border-border text-muted hover:bg-black/5"
                }`}
              >
                {meta.icon} {PLURAL_LABEL[key]}
              </button>
            );
          })}
        </div>
        <button className={btnGhost} onClick={fetchSource} disabled={sourceLoading}>
          {sourceLoading ? "Actualizando…" : "🔄 Actualizar bandeja"}
        </button>
      </div>

      <div
        {...dropZoneProps("pool", (item) => {
          if (item.from === "board") unclassify(item.id);
        })}
        className={`rounded-lg border-2 border-dashed p-3 transition-colors ${
          dragOverKey === "pool" ? "border-brand bg-brand/5" : "border-border"
        }`}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Por clasificar · {PLURAL_LABEL[activeTab].toLowerCase()} de Mundo café ({pool.length})
        </p>
        {pool.length === 0 ? (
          <p className="text-xs text-muted">
            {selected?.from === "board" ? "Suelta aquí para devolver a la bandeja." : "No hay pendientes por clasificar."}
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pool.map((n) => (
              <Card key={n.id} item={{ from: "pool", id: n.id }} sourceNote={n} />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {IMPACT_COLUMNS.map((col) => {
          const notesInCol = classified.filter((n) => n.impact === col.key);
          const key = `col-${col.key}`;
          return (
            <div
              key={col.key}
              {...dropZoneProps(key, (item) => moveToColumn(item, col.key))}
              className={`min-h-40 rounded-lg border p-3 transition-colors ${col.badgeCls} ${
                dragOverKey === key ? "ring-2 ring-brand" : ""
              }`}
            >
              <p className="mb-2 text-xs font-semibold text-foreground">
                {col.label} ({notesInCol.length})
              </p>
              <div className="mb-2 flex flex-col gap-2">
                {notesInCol.length === 0 && <p className="text-xs text-muted">Suelta aquí las tarjetas de este nivel.</p>}
                {notesInCol.map((n) => (
                  <Card key={n.id} item={{ from: "board", id: n.id }} note={n} />
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  className={inputCls + " text-xs"}
                  placeholder={`+ agregar ${activeTab}…`}
                  value={manualDraft[`${activeTab}-${col.key}`] ?? ""}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setManualDraft((d) => ({ ...d, [`${activeTab}-${col.key}`]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addManual(col.key);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
