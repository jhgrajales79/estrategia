"use client";

import { useEffect, useMemo, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchAspirations, fetchOutputs, fetchSessionMedia, fetchSessions, fetchTrackingBoard, type SessionMedia } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/feed";
import { isPresenter } from "@/lib/presenter";
import type { ActivityFeedRow, Aspiration, OutputRow, SessionRow, TrackingBoardRow } from "@/lib/types";
import Cronograma from "@/components/Cronograma";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import usePresence from "@/lib/usePresence";

export default function PanelPage() {
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [outputs, setOutputs] = useState<OutputRow[]>([]);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [tracking, setTracking] = useState<TrackingBoardRow[]>([]);
  const [feed, setFeed] = useState<ActivityFeedRow[]>([]);
  const [media, setMedia] = useState<SessionMedia[]>([]);
  const online = usePresence(participant);

  useEffect(() => {
    fetchSessions().then(setSessions).catch(console.error);
    fetchOutputs().then(setOutputs).catch(console.error);
    fetchAspirations().then(setAspirations).catch(console.error);
    fetchTrackingBoard().then(setTracking).catch(console.error);
    fetchSessionMedia().then(setMedia).catch(console.error);
    supabase
      .from("activity_feed")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25)
      .then(({ data }) => setFeed((data as ActivityFeedRow[]) ?? []));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("panel-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_feed" }, (payload) => {
        setFeed((prev) => [payload.new as ActivityFeedRow, ...prev].slice(0, 25));
      })
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
        fetchSessionMedia().then(setMedia).catch(console.error);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
    <div className="mx-auto max-w-6xl px-4 py-8">
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

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Avance por aspiración</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {aspirations.map((a) => {
                const cls = aspClasses(a.number);
                const t = tracking.find((tb) => tb.aspiration_id === a.id);
                return (
                  <div key={a.id} className={`rounded-xl border-t-4 ${cls.border} bg-card p-4 shadow-sm`}>
                    <p className={`text-xs font-bold uppercase ${cls.text}`}>Aspiración {a.number}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{a.name}</p>
                    <div className="mt-3 space-y-1.5 text-xs">
                      <div>
                        <div className="flex justify-between"><span>Planeación</span><span>{t?.planeacion_pct ?? 0}%</span></div>
                        <div className="h-1.5 rounded-full bg-black/10"><div className={`h-full rounded-full ${cls.bg}`} style={{ width: `${t?.planeacion_pct ?? 0}%`, opacity: 0.5 }} /></div>
                      </div>
                      <div>
                        <div className="flex justify-between"><span>Ejecución</span><span>{t?.ejecucion_pct ?? 0}%</span></div>
                        <div className="h-1.5 rounded-full bg-black/10"><div className={`h-full rounded-full ${cls.bg}`} style={{ width: `${t?.ejecucion_pct ?? 0}%` }} /></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Cronograma</h2>
            <Cronograma sessions={sessions} progress={sessionProgress} presenter={presenter} onToggleEnabled={toggleSession} />
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              En línea ahora ({online.length})
            </h2>
            <div className="rounded-xl border border-border bg-card p-3">
              {online.length === 0 && <p className="text-sm text-muted">Nadie más conectado.</p>}
              <ul className="space-y-1.5">
                {online.map((o, i) => {
                  const asp = findAspiration(aspirations, o.aspiration_id);
                  const cls = aspClasses(asp?.number);
                  return (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className={`h-2 w-2 rounded-full ${cls.bg}`} />
                      {o.name}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Actividad reciente</h2>
            <div className="max-h-[32rem] space-y-2 overflow-y-auto rounded-xl border border-border bg-card p-3">
              {feed.length === 0 && <p className="text-sm text-muted">Sin actividad todavía.</p>}
              {feed.map((f) => {
                const asp = findAspiration(aspirations, f.aspiration_id);
                const cls = aspClasses(asp?.number);
                return (
                  <div key={f.id} className={`border-l-2 ${cls.border} pl-2 text-sm`}>
                    <p className="text-foreground">{f.summary}</p>
                    <p className="text-xs text-muted">{new Date(f.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Resultados por sesión</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {sessions.map((s) => {
            const outs = outputs.filter((o) => o.session_id === s.id);
            const done = outs.filter((o) => o.is_done);
            const sessionMedia = media.filter((m) => m.session_id === s.id);
            const photos = sessionMedia.flatMap((m) => m.media);
            const links = sessionMedia.filter((m) => m.external_link);
            return (
              <div key={s.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {s.code} · {s.name}
                  </p>
                  <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs text-muted">
                    {done.length}/{outs.length} logradas
                  </span>
                </div>
                {done.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted">
                    {done.map((o) => (
                      <li key={o.id}>{o.description}</li>
                    ))}
                  </ul>
                )}
                {(photos.length > 0 || links.length > 0) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    {photos.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={url} src={url} alt="Foto de la sesión" className="h-16 w-16 rounded-md border border-border object-cover" />
                    ))}
                    {links.map(
                      (m) =>
                        m.external_link && (
                          <a
                            key={m.activity_title}
                            href={m.external_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand hover:underline"
                          >
                            🔗 Panel visual
                          </a>
                        )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
