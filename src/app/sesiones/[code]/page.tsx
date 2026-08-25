"use client";

import { use, useEffect, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchActivities, fetchAspirations, fetchOutputs, fetchSessionByCode } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/feed";
import type { ActivityRow, Aspiration, OutputRow, SessionRow } from "@/lib/types";
import ActivityCard from "@/components/ActivityCard";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";

const STATUS_OPTIONS: SessionRow["status"][] = ["pendiente", "en_curso", "completada"];

export default function SessionDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const participant = useRequireParticipant();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [outputs, setOutputs] = useState<OutputRow[]>([]);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
  }, []);

  useEffect(() => {
    fetchSessionByCode(code.toUpperCase()).then((s) => {
      setSession(s);
      if (s) {
        fetchActivities(s.id).then(setActivities).catch(console.error);
        fetchOutputs(s.id).then(setOutputs).catch(console.error);
      }
    });
  }, [code]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`outputs-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "outputs", filter: `session_id=eq.${session.id}` }, () => {
        fetchOutputs(session.id).then(setOutputs).catch(console.error);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  if (!participant || !session) return <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-muted">Cargando…</div>;

  async function toggleOutput(o: OutputRow) {
    const isDone = !o.is_done;
    await supabase.from("outputs").update({ is_done: isDone }).eq("id", o.id);
    await logActivity({
      session_id: session!.id,
      aspiration_id: o.aspiration_id ?? participant!.aspiration_id,
      participant_id: participant!.id,
      event_type: "salida",
      summary: `${participant!.name} marcó "${o.description.slice(0, 60)}" como ${isDone ? "lograda" : "pendiente"}`,
    });
  }

  async function setStatus(status: SessionRow["status"]) {
    await supabase.from("sessions").update({ status }).eq("id", session!.id);
    setSession((s) => (s ? { ...s, status } : s));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-foreground">
            {session.code} · {session.name}
          </h1>
          <select
            className="rounded-md border border-border bg-card px-2 py-1 text-xs"
            value={session.status}
            onChange={(e) => setStatus(e.target.value as SessionRow["status"])}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "pendiente" ? "Pendiente" : s === "en_curso" ? "En curso" : "Completada"}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-xs text-muted">
          {session.week_label} · {session.duration_label} · {session.methodology}
        </p>
        {session.objective && <p className="mt-3 text-sm text-foreground">{session.objective}</p>}
        {session.aspiration_link && <p className="mt-2 text-xs italic text-muted">{session.aspiration_link}</p>}
      </div>

      <div className="space-y-3">
        {activities.map((a) => (
          <ActivityCard key={a.id} activity={a} session={session} aspirations={aspirations} participant={participant} />
        ))}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Salidas / resultados esperados</h2>
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          {outputs.map((o) => {
            const asp = findAspiration(aspirations, o.aspiration_id);
            const cls = aspClasses(asp?.number);
            return (
              <label key={o.id} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5" checked={o.is_done} onChange={() => toggleOutput(o)} />
                <span className={o.is_done ? "text-muted line-through" : "text-foreground"}>{o.description}</span>
                {asp && <span className={`ml-auto shrink-0 text-xs font-medium ${cls.text}`}>Asp. {asp.number}</span>}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
