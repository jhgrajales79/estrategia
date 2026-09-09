"use client";

import { useEffect, useMemo, useState } from "react";
import { getStoredParticipant, StoredParticipant } from "@/lib/participant";
import {
  fetchActivities,
  fetchAspirations,
  fetchSessions,
  fetchSubmissionsByActivityIds,
  fetchTejidoMediaByActivity,
  TejidoActivityMedia,
} from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { isPresenter } from "@/lib/presenter";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";
import ActivityResults from "@/components/results/ActivityResults";
import { LockBadge } from "@/components/activities/shared";
import WeaveGalleryViewer from "@/components/WeaveGalleryViewer";

// Página pública: no requiere haber ingresado con nombre/rol. Cualquier visitante puede ver
// los resultados de las sesiones que el facilitador ya haya habilitado; las que no, siguen
// ocultas igual que antes (isPresenter(null) da false, así que un visitante anónimo nunca ve
// sesiones bloqueadas).
export default function NuestroTrabajoPage() {
  const [participant, setParticipant] = useState<StoredParticipant | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParticipant(getStoredParticipant());
  }, []);
  const presenter = isPresenter(participant);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [submissions, setSubmissions] = useState<
    { activity_id: number; aspiration_id: number | null; content: Record<string, unknown>; updated_at: string }[]
  >([]);
  const [loadingTab, setLoadingTab] = useState(false);
  const [tejidoMedia, setTejidoMedia] = useState<TejidoActivityMedia[]>([]);
  const [generalGalleryOpen, setGeneralGalleryOpen] = useState(false);

  useEffect(() => {
    fetchSessions().then(setSessions).catch(console.error);
    fetchAspirations().then(setAspirations);
    fetchTejidoMediaByActivity().then(setTejidoMedia).catch(console.error);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("nuestro-trabajo-sesiones")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => {
        fetchSessions().then(setSessions).catch(console.error);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => {
        fetchTejidoMediaByActivity().then(setTejidoMedia).catch(console.error);
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

  const activityIdsWithData = useMemo(() => new Set(submissions.map((s) => s.activity_id)), [submissions]);
  const withDataCount = activities.filter((a) => activityIdsWithData.has(a.id)).length;

  const activeSession = sessions.find((s) => s.id === activeTab);

  // El collage general solo mezcla fotos de sesiones ya habilitadas por el facilitador (o
  // todas, si quien mira es el propio facilitador) — mismo criterio de visibilidad que las
  // pestañas de abajo, para no filtrar fotos de una sesión que aún no se ha compartido.
  const allTejidoMedia = useMemo(
    () =>
      tejidoMedia
        .filter((t) => presenter || sessions.find((s) => s.id === t.session_id)?.is_enabled)
        .flatMap((t) => t.media),
    [tejidoMedia, sessions, presenter]
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-dark">
            <span aria-hidden>🗂️</span> Nuestro trabajo
          </h1>
          <p className="mt-0.5 text-sm text-muted">Los resultados de cada ejercicio, sesión por sesión.</p>
        </div>
        {!loadingTab && activeSession && activities.length > 0 && (
          <span className="shrink-0 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-dark">
            {withDataCount} de {activities.length} con datos
          </span>
        )}
      </div>

      {allTejidoMedia.length > 0 && (
        <button
          className="mb-6 flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-gradient-to-r from-brand/10 to-transparent p-4 text-left transition-shadow hover:shadow-sm"
          onClick={() => setGeneralGalleryOpen(true)}
        >
          <div>
            <p className="text-sm font-semibold text-dark">🧶🖼️ Mural general — todas las sesiones</p>
            <p className="text-xs text-muted">
              {allTejidoMedia.length} {allTejidoMedia.length === 1 ? "foto o video" : "fotos y videos"} de todo el proceso, en un solo mosaico.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-gradient-to-r from-brand-dark to-brand px-4 py-2 text-xs font-semibold text-white shadow-sm">
            Ver mosaico general
          </span>
        </button>
      )}

      <div className="mb-6 flex flex-wrap gap-1.5 border-b border-border pb-4">
        {sessions.map((s) => {
          const locked = !s.is_enabled && !presenter;
          const active = activeTab === s.id;
          return (
            <button
              key={s.id}
              onClick={() => !locked && setActiveTab(s.id)}
              disabled={locked}
              title={locked ? "El facilitador aún no ha habilitado esta sesión" : s.name}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                locked
                  ? "cursor-not-allowed bg-black/5 text-muted opacity-50"
                  : active
                    ? "bg-brand text-dark shadow-sm"
                    : "bg-black/5 text-foreground hover:bg-black/10"
              }`}
            >
              {locked && "🔒"}
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
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5" />
              ))}
            </div>
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

      <WeaveGalleryViewer
        media={allTejidoMedia}
        open={generalGalleryOpen}
        onClose={() => setGeneralGalleryOpen(false)}
        title="Mural general"
        icon="🧶🖼️"
        itemLabelSingular="momento"
        itemLabelPlural="momentos de todo el proceso"
      />
    </div>
  );
}
