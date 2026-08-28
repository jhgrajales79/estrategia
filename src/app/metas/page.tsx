"use client";

import { useEffect, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchAspirations, fetchGoals } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/feed";
import type { Aspiration, GoalRow, Participant } from "@/lib/types";
import { aspClasses } from "@/lib/aspirationStyle";
import { inputCls, btnPrimary } from "@/components/activities/shared";

export default function MetasPage() {
  const participant = useRequireParticipant();
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [form, setForm] = useState<{ aspiration_id: string; description: string; target_date: string }>({
    aspiration_id: "",
    description: "",
    target_date: "",
  });

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

  async function addGoal() {
    if (!form.aspiration_id || !form.description.trim()) return;
    await supabase.from("goals").insert({
      aspiration_id: Number(form.aspiration_id),
      description: form.description.trim(),
      is_new: true,
      owner_participant_id: participant!.id,
      target_date: form.target_date || null,
    });
    await logActivity({
      aspiration_id: Number(form.aspiration_id),
      participant_id: participant!.id,
      event_type: "meta",
      summary: `${participant!.name} registró una nueva meta`,
    });
    setForm({ aspiration_id: "", description: "", target_date: "" });
    reload();
  }

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
              <p className={`text-xs font-bold uppercase ${cls.text}`}>Aspiración {a.number}</p>
              <ul className="mt-2 space-y-2">
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

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Registrar nueva meta</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <select className={inputCls} value={form.aspiration_id} onChange={(e) => setForm((f) => ({ ...f, aspiration_id: e.target.value }))}>
            <option value="">Aspiración…</option>
            {aspirations.map((a) => (
              <option key={a.id} value={a.id}>
                Asp. {a.number}
              </option>
            ))}
          </select>
          <input
            className={inputCls + " sm:col-span-2"}
            placeholder="Descripción de la meta"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <input type="date" className={inputCls} value={form.target_date} onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))} />
        </div>
        <button className={btnPrimary + " mt-3"} onClick={addGoal}>
          Agregar meta
        </button>
      </div>
    </div>
  );
}
