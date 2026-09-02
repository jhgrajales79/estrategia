"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchActivityById, fetchSubmissionsByActivityIds } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import type { ActivityRow, Aspiration } from "@/lib/types";
import { ResultsBody } from "./ActivityResults";

interface SubmissionLike {
  aspiration_id: number | null;
  content: Record<string, unknown>;
  updated_at: string;
}

interface SourceData {
  activity: ActivityRow;
  submissions: SubmissionLike[];
}

const NOTE_TYPES = new Set(["notas", "notas_matriz"]);

export default function InsumosPanel({ sourceIds, aspirations }: { sourceIds: number[]; aspirations: Aspiration[] }) {
  const [sources, setSources] = useState<SourceData[]>([]);
  const [aspFilter, setAspFilter] = useState<number | null>(null);
  const key = sourceIds.join(",");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const acts = await Promise.all(sourceIds.map((id) => fetchActivityById(id)));
      const valid = acts.filter((a): a is ActivityRow => a !== null);
      const subs = await fetchSubmissionsByActivityIds(valid.map((a) => a.id));
      if (cancelled) return;
      setSources(valid.map((a) => ({ activity: a, submissions: subs.filter((s) => s.activity_id === a.id) })));
    }
    load().catch(console.error);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (sourceIds.length === 0) return;
    const channel = supabase
      .channel(`insumos-${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => {
        // No se puede filtrar de forma fiable por activity_id en el payload (en DELETE, payload.old
        // solo trae la clave primaria salvo REPLICA IDENTITY FULL), así que siempre se refresca.
        fetchSubmissionsByActivityIds(sourceIds)
          .then((subs) => {
            setSources((prev) => prev.map((s) => ({ ...s, submissions: subs.filter((sub) => sub.activity_id === s.activity.id) })));
          })
          .catch(console.error);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const canFilterByAspiration = aspirations.length > 0 && sources.some((s) => NOTE_TYPES.has(s.activity.activity_type));

  const filteredSources = useMemo(() => {
    if (aspFilter === null) return sources;
    return sources.map((s) => {
      if (!NOTE_TYPES.has(s.activity.activity_type)) return s;
      return {
        ...s,
        submissions: s.submissions.map((sub) => {
          const notes = sub.content.notes;
          if (!Array.isArray(notes)) return sub;
          return { ...sub, content: { ...sub.content, notes: notes.filter((n) => n?.aspiration_id === aspFilter) } };
        }),
      };
    });
  }, [sources, aspFilter]);

  if (sourceIds.length === 0 || sources.length === 0) return null;

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-brand/30 bg-brand/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-dark">📥 Insumos de actividades anteriores</h4>
        {canFilterByAspiration && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setAspFilter(null)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                aspFilter === null ? "border-transparent bg-brand-dark text-white" : "border-border bg-card text-muted hover:bg-black/5"
              }`}
            >
              Todas
            </button>
            {aspirations.map((a) => {
              const cls = aspClasses(a.number);
              const active = aspFilter === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAspFilter(a.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    active ? `border-transparent ${cls.bg} text-dark` : `${cls.border} ${cls.text} bg-card hover:bg-black/5`
                  }`}
                  title={ARCHETYPE_LABEL[a.number]}
                >
                  Asp. {a.number}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {filteredSources.map(({ activity, submissions }) => (
        <div key={activity.id} className="rounded-md border border-border bg-card p-3">
          <p className="mb-2 text-sm font-semibold text-foreground">{activity.title}</p>
          <ResultsBody activity={activity} submissions={submissions} aspirations={aspirations} />
        </div>
      ))}
    </div>
  );
}
