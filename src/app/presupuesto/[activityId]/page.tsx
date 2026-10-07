"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchAspirations, fetchSessionById } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import {
  DESVIACION_SIGNIFICATIVA_PTS,
  fetchBudgetByAspiration,
  fetchBudgetTotal,
  fetchBudgetVsProgress,
  formatMoney,
  formatPct,
} from "@/lib/budget";
import type { ActivityRow, Aspiration, BudgetByAspiration, BudgetTotal, BudgetVsProgress, SessionRow } from "@/lib/types";

// Versión proyectable (pantalla completa, solo facilitador) del dashboard financiero global —
// para abrir desde el botón "⛶ Ver tablero" de la actividad de presupuesto en S6, mismo patrón
// visual oscuro que el resto de tableros (/notas, /votacion, /pilares, /objetivos...).
export default function PresupuestoFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [total, setTotal] = useState<BudgetTotal | null>(null);
  const [byAspiration, setByAspiration] = useState<BudgetByAspiration[]>([]);
  const [vsProgress, setVsProgress] = useState<BudgetVsProgress[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
    fetchActivityById(Number(activityId)).then((a) => {
      setActivity(a);
      if (a) fetchSessionById(a.session_id).then(setSession).catch(console.error);
    });
  }, [activityId]);

  async function load() {
    const [t, asp, vp] = await Promise.all([fetchBudgetTotal(), fetchBudgetByAspiration(), fetchBudgetVsProgress()]);
    setTotal(t);
    setByAspiration(asp);
    setVsProgress(vp);
    setLoaded(true);
  }

  useEffect(() => {
    load().catch(console.error);
    const channel = supabase
      .channel(`presupuesto-board-${activityId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_items" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_executions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_activities" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  if (!participant || !activity || !session || !loaded || !total) {
    return <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>;
  }

  if (!presenter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark px-4 text-center text-sm text-white/60">
        Solo el facilitador puede abrir este tablero.
      </div>
    );
  }

  const desviaciones = vsProgress.filter((v) => v.desviacion_significativa);

  return (
    <div className="min-h-screen bg-dark bg-[radial-gradient(circle_at_50%_0%,rgba(128,198,18,0.08),transparent_60%)] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto brightness-0 invert" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">Presupuesto de la planeación</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name}
          </p>
        </div>
      </div>

      <div className="mx-auto mt-8 grid max-w-[1500px] grid-cols-2 gap-4 sm:grid-cols-4">
        <BoardKpi label="Aprobado" value={formatMoney(total.approved)} />
        <BoardKpi label="Ejecutado" value={formatMoney(total.executed)} />
        <BoardKpi label="Saldo" value={formatMoney(total.saldo)} />
        <BoardKpi label="% ejecución" value={formatPct(total.pct_ejecucion)} highlight />
      </div>

      {desviaciones.length > 0 && (
        <div className="mx-auto mt-6 max-w-[1500px] rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-300">
            ⚠️ Desviación avance físico vs. ejecución presupuestal (&gt;{DESVIACION_SIGNIFICATIVA_PTS} pts)
          </p>
          <div className="space-y-1">
            {desviaciones.map((d) => (
              <p key={d.plan_activity_id} className="text-sm text-amber-100">
                <span className="font-semibold">{d.name}</span>: {formatPct(d.avance_fisico_pct)} avance vs. {formatPct(d.ejecucion_presupuestal_pct)} ejecutado
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto mt-8 max-w-[1500px] grid gap-5 md:grid-cols-3">
        {byAspiration.map((a) => {
          const cls = aspClasses(a.number);
          return (
            <div key={a.aspiration_id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cls.bg}`} />
                <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
                </p>
              </div>
              <p className="text-2xl font-bold text-white">{formatMoney(a.approved)}</p>
              <p className="mt-1 text-sm text-white/60">
                {formatMoney(a.executed)} ejecutado · {formatPct(a.pct_ejecucion)}
              </p>
              <p className="mt-1 text-xs text-white/40">
                {a.num_acciones} {a.num_acciones === 1 ? "acción" : "acciones"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardKpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">{label}</p>
      <p className={`mt-1 text-xl font-bold ${highlight ? "text-brand" : "text-white"}`}>{value}</p>
    </div>
  );
}
