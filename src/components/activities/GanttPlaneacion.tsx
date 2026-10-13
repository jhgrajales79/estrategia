"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchBudgetItems, fetchPlanActions, fetchPlanActivities, formatMoney, updateBudgetItem } from "@/lib/budget";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import type { Aspiration, BudgetItemPlanEstado, BudgetItemRow, PlanActionRow, PlanActivityRow } from "@/lib/types";
import { inputCls, btnGhost, btnPrimary } from "./shared";

type ViewMode = "day" | "week" | "month";
const PX_PER_DAY: Record<ViewMode, number> = { day: 32, week: 10, month: 3.4 };

const ESTADO_META: Record<BudgetItemPlanEstado, { label: string; bar: string; dot: string }> = {
  pendiente: { label: "Pendiente", bar: "bg-amber-300", dot: "bg-amber-400" },
  programado: { label: "Programado", bar: "bg-brand", dot: "bg-brand" },
  completado: { label: "Completado", bar: "bg-emerald-500", dot: "bg-emerald-500" },
};

function toDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
const MONTH_LABEL = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Cronograma tipo Gantt (sección 6-10 de la especificación) — consolidado entre las 3
// aspiraciones, no por pestaña. Jerarquía: Proyecto estratégico (plan_actions) → Actividad
// (plan_activities) → Concepto de costo (budget_items, los que se programan en el tiempo). Las
// fechas se editan con campos de fecha en un panel lateral (no arrastrando la barra): la propia
// especificación lo permite ("siempre que la tecnología lo permita") y es la vía más confiable
// dado el resto de la app (inputs controlados, sin librería de drag).
export default function GanttPlaneacion({ aspirations }: { aspirations: Aspiration[] }) {
  const [actions, setActions] = useState<PlanActionRow[]>([]);
  const [activities, setActivities] = useState<PlanActivityRow[]>([]);
  const [items, setItems] = useState<BudgetItemRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<ViewMode>("month");
  const [filterAsp, setFilterAsp] = useState<number | "all">("all");
  const [filterArea, setFilterArea] = useState<string>("");
  const [filterCentro, setFilterCentro] = useState<string>("");
  const [filterResponsable, setFilterResponsable] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  async function load() {
    const [a, act, it] = await Promise.all([fetchPlanActions(), fetchPlanActivities(), fetchBudgetItems()]);
    setActions(a);
    setActivities(act);
    setItems(it);
    setLoaded(true);
  }
  useEffect(() => {
    load();
    const channel = supabase
      .channel("gantt-planeacion")
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_actions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_activities" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_items" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activitiesByAction = useMemo(() => {
    const map = new Map<number, PlanActivityRow[]>();
    for (const a of activities) (map.get(a.action_id) ?? map.set(a.action_id, []).get(a.action_id)!).push(a);
    return map;
  }, [activities]);
  const itemsByActivity = useMemo(() => {
    const map = new Map<number, BudgetItemRow[]>();
    for (const i of items) (map.get(i.plan_activity_id) ?? map.set(i.plan_activity_id, []).get(i.plan_activity_id)!).push(i);
    return map;
  }, [items]);

  const areaOptions = useMemo(() => [...new Set(activities.map((a) => a.area_responsable).filter(Boolean))] as string[], [activities]);
  const centroOptions = useMemo(
    () => [...new Set(activities.map((a) => a.cost_center?.split(" · ")[1]).filter(Boolean))] as string[],
    [activities]
  );

  // Rango total del cronograma: desde la fecha más temprana hasta la más tardía entre acciones,
  // actividades y conceptos — con 10 días de margen a cada lado para que las barras extremas no
  // queden pegadas al borde.
  const { rangeStart, totalDays } = useMemo(() => {
    const dates: Date[] = [];
    for (const a of actions) {
      const s = toDate(a.start_date);
      const e = toDate(a.end_date);
      if (s) dates.push(s);
      if (e) dates.push(e);
    }
    for (const a of activities) {
      const s = toDate(a.start_date);
      const e = toDate(a.end_date);
      if (s) dates.push(s);
      if (e) dates.push(e);
    }
    for (const i of items) {
      const s = toDate(i.plan_start_date);
      const e = toDate(i.plan_end_date);
      if (s) dates.push(s);
      if (e) dates.push(e);
    }
    if (dates.length === 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { rangeStart: today, totalDays: 120 };
    }
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    const start = addDays(min, -10);
    const span = Math.max(daysBetween(start, addDays(max, 10)), 30);
    return { rangeStart: start, totalDays: span };
  }, [actions, activities, items]);

  const pxPerDay = PX_PER_DAY[view];
  const timelineWidth = totalDays * pxPerDay;

  function barStyle(start: Date | null, end: Date | null) {
    if (!start || !end) return null;
    const left = Math.max(0, daysBetween(rangeStart, start)) * pxPerDay;
    const width = Math.max(daysBetween(start, end) + 1, 1) * pxPerDay;
    return { left, width: Math.max(width, 6) };
  }

  // Encabezado de la línea de tiempo: un tick por día/semana/mes, según la vista activa — cambia
  // la densidad de las marcas, no la posición proporcional de las barras (que siempre es por día).
  const ticks = useMemo(() => {
    const out: { left: number; label: string; key: string }[] = [];
    if (view === "month") {
      let d = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      while (daysBetween(rangeStart, d) < totalDays) {
        out.push({ left: Math.max(0, daysBetween(rangeStart, d)) * pxPerDay, label: `${MONTH_LABEL[d.getMonth()]} ${d.getFullYear()}`, key: isoDate(d) });
        d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      }
    } else {
      const stepDays = view === "week" ? 7 : 1;
      for (let n = 0; n <= totalDays; n += stepDays) {
        const d = addDays(rangeStart, n);
        out.push({ left: n * pxPerDay, label: view === "week" ? `${d.getDate()} ${MONTH_LABEL[d.getMonth()]}` : `${d.getDate()}`, key: isoDate(d) });
      }
    }
    return out;
  }, [view, rangeStart, totalDays, pxPerDay]);

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Filtra a nivel de concepto y conserva solo los proyectos/actividades que tengan al menos un
  // concepto visible — así un filtro nunca deja un encabezado huérfano sin filas debajo.
  const visibleActions = actions
    .filter((a) => filterAsp === "all" || a.aspiration_id === filterAsp)
    .map((a) => {
      const acts = (activitiesByAction.get(a.id) ?? [])
        .filter((act) => !filterArea || act.area_responsable === filterArea)
        .filter((act) => !filterCentro || act.cost_center?.includes(filterCentro))
        .map((act) => {
          const its = (itemsByActivity.get(act.id) ?? []).filter(
            (it) => !filterResponsable || (it.plan_responsable ?? "").toLowerCase().includes(filterResponsable.toLowerCase())
          );
          return { act, its };
        })
        .filter((x) => x.its.length > 0);
      return { a, acts };
    })
    .filter((x) => x.acts.length > 0);

  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null;
  const selectedActivity = selectedItem ? activities.find((a) => a.id === selectedItem.plan_activity_id) ?? null : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border bg-card p-0.5">
          {(["day", "week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                view === v ? "bg-brand text-dark" : "text-muted hover:bg-black/5"
              }`}
            >
              {v === "day" ? "Día" : v === "week" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
        <select className={inputCls + " w-auto"} value={filterAsp} onChange={(e) => setFilterAsp(e.target.value === "all" ? "all" : Number(e.target.value))}>
          <option value="all">Todas las aspiraciones</option>
          {aspirations.map((a) => (
            <option key={a.id} value={a.id}>
              Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
            </option>
          ))}
        </select>
        <select className={inputCls + " w-auto"} value={filterArea} onChange={(e) => setFilterArea(e.target.value)}>
          <option value="">Toda área responsable</option>
          {areaOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select className={inputCls + " w-auto"} value={filterCentro} onChange={(e) => setFilterCentro(e.target.value)}>
          <option value="">Todo centro de costo</option>
          {centroOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          className={inputCls + " w-auto"}
          placeholder="Buscar responsable de planeación…"
          value={filterResponsable}
          onChange={(e) => setFilterResponsable(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
        {(Object.keys(ESTADO_META) as BudgetItemPlanEstado[]).map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${ESTADO_META[k].dot}`} /> {ESTADO_META[k].label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-muted" /> Sin programar
        </span>
      </div>

      {visibleActions.length === 0 ? (
        <p className="text-sm text-muted">No hay conceptos de costo que coincidan con los filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <div className="inline-block min-w-full">
            <div className="flex">
              <div className="sticky left-0 z-10 w-72 shrink-0 border-r border-border bg-card" />
              <div className="relative shrink-0 border-b border-border bg-black/[0.02]" style={{ width: timelineWidth, height: 28 }}>
                {ticks.map((t) => (
                  <div
                    key={t.key}
                    className="absolute top-0 flex h-full items-center border-l border-border/60 pl-1 text-[10px] text-muted"
                    style={{ left: t.left }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>
            </div>

            {visibleActions.map(({ a, acts }) => {
              const asp = aspirations.find((x) => x.id === a.aspiration_id);
              const cls = aspClasses(asp?.number);
              const projKey = `proj-${a.id}`;
              const projOpen = !collapsed.has(projKey);
              return (
                <div key={a.id}>
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => toggleCollapsed(projKey)}
                      className={`sticky left-0 z-10 flex w-72 shrink-0 items-center gap-1.5 border-r border-t border-border px-2 py-1.5 text-left text-xs font-bold ${cls.bgSoft} ${cls.text}`}
                    >
                      <span>{projOpen ? "▾" : "▸"}</span>
                      <span className="truncate">{a.name}</span>
                    </button>
                    <div className="border-t border-border" style={{ width: timelineWidth, height: 32 }}>
                      {(() => {
                        const style = barStyle(toDate(a.start_date), toDate(a.end_date));
                        return style ? (
                          <div
                            className={`relative top-2 h-2.5 rounded-full ${cls.bg} opacity-70`}
                            style={{ marginLeft: style.left, width: style.width }}
                            title={`${a.name}: ${a.start_date ?? "?"} → ${a.end_date ?? "?"}`}
                          />
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {projOpen &&
                    acts.map(({ act, its }) => {
                      const actKey = `act-${act.id}`;
                      const actOpen = !collapsed.has(actKey);
                      return (
                        <div key={act.id}>
                          <div className="flex">
                            <button
                              type="button"
                              onClick={() => toggleCollapsed(actKey)}
                              className="sticky left-0 z-10 flex w-72 shrink-0 items-center gap-1.5 border-r border-t border-border bg-card py-1.5 pl-5 pr-2 text-left text-xs font-semibold text-foreground"
                            >
                              <span>{actOpen ? "▾" : "▸"}</span>
                              <span className="truncate">{act.name}</span>
                            </button>
                            <div className="border-t border-border" style={{ width: timelineWidth, height: 28 }}>
                              {(() => {
                                const style = barStyle(toDate(act.start_date), toDate(act.end_date));
                                return style ? (
                                  <div
                                    className="relative top-2 h-2 rounded-full bg-foreground/30"
                                    style={{ marginLeft: style.left, width: style.width }}
                                    title={`${act.name}: ${act.start_date ?? "?"} → ${act.end_date ?? "?"}`}
                                  />
                                ) : null;
                              })()}
                            </div>
                          </div>

                          {actOpen &&
                            its.map((it) => {
                              const start = toDate(it.plan_start_date);
                              const end = toDate(it.plan_end_date);
                              const style = barStyle(start, end);
                              const estado = it.plan_estado ?? "pendiente";
                              const inconsistente =
                                (start && toDate(act.start_date) && start < toDate(act.start_date)!) ||
                                (end && toDate(act.end_date) && end > toDate(act.end_date)!);
                              return (
                                <div key={it.id} className="flex">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedItemId(it.id)}
                                    className={`sticky left-0 z-10 flex w-72 shrink-0 items-center justify-between gap-1.5 border-r border-t border-border bg-card py-1.5 pl-9 pr-2 text-left text-xs hover:bg-black/5 ${
                                      selectedItemId === it.id ? "bg-brand/10" : ""
                                    }`}
                                  >
                                    <span className="truncate text-foreground">{it.concept}</span>
                                    {it.plan_responsable && <span className="shrink-0 text-[10px] text-muted">{it.plan_responsable}</span>}
                                  </button>
                                  <div className="relative border-t border-border" style={{ width: timelineWidth, height: 32 }}>
                                    {style ? (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedItemId(it.id)}
                                        className={`absolute top-2 h-4 rounded ${ESTADO_META[estado].bar} ${
                                          inconsistente ? "ring-2 ring-red-500" : ""
                                        } text-left text-[10px] leading-4 text-dark/80 shadow-sm hover:opacity-80`}
                                        style={{ left: style.left, width: style.width }}
                                        title={`${it.concept} · ${formatMoney(it.approved)} · ${it.plan_start_date} → ${it.plan_end_date}`}
                                      >
                                        <span className="ml-1 truncate">{formatMoney(it.approved)}</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedItemId(it.id)}
                                        className="absolute top-2 h-4 w-28 rounded border border-dashed border-muted text-[10px] leading-4 text-muted hover:border-brand hover:text-brand-dark"
                                        style={{ left: 4 }}
                                      >
                                        Sin programar
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedItem && selectedActivity && (
        <ConceptPlanPanel item={selectedItem} activity={selectedActivity} onClose={() => setSelectedItemId(null)} onChanged={load} />
      )}
    </div>
  );
}

function ConceptPlanPanel({
  item,
  activity,
  onClose,
  onChanged,
}: {
  item: BudgetItemRow;
  activity: PlanActivityRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [start, setStart] = useState(item.plan_start_date ?? "");
  const [end, setEnd] = useState(item.plan_end_date ?? "");
  const [responsable, setResponsable] = useState(item.plan_responsable ?? "");
  const [estado, setEstado] = useState<BudgetItemPlanEstado>(item.plan_estado ?? "pendiente");
  const [notes, setNotes] = useState(item.plan_notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    if (start && end && end < start) {
      setError("La fecha final no puede ser anterior a la fecha de inicio.");
      return;
    }
    if (activity.start_date && start && start < activity.start_date) {
      setError(`La fecha de inicio no puede ser anterior al inicio de la actividad (${activity.start_date}).`);
      return;
    }
    if (activity.end_date && end && end > activity.end_date) {
      setError(`La fecha final no puede ser posterior al final de la actividad (${activity.end_date}).`);
      return;
    }
    setSaving(true);
    try {
      await updateBudgetItem(item.id, {
        plan_start_date: start || null,
        plan_end_date: end || null,
        plan_responsable: responsable || null,
        plan_estado: estado,
        plan_notes: notes || null,
      });
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la planeación.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Programar concepto de costo</p>
            <h3 className="text-base font-bold text-foreground">{item.concept}</h3>
            <p className="text-xs text-muted">
              {activity.name} · Presupuesto: {formatMoney(item.approved)}
            </p>
          </div>
          <button className={btnGhost} onClick={onClose}>
            ✕
          </button>
        </div>
        {(activity.start_date || activity.end_date) && (
          <p className="mb-3 text-xs text-muted">
            Rango permitido de la actividad: {activity.start_date ?? "sin definir"} → {activity.end_date ?? "sin definir"}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Fecha inicio de la planeación</label>
            <input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Fecha final de la planeación</label>
            <input type="date" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Responsable de ejecución/seguimiento</label>
            <input className={inputCls} value={responsable} onChange={(e) => setResponsable(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Estado de la planeación</label>
            <select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value as BudgetItemPlanEstado)}>
              <option value="pendiente">Pendiente</option>
              <option value="programado">Programado</option>
              <option value="completado">Completado</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-muted">Observaciones de la planeación</label>
          <textarea className={inputCls + " min-h-16"} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>
            Cancelar
          </button>
          <button className={btnPrimary} disabled={saving} onClick={save}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
