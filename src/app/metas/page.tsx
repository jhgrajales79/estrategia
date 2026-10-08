"use client";

import { useEffect, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchAspirations, fetchGoals } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { Aspiration, GoalRow, Participant } from "@/lib/types";
import { aspClasses } from "@/lib/aspirationStyle";
import AspirationBadge from "@/components/AspirationBadge";

export default function MetasPage() {
  const participant = useRequireParticipant();
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [owners, setOwners] = useState<Record<string, string>>({});

  function reload() {
    fetchGoals().then(setGoals).catch(console.error);
  }

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
    reload();
    supabase
      .from("participants")
      .select("id,name")
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data as Pick<Participant, "id" | "name">[] | null)?.forEach((p) => (map[p.id] = p.name));
        setOwners(map);
      });
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("goals-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!participant) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold text-dark">Metas por aspiración</h1>
      <p className="mb-6 text-sm text-muted">Metas vigentes y nuevas metas adoptadas en la S3 (Direccionamiento).</p>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {aspirations.map((a) => {
          const cls = aspClasses(a.number);
          const goalsFor = goals.filter((g) => g.aspiration_id === a.id);
          return (
            <div key={a.id} className={`rounded-xl border-t-4 ${cls.border} bg-card p-4 shadow-sm`}>
              <AspirationBadge number={a.number} />
              <ul className="mt-3 space-y-2">
                {goalsFor.map((g) => (
                  <li key={g.id} className="text-sm">
                    <p className="text-foreground">
                      {g.is_new && <span className="mr-1 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-dark">NUEVA</span>}
                      {g.description}
                    </p>
                    <p className="text-xs text-muted">
                      {g.owner_participant_id ? `Doliente: ${owners[g.owner_participant_id] ?? "—"}` : ""}
                      {g.target_date ? ` · ${g.target_date}` : ""}
                    </p>
                  </li>
                ))}
                {goalsFor.length === 0 && <p className="text-xs text-muted">Sin metas registradas.</p>}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
