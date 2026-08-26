"use client";

import { useEffect, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchActivities, fetchAspirations, fetchSessions, fetchSubmissionsByActivityIds } from "@/lib/data";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";
import ActivityResults from "@/components/results/ActivityResults";

export default function NuestroTrabajoPage() {
  const participant = useRequireParticipant();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [submissions, setSubmissions] = useState<
    { activity_id: number; aspiration_id: number | null; content: Record<string, unknown>; updated_at: string }[]
  >([]);
  const [loadingTab, setLoadingTab] = useState(false);

  useEffect(() => {
    fetchSessions().then((s) => {
      setSessions(s);
      if (s.length > 0) setActiveTab(s[0].id);
    });
    fetchAspirations().then(setAspirations);
  }, []);

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold text-foreground">Nuestro trabajo</h1>
      <p className="mb-6 text-sm text-muted">Los resultados de cada ejercicio, sesión por sesión.</p>

      <div className="mb-6 flex flex-wrap gap-1.5 border-b border-border pb-3">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveTab(s.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === s.id ? "bg-brand text-white" : "bg-black/5 text-foreground hover:bg-black/10"
            }`}
          >
            {s.code}
          </button>
        ))}
      </div>

      {activeTab !== null && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{sessions.find((s) => s.id === activeTab)?.name}</h2>
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
      )}
    </div>
  );
}
