"use client";

import { useEffect, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchActivities, fetchAspirations, fetchSessions, fetchSubmissionsByActivityIds } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { isPresenter } from "@/lib/presenter";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";
import ActivityResults from "@/components/results/ActivityResults";
import { LockBadge } from "@/components/activities/shared";

export default function NuestroTrabajoPage() {
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [submissions, setSubmissions] = useState<
    { activity_id: number; aspiration_id: number | null; content: Record<string, unknown>; updated_at: string }[]
  >([]);
  const [loadingTab, setLoadingTab] = useState(false);

  useEffect(() => {
    fetchSessions().then(setSessions).catch(console.error);
    fetchAspirations().then(setAspirations);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("nuestro-trabajo-sesiones")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => {
        fetchSessions().then(setSessions).catch(console.error);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== null) return;
    const firstAvailable = sessions.find((s) => s.is_enabled) ?? (presenter ? sessions[0] : undefined);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (firstAvailable) setActiveTab(firstAvailable.id);
  }, [sessions, presenter, activeTab]);

  useEffect(() => {
    if (activeTab === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingTab(true);
    fetchActivities(activeTab)
      .then(async (acts) => {
        setActivities(acts);
        const subs = await fetchSubmissionsByActivityIds(acts.map((a) => a.id));
        setSubmissions(subs);
      })
      .finally(() => setLoadingTab(false));
  }, [activeTab]);

  if (!participant) return null;

  const activeSession = sessions.find((s) => s.id === activeTab);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold text-foreground">Nuestro trabajo</h1>
      <p className="mb-6 text-sm text-muted">Los resultados de cada ejercicio, sesión por sesión.</p>

      <div className="mb-6 flex flex-wrap gap-1.5 border-b border-border pb-3">
        {sessions.map((s) => {
          const locked = !s.is_enabled && !presenter;
          return (
            <button
              key={s.id}
              onClick={() => !locked && setActiveTab(s.id)}
              disabled={locked}
              title={locked ? "El facilitador aún no ha habilitado esta sesión" : undefined}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                locked
                  ? "cursor-not-allowed bg-black/5 text-muted opacity-50"
                  : activeTab === s.id
                    ? "bg-brand text-white"
                    : "bg-black/5 text-foreground hover:bg-black/10"
              }`}
            >
              {locked && "🔒 "}
              {s.code}
            </button>
          );
        })}
      </div>

      {activeSession && (!activeSession.is_enabled && !presenter ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <LockBadge text="El facilitador aún no ha habilitado esta sesión" />
        </div>
      ) : (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{activeSession.name}</h2>
          {loadingTab ? (
            <p className="text-sm text-muted">Cargando…</p>
          ) : (
            <div className="space-y-2">
              {activities.map((a) => (
                <ActivityResults
                  key={a.id}
                  activity={a}
                  aspirations={aspirations}
                  submissions={submissions.filter((s) => s.activity_id === a.id)}
                />
              ))}
              {activities.length === 0 && <p className="text-sm text-muted">Esta sesión no tiene actividades.</p>}
            </div>
          )}
        </div>
      ))}

      {!activeSession && sessions.length > 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <LockBadge text="Aún no hay sesiones habilitadas por el facilitador" />
        </div>
      )}
    </div>
  );
}
