"use client";

import { useEffect, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchAspirations, fetchTrackingBoard } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { Aspiration, TrackingBoardRow } from "@/lib/types";
import { aspClasses } from "@/lib/aspirationStyle";
import { inputCls } from "@/components/activities/shared";

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

export default function TableroPage() {
  const participant = useRequireParticipant();
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [tracking, setTracking] = useState<TrackingBoardRow[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);

  function reloadTracking() {
    fetchTrackingBoard().then(setTracking).catch(console.error);
  }

  async function loadKpis() {
    const { data: acts } = await supabase.from("activities").select("id").eq("activity_type", "ficha_kpi");
    const ids = (acts ?? []).map((a) => a.id);
    if (ids.length === 0) return setKpis([]);
    const { data: subs } = await supabase.from("submissions").select("aspiration_id, content").in("activity_id", ids);
    const all: Kpi[] = [];
    for (const s of subs ?? []) {
      const list = (s.content?.kpis as Kpi[]) ?? [];
      for (const k of list) all.push({ ...k, aspiration_id: k.aspiration_id ?? s.aspiration_id });
    }
    setKpis(all);
  }

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
    reloadTracking();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadKpis();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("tablero-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tracking_board" }, reloadTracking)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, loadKpis)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!participant) return null;

  async function updateField(aspirationId: number, field: "planeacion_pct" | "ejecucion_pct" | "note", value: string) {
    const payload = field === "note" ? { note: value } : { [field]: Number(value) || 0 };
    await supabase.from("tracking_board").update({ ...payload, updated_at: new Date().toISOString() }).eq("aspiration_id", aspirationId);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-xl font-bold text-dark">Tablero de seguimiento — acumulado anual</h1>
      <p className="mb-6 text-sm text-muted">Planeación vs. ejecución por aspiración e indicadores consolidados desde la S6.</p>

      <div className="grid gap-4 sm:grid-cols-3">
        {aspirations.map((a) => {
          const cls = aspClasses(a.number);
          const t = tracking.find((tb) => tb.aspiration_id === a.id);
          return (
            <div key={a.id} className={`rounded-xl border-t-4 ${cls.border} bg-card p-4 shadow-sm`}>
              <p className={`text-xs font-bold uppercase ${cls.text}`}>Aspiración {a.number}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{a.name}</p>
              <div className="mt-3 space-y-2 text-sm">
                <label className="block">
                  Planeación (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={inputCls}
                    defaultValue={t?.planeacion_pct ?? 0}
                    onBlur={(e) => updateField(a.id, "planeacion_pct", e.target.value)}
                  />
                </label>
                <label className="block">
                  Ejecución (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={inputCls}
                    defaultValue={t?.ejecucion_pct ?? 0}
                    onBlur={(e) => updateField(a.id, "ejecucion_pct", e.target.value)}
                  />
                </label>
                <label className="block">
                  Nota
                  <input className={inputCls} defaultValue={t?.note ?? ""} onBlur={(e) => updateField(a.id, "note", e.target.value)} />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-muted">Fichas KPI (S6)</h2>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-black/[0.03]">
            <tr>
              <th className="p-2 text-left">Aspiración</th>
              <th className="p-2 text-left">Indicador</th>
              <th className="p-2 text-left">Fórmula</th>
              <th className="p-2 text-left">Línea base</th>
              <th className="p-2 text-left">Meta 2027</th>
              <th className="p-2 text-left">Frecuencia</th>
              <th className="p-2 text-left">Responsable</th>
            </tr>
          </thead>
          <tbody>
            {kpis.map((k) => {
              const asp = aspirations.find((a) => a.id === k.aspiration_id);
              const cls = aspClasses(asp?.number);
              return (
                <tr key={k.id} className="border-t border-border">
                  <td className={`p-2 font-medium ${cls.text}`}>{asp ? `Asp. ${asp.number}` : "—"}</td>
                  <td className="p-2">{k.nombre}</td>
                  <td className="p-2">{k.formula}</td>
                  <td className="p-2">{k.linea_base}</td>
                  <td className="p-2">{k.meta_2027}</td>
                  <td className="p-2">{k.frecuencia}</td>
                  <td className="p-2">{k.responsable}</td>
                </tr>
              );
            })}
            {kpis.length === 0 && (
              <tr>
                <td className="p-3 text-sm text-muted" colSpan={7}>
                  Aún no hay indicadores registrados (se cargan desde la actividad &ldquo;Feria de indicadores&rdquo; de la S6).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
