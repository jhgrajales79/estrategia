"use client";

import { use, useEffect, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchActivities, fetchAspirations, fetchOutputs, fetchSessionByCode, resetSessionActivitiesData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/feed";
import { isPresenter } from "@/lib/presenter";
import type { ActivityRow, Aspiration, OutputRow, SessionRow } from "@/lib/types";
import ActivityCard from "@/components/ActivityCard";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { ToggleSwitch, LockBadge } from "@/components/activities/shared";

const STATUS_OPTIONS: SessionRow["status"][] = ["pendiente", "en_curso", "completada"];

export default function SessionDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [outputs, setOutputs] = useState<OutputRow[]>([]);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const [activeActivityId, setActiveActivityId] = useState<number | null>(null);
  const [showOutputs, setShowOutputs] = useState(false);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
  }, []);

  useEffect(() => {
    fetchSessionByCode(code.toUpperCase()).then((s) => {
      setSession(s);
      if (s) {
        fetchActivities(s.id).then((rows) => {
          setActivities(rows);
          setActiveActivityId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : (rows[0]?.id ?? null)));
        }).catch(console.error);
        fetchOutputs(s.id).then(setOutputs).catch(console.error);
      }
    });
  }, [code]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`session-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "outputs", filter: `session_id=eq.${session.id}` }, () => {
        fetchOutputs(session.id).then(setOutputs).catch(console.error);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "activities", filter: `session_id=eq.${session.id}` }, () => {
        fetchActivities(session.id).then(setActivities).catch(console.error);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${session.id}` }, (payload) => {
        setSession((s) => (s ? { ...s, ...(payload.new as SessionRow) } : s));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

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

  async function toggleSessionEnabled(next: boolean) {
    await supabase.from("sessions").update({ is_enabled: next }).eq("id", session!.id);
    setSession((s) => (s ? { ...s, is_enabled: next } : s));
    await logActivity({
      session_id: session!.id,
      participant_id: participant!.id,
      event_type: next ? "sesion_habilitada" : "sesion_bloqueada",
      summary: `${participant!.name} ${next ? "habilitó" : "bloqueó"} la sesión ${session!.code}`,
    });
  }

  async function toggleActivityEnabled(activity: ActivityRow, next: boolean) {
    await supabase.from("activities").update({ is_enabled: next }).eq("id", activity.id);
    setActivities((prev) => prev.map((a) => (a.id === activity.id ? { ...a, is_enabled: next } : a)));
    await logActivity({
      session_id: session!.id,
      participant_id: participant!.id,
      activity_id: activity.id,
      event_type: next ? "actividad_habilitada" : "actividad_bloqueada",
      summary: `${participant!.name} ${next ? "habilitó" : "bloqueó"} "${activity.title}"`,
    });
  }

  async function handleResetSession() {
    setResetting(true);
    try {
      await resetSessionActivitiesData(session!.id);
      setResetNonce((n) => n + 1);
      await logActivity({
        session_id: session!.id,
        participant_id: participant!.id,
        event_type: "sesion_reiniciada",
        summary: `${participant!.name} reinició la información de la sesión ${session!.code}`,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  }

  const locked = !session.is_enabled && !presenter;
  const activeActivity = activities.find((a) => a.id === activeActivityId) ?? null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="mb-5 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-dark">
            {session.code} · {session.name}
          </h1>
          <div className="flex items-center gap-3">
            {presenter && !confirmReset && (
              <button
                className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                onClick={() => setConfirmReset(true)}
                title="Reiniciar información de esta sesión"
              >
                🗑 Reiniciar sesión
              </button>
            )}
            {presenter && (
              <ToggleSwitch checked={session.is_enabled} onChange={toggleSessionEnabled} label="Habilitada" />
            )}
            {presenter ? (
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
            ) : (
              <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-muted">
                {session.status === "pendiente" ? "Pendiente" : session.status === "en_curso" ? "En curso" : "Completada"}
              </span>
            )}
          </div>
        </div>
        {session.objective && <p className="mt-2 text-sm text-foreground">{session.objective}</p>}

        {presenter && confirmReset && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <span>
              ¿Seguro? Se borrará permanentemente todo lo registrado por los equipos en las actividades de{" "}
              <strong>{session.code}</strong> (notas, votos, radar, ideas, matrices…). Esta acción no se puede deshacer.
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-black/5"
                onClick={() => setConfirmReset(false)}
                disabled={resetting}
              >
                Cancelar
              </button>
              <button
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                onClick={handleResetSession}
                disabled={resetting}
              >
                {resetting ? "Reiniciando…" : "Sí, reiniciar todo"}
              </button>
            </div>
          </div>
        )}
      </div>

      {locked ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <LockBadge text="El facilitador aún no ha habilitado esta sesión" />
          <p className="text-sm text-muted">Vuelve al panel para ver qué sesiones están activas.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 border-b border-border">
            <div role="tablist" aria-label="Actividades de la sesión" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
              {activities.map((a) => {
                const activityLocked = !a.is_enabled && !presenter;
                const active = a.id === activeActivityId;
                return (
                  <button
                    key={a.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveActivityId(a.id)}
                    className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                      active ? "border-brand text-brand-dark" : "border-transparent text-muted hover:text-foreground"
                    }`}
                    title={a.title}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {a.timer_status === "running" && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-brand" />}
                      {activityLocked && <span aria-hidden>🔒</span>}
                      {a.title}
                    </span>
                  </button>
                );
              })}
            </div>

            {outputs.length > 0 && (
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowOutputs((v) => !v)}
                  className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-black/5"
                  aria-expanded={showOutputs}
                >
                  🎯 Salidas
                  <span className="font-semibold text-foreground">
                    {outputs.filter((o) => o.is_done).length}/{outputs.length}
                  </span>
                </button>
                {showOutputs && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowOutputs(false)} />
                    <div className="absolute right-0 z-20 mt-1 w-80 rounded-xl border border-border bg-card p-4 shadow-lg">
                      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Salidas / resultados esperados</h2>
                      {!presenter && (
                        <p className="mb-2 text-xs text-muted">Solo el facilitador puede marcar las salidas como logradas.</p>
                      )}
                      <div className="max-h-80 space-y-2 overflow-y-auto">
                        {outputs.map((o) => {
                          const asp = findAspiration(aspirations, o.aspiration_id);
                          const cls = aspClasses(asp?.number);
                          return (
                            <label key={o.id} className={`flex items-start gap-2 text-sm ${presenter ? "" : "cursor-default"}`}>
                              <input
                                type="checkbox"
                                className="mt-0.5 disabled:cursor-default"
                                checked={o.is_done}
                                disabled={!presenter}
                                onChange={() => presenter && toggleOutput(o)}
                              />
                              <span className={o.is_done ? "text-muted line-through" : "text-foreground"}>{o.description}</span>
                              {asp && <span className={`ml-auto shrink-0 text-xs font-medium ${cls.text}`}>Asp. {asp.number}</span>}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {activeActivity && (
            <div role="tabpanel" className="mt-4">
              <ActivityCard
                key={`${activeActivity.id}-${resetNonce}`}
                activity={activeActivity}
                session={session}
                aspirations={aspirations}
                participant={participant}
                presenter={presenter}
                onToggleEnabled={toggleActivityEnabled}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
