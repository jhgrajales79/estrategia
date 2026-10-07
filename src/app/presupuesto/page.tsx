"use client";

import { useEffect, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { supabase } from "@/lib/supabase";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import {
  DESVIACION_SIGNIFICATIVA_PTS,
  fetchBudgetByAction,
  fetchBudgetByAspiration,
  fetchBudgetByMonth,
  fetchBudgetByOwner,
  fetchBudgetBySource,
  fetchBudgetByYear,
  fetchBudgetTotal,
  fetchBudgetVsProgress,
  formatMoney,
  formatPct,
} from "@/lib/budget";
import type {
  BudgetByAction,
  BudgetByAspiration,
  BudgetByMonth,
  BudgetByOwner,
  BudgetBySource,
  BudgetByYear,
  BudgetTotal,
  BudgetVsProgress,
} from "@/lib/types";

// Dashboard financiero consolidado de toda la planeación — responde las preguntas de negocio
// (cuánto cuesta la planeación, cuánto por aspiración/acción, cuánto llevamos ejecutado, qué
// actividades se desvían entre avance físico y ejecución presupuestal) sin digitar ningún total
// a mano: todo viene de las vistas v_budget_* (ver migración 0084_presupuesto_planeacion.sql).
export default function PresupuestoPage() {
  const participant = useRequireParticipant();
  const [total, setTotal] = useState<BudgetTotal | null>(null);
  const [byAspiration, setByAspiration] = useState<BudgetByAspiration[]>([]);
  const [byAction, setByAction] = useState<BudgetByAction[]>([]);
  const [byYear, setByYear] = useState<BudgetByYear[]>([]);
  const [byMonth, setByMonth] = useState<BudgetByMonth[]>([]);
  const [byOwner, setByOwner] = useState<BudgetByOwner[]>([]);
  const [bySource, setBySource] = useState<BudgetBySource[]>([]);
  const [vsProgress, setVsProgress] = useState<BudgetVsProgress[]>([]);

  async function loadAll() {
    const [t, asp, act, yr, mo, own, src, vp] = await Promise.all([
      fetchBudgetTotal(),
      fetchBudgetByAspiration(),
      fetchBudgetByAction(),
      fetchBudgetByYear(),
      fetchBudgetByMonth(),
      fetchBudgetByOwner(),
      fetchBudgetBySource(),
      fetchBudgetVsProgress(),
    ]);
    setTotal(t);
    setByAspiration(asp);
    setByAction(act);
    setByYear(yr);
    setByMonth(mo);
    setByOwner(own);
    setBySource(src);
    setVsProgress(vp);
  }

  useEffect(() => {
    loadAll().catch(console.error);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("presupuesto-global")
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_items" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_executions" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_activities" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_actions" }, () => loadAll())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!participant || !total) return null;

  const desviaciones = vsProgress.filter((v) => v.desviacion_significativa);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-xl font-bold text-dark">Presupuesto de la planeación</h1>
      <p className="mb-6 text-sm text-muted">
        Consolidado automático desde las actividades costeadas en la S6 — nada aquí se digita a mano, todo se calcula desde los conceptos de costo
        y su ejecución mensual.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Presupuesto aprobado" value={formatMoney(total.approved)} />
        <Kpi label="Ejecutado" value={formatMoney(total.executed)} />
        <Kpi label="Saldo disponible" value={formatMoney(total.saldo)} />
        <Kpi label="% ejecución" value={formatPct(total.pct_ejecucion)} highlight />
        <Kpi label="Presupuesto estimado" value={formatMoney(total.estimated)} />
        <Kpi label="Actividades totales" value={String(total.num_actividades)} />
        <Kpi label="Con presupuesto" value={String(total.num_actividades_con_presupuesto)} />
        <Kpi label="Sin presupuesto" value={String(total.num_actividades - total.num_actividades_con_presupuesto)} />
      </div>

      {desviaciones.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">
            ⚠️ {desviaciones.length} {desviaciones.length === 1 ? "actividad tiene" : "actividades tienen"} desviación significativa (&gt;
            {DESVIACION_SIGNIFICATIVA_PTS} pts) entre avance físico y ejecución presupuestal
          </p>
          <div className="space-y-1">
            {desviaciones.map((d) => (
              <p key={d.plan_activity_id} className="text-xs text-amber-900">
                <span className="font-semibold">{d.name}</span>: {formatPct(d.avance_fisico_pct)} de avance físico vs. {formatPct(d.ejecucion_presupuestal_pct)} de
                ejecución presupuestal (brecha {d.brecha > 0 ? "+" : ""}
                {d.brecha.toFixed(1)} pts)
              </p>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Presupuesto por aspiración</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {byAspiration.map((a) => {
          const cls = aspClasses(a.number);
          return (
            <div key={a.aspiration_id} className={`rounded-xl border-t-4 ${cls.border} bg-card p-4 shadow-sm`}>
              <p className={`text-xs font-semibold uppercase ${cls.text}`}>
                Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
              </p>
              <p className="mt-1 text-lg font-bold text-foreground">{formatMoney(a.approved)}</p>
              <p className="text-xs text-muted">
                {formatMoney(a.executed)} ejecutado · {formatPct(a.pct_ejecucion)} · {a.num_acciones} {a.num_acciones === 1 ? "acción" : "acciones"}
              </p>
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Presupuesto por acción</h2>
      <Table
        head={["Acción", "Aprobado", "Ejecutado", "Saldo", "% ejecución", "Actividades"]}
        rows={byAction.map((a) => [a.name, formatMoney(a.approved), formatMoney(a.executed), formatMoney(a.saldo), formatPct(a.pct_ejecucion), String(a.num_actividades)])}
        empty="Aún no hay acciones costeadas."
      />

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Presupuesto plurianual</h2>
      <Table
        head={["Año", "Estimado", "Aprobado", "Ejecutado"]}
        rows={byYear.map((y) => [String(y.year), formatMoney(y.estimated), formatMoney(y.approved), formatMoney(y.executed)])}
        empty="Aún no hay presupuesto distribuido por año."
      />

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Ejecución por mes</h2>
      <Table
        head={["Mes", "Año", "Ejecutado"]}
        rows={byMonth.map((m) => [m.month.slice(0, 7), String(m.year), formatMoney(m.executed)])}
        empty="Aún no hay ejecución mensual registrada."
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Por responsable</h2>
          <Table
            head={["Responsable", "Aprobado", "Ejecutado"]}
            rows={byOwner.map((o) => [o.owner, formatMoney(o.approved), formatMoney(o.executed)])}
            empty="Sin responsables asignados aún."
          />
        </div>
        <div>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Por fuente de financiación</h2>
          <Table
            head={["Fuente", "Aprobado", "Ejecutado"]}
            rows={bySource.map((s) => [s.funding_source, formatMoney(s.approved), formatMoney(s.executed)])}
            empty="Sin fuentes de financiación definidas aún."
          />
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Avance físico vs. ejecución presupuestal</h2>
      <Table
        head={["Actividad", "Responsable", "% avance físico", "% ejecución presupuestal", "Brecha"]}
        rows={vsProgress.map((v) => [
          v.name,
          v.owner ?? "—",
          formatPct(v.avance_fisico_pct),
          formatPct(v.ejecucion_presupuestal_pct),
          `${v.brecha > 0 ? "+" : ""}${v.brecha.toFixed(1)} pts${v.desviacion_significativa ? " ⚠️" : ""}`,
        ])}
        empty="Aún no hay actividades con presupuesto aprobado para comparar."
      />
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-lg font-bold ${highlight ? "text-brand-dark" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="min-w-full text-sm">
        <thead className="bg-black/[0.03]">
          <tr>
            {head.map((h) => (
              <th key={h} className="p-2 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => (
                <td key={j} className={`p-2 ${j === 0 ? "font-medium text-foreground" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="p-3 text-sm text-muted" colSpan={head.length}>
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
