"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchAspirations, fetchSessionById, fetchSubmissionsByActivityIds } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";

interface Kpi {
  id: string;
  aspiration_id: number | null;
  nombre: string;
  formula: string;
  linea_base: string;
  meta_2027: string;
  frecuencia: string;
  responsable: string;
}

// Tablero de solo lectura para "Feria de indicadores" (ficha_kpi, perAspiration): una columna
// por aspiración con sus KPI — mismo patrón que /objetivos, pero mostrando fórmula/línea
// base/meta/frecuencia/responsable en vez de los campos de un objetivo SMART.
export default function IndicadoresFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [kpisByAsp, setKpisByAsp] = useState<Map<number, Kpi[]>>(new Map());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
    fetchActivityById(Number(activityId)).then((a) => {
      setActivity(a);
      if (a) fetchSessionById(a.session_id).then(setSession).catch(console.error);
    });
  }, [activityId]);

  useEffect(() => {
    async function load() {
      const subs = await fetchSubmissionsByActivityIds([Number(activityId)]);
      const next = new Map<number, Kpi[]>();
      for (const s of subs) {
        if (s.aspiration_id === null) continue;
        const kpis = (s.content as { kpis?: Kpi[] } | null)?.kpis ?? [];
        next.set(s.aspiration_id, kpis);
      }
      setKpisByAsp(next);
      setLoaded(true);
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`indicadores-board-${activityId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${activityId}` }, () => {
        load().catch(console.error);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activityId]);

  if (!participant || !activity || !session || !loaded) {
    return <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>;
  }

  if (!presenter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark px-4 text-center text-sm text-white/60">
        Solo el facilitador puede abrir este tablero.
      </div>
    );
  }

  const totalKpis = Array.from(kpisByAsp.values()).reduce((a, list) => a + list.length, 0);

  return (
    <div className="min-h-screen bg-dark bg-[radial-gradient(circle_at_50%_0%,rgba(128,198,18,0.08),transparent_60%)] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto brightness-0 invert" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{activity.title}</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
          {totalKpis} {totalKpis === 1 ? "indicador" : "indicadores"}
        </span>
      </div>

      <div className="mx-auto mt-8 grid max-w-[1500px] gap-5 md:grid-cols-3">
        {aspirations.map((a) => {
          const cls = aspClasses(a.number);
          const kpis = kpisByAsp.get(a.id) ?? [];
          return (
            <div key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cls.bg}`} />
                <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
                </p>
                <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/60">{kpis.length}</span>
              </div>
              {kpis.length === 0 ? (
                <p className="py-10 text-center text-sm italic text-white/30">Aún sin indicadores.</p>
              ) : (
                <div className="space-y-3">
                  {kpis.map((k) => (
                    <div key={k.id} className={`rounded-xl border ${cls.border} bg-white/[0.04] p-3.5`}>
                      <p className="text-base font-bold leading-snug text-white">{k.nombre || "—"}</p>
                      <p className="mt-1 text-sm text-white/70">{k.formula || "—"}</p>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-white/60">
                        <span>
                          <span className="text-white/35">Línea base:</span> {k.linea_base || "—"}
                        </span>
                        <span>
                          <span className="text-white/35">Meta 2027:</span> {k.meta_2027 || "—"}
                        </span>
                        <span>
                          <span className="text-white/35">Frecuencia:</span> {k.frecuencia || "—"}
                        </span>
                        <span>
                          <span className="text-white/35">Responsable:</span> {k.responsable || "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
