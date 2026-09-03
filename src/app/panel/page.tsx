"use client";

import { useEffect, useMemo, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchAspirations, fetchOutputs, fetchSessionMedia, fetchSessions, fetchTrackingBoard } from "@/lib/data";
import type { SessionMedia } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/feed";
import { isPresenter } from "@/lib/presenter";
import type { Aspiration, OutputRow, SessionRow, TrackingBoardRow } from "@/lib/types";
import Cronograma from "@/components/Cronograma";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import usePresence from "@/lib/usePresence";
import { Avatar } from "@/components/activities/shared";
import AspirationBadge from "@/components/AspirationBadge";
import MediaSlideshow from "@/components/MediaSlideshow";

export default function PanelPage() {
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [outputs, setOutputs] = useState<OutputRow[]>([]);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [tracking, setTracking] = useState<TrackingBoardRow[]>([]);
  const [media, setMedia] = useState<SessionMedia[]>([]);
  const online = usePresence(participant);

  useEffect(() => {
    fetchSessions().then(setSessions).catch(console.error);
    fetchOutputs().then(setOutputs).catch(console.error);
    fetchAspirations().then(setAspirations).catch(console.error);
    fetchTrackingBoard().then(setTracking).catch(console.error);
    fetchSessionMedia().then(setMedia).catch(console.error);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("panel-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "outputs" }, () => {
        fetchOutputs().then(setOutputs).catch(console.error);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tracking_board" }, () => {
        fetchTrackingBoard().then(setTracking).catch(console.error);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => {
        fetchSessions().then(setSessions).catch(console.error);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => {
        // No se puede filtrar de forma fiable por actividad en el payload; se recarga siempre.
        fetchSessionMedia().then(setMedia).catch(console.error);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const slides = useMemo(
    () => media.flatMap((m) => m.media.map((url) => ({ url, caption: m.activity_title }))),
    [media]
  );

  const sessionProgress = useMemo(() => {
    const map: Record<number, number> = {};
    for (const s of sessions) {
      const outs = outputs.filter((o) => o.session_id === s.id);
      if (outs.length === 0) continue;
      map[s.id] = Math.round((outs.filter((o) => o.is_done).length / outs.length) * 100);
    }
    return map;
  }, [sessions, outputs]);

  if (!participant) return null;

  async function toggleSession(session: SessionRow, next: boolean) {
    await supabase.from("sessions").update({ is_enabled: next }).eq("id", session.id);
    setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, is_enabled: next } : s)));
    await logActivity({
      session_id: session.id,
      participant_id: participant!.id,
      event_type: next ? "sesion_habilitada" : "sesion_bloqueada",
      summary: `${participant!.name} ${next ? "habilitó" : "bloqueó"} la sesión ${session.code}`,
    });
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-dark">Panel en vivo</h1>
          <p className="text-sm text-muted">Lo que cada equipo está desarrollando en tiempo real.</p>
        </div>
        {presenter && (
          <span className="rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold text-brand-dark">
            🎤 Modo presentador
          </span>
        )}
      </div>

      {slides.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">🖼️ Momentos de la sesión</h2>
          <MediaSlideshow slides={slides} className="h-64 w-full sm:h-80 lg:h-96" />
        </section>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {aspirations.map((a) => {
          const cls = aspClasses(a.number);
          const t = tracking.find((tb) => tb.aspiration_id === a.id);
          return (
            <div key={a.id} className={`rounded-xl border-t-4 ${cls.border} bg-card p-4 shadow-sm transition-shadow hover:shadow-md`}>
              <AspirationBadge number={a.number} />
              <p className="mt-1.5 line-clamp-2 text-xs text-muted">{a.name}</p>
              <div className="mt-3 space-y-1.5 text-xs">
                <div>
                  <div className="flex justify-between"><span>Planeación</span><span className="font-medium text-foreground">{t?.planeacion_pct ?? 0}%</span></div>
                  <div className="h-1.5 rounded-full bg-black/10"><div className={`h-full rounded-full ${cls.bg}`} style={{ width: `${t?.planeacion_pct ?? 0}%`, opacity: 0.5 }} /></div>
                </div>
                <div>
                  <div className="flex justify-between"><span>Ejecución</span><span className="font-medium text-foreground">{t?.ejecucion_pct ?? 0}%</span></div>
                  <div className="h-1.5 rounded-full bg-black/10"><div className={`h-full rounded-full ${cls.bg}`} style={{ width: `${t?.ejecucion_pct ?? 0}%` }} /></div>
                </div>
              </div>
            </div>
          );
        })}

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted">En línea ahora · {online.length + 1}</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {participant && (
              <div className="flex w-14 flex-col items-center gap-1" title={`${participant.name} (tú)`}>
                <Avatar name={participant.name} bgClass={aspClasses(findAspiration(aspirations, participant.aspiration_id)?.number).bg} isFacilitador={participant.role === "facilitador"} />
                <span className="max-w-full truncate text-[10px] text-muted">Tú</span>
              </div>
            )}
            {online.map((o, i) => {
              const asp = findAspiration(aspirations, o.aspiration_id);
              const cls = aspClasses(asp?.number);
              return (
                <div key={i} className="flex w-14 flex-col items-center gap-1" title={o.name}>
                  <Avatar name={o.name} bgClass={cls.bg} isFacilitador={o.role === "facilitador"} />
                  <span className="max-w-full truncate text-[10px] text-muted">{o.name.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Cronograma</h2>
        <Cronograma sessions={sessions} progress={sessionProgress} presenter={presenter} onToggleEnabled={toggleSession} twoColumn />
      </section>

    </div>
  );
}
