"use client";

import { useEffect, useState } from "react";
import { fetchActivityById, fetchSubmissionsByActivityIds } from "@/lib/data";
import { supabase } from "@/lib/supabase";
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

export default function InsumosPanel({ sourceIds, aspirations }: { sourceIds: number[]; aspirations: Aspiration[] }) {
  const [sources, setSources] = useState<SourceData[]>([]);
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

  if (sourceIds.length === 0 || sources.length === 0) return null;

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-brand/30 bg-brand/5 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-dark">📥 Insumos de actividades anteriores</h4>
      {sources.map(({ activity, submissions }) => (
        <div key={activity.id} className="rounded-md border border-border bg-card p-3">
          <p className="mb-2 text-sm font-semibold text-foreground">{activity.title}</p>
          <ResultsBody activity={activity} submissions={submissions} aspirations={aspirations} />
        </div>
      ))}
    </div>
  );
}
