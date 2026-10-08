"use client";

import { useEffect, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchAspirations, fetchGoals } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { Aspiration, GoalRow } from "@/lib/types";
import { aspClasses } from "@/lib/aspirationStyle";
import AspirationBadge from "@/components/AspirationBadge";

// "Subasta de nuevas metas" (S3, activity_type votacion_fichas) — las nuevas metas ya no se
// registran a mano aquí: se leen en vivo las candidatas que ganaron fichas (puntos > 0), igual
// que el resto de la herramienta lee resultados ya ratificados de otra actividad (ver
// availableMetas en TarjetaEstructurada.tsx). perAspiration: true en esa actividad, así que hay
// una submission por aspiración, no una compartida.
const METAS_SUBASTA_ACTIVITY_ID = 18;

interface MetaCandidate {
  id: string;
  text: string;
  owner?: string;
  target_date?: string;
  aspiration_id?: number | null;
}
interface MetaVote {
  candidate_id: string;
  points: number;
}

export default function MetasPage() {
  const participant = useRequireParticipant();
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [candidates, setCandidates] = useState<MetaCandidate[]>([]);
  const [votes, setVotes] = useState<MetaVote[]>([]);

  function reload() {
    fetchGoals().then(setGoals).catch(console.error);
  }

  async function reloadSubasta() {
    const { data } = await supabase.from("submissions").select("content").eq("activity_id", METAS_SUBASTA_ACTIVITY_ID);
    const rows = (data as { content: { candidates?: MetaCandidate[]; votes?: MetaVote[] } }[] | null) ?? [];
    setCandidates(rows.flatMap((r) => r.content?.candidates ?? []));
    setVotes(rows.flatMap((r) => r.content?.votes ?? []));
  }

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
    reload();
    reloadSubasta();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("goals-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, reload)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${METAS_SUBASTA_ACTIVITY_ID}` },
        reloadSubasta
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!participant) return null;

  const pointsByCandidate: Record<string, number> = {};
  for (const v of votes) pointsByCandidate[v.candidate_id] = (pointsByCandidate[v.candidate_id] ?? 0) + v.points;
  const winningCandidates = candidates.filter((c) => (pointsByCandidate[c.id] ?? 0) > 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold text-dark">Metas por aspiración</h1>
      <p className="mb-6 text-sm text-muted">Metas vigentes y nuevas metas adoptadas en la S3 (Direccionamiento).</p>

      <div className="grid gap-4 sm:grid-cols-3">
        {aspirations.map((a) => {
          const cls = aspClasses(a.number);
          const vigentes = goals.filter((g) => g.aspiration_id === a.id && !g.is_new);
          const nuevas = winningCandidates.filter((c) => c.aspiration_id === a.id);
          return (
            <div key={a.id} className={`rounded-xl border-t-4 ${cls.border} bg-card p-4 shadow-sm`}>
              <AspirationBadge number={a.number} />
              <ul className="mt-3 space-y-2">
                {vigentes.map((g) => (
                  <li key={`vigente-${g.id}`} className="text-sm">
                    <p className="text-foreground">{g.description}</p>
                    {g.target_date && <p className="text-xs text-muted">{g.target_date}</p>}
                  </li>
                ))}
                {nuevas.map((c) => (
                  <li key={`nueva-${c.id}`} className="text-sm">
                    <p className="text-foreground">
                      <span className="mr-1 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-dark">NUEVA</span>
                      {c.text}
                    </p>
                    <p className="text-xs text-muted">
                      {c.owner ? `Doliente: ${c.owner}` : ""}
                      {c.target_date ? ` · ${c.target_date}` : ""}
                    </p>
                  </li>
                ))}
                {vigentes.length === 0 && nuevas.length === 0 && <p className="text-xs text-muted">Sin metas registradas.</p>}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
