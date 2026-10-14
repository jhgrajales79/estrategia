"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { fetchCostCenters } from "@/lib/data";
import {
  createBudgetItem,
  createPlanAction,
  createPlanActivity,
  deleteBudgetItem,
  deletePlanAction,
  deletePlanActivity,
  fetchBudgetItems,
  fetchPlanActions,
  fetchPlanActivities,
  formatMoney,
  parseMoney,
  updateBudgetItem,
  updatePlanAction,
  updatePlanActivity,
} from "@/lib/budget";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import type {
  ActivityRow,
  Aspiration,
  BudgetItemPlanEstado,
  BudgetItemRow,
  CostCenterRow,
  PlanActionRow,
  PlanActivityRow,
} from "@/lib/types";
import { inputCls, btnGhost, DeleteButton } from "./shared";

type ViewMode = "day" | "week" | "month";
const PX_PER_DAY: Record<ViewMode, number> = { day: 32, week: 10, month: 3.4 };

const ESTADO_META: Record<BudgetItemPlanEstado, { label: string; bar: string; dot: string }> = {
  pendiente: { label: "Pendiente", bar: "bg-amber-300", dot: "bg-amber-400" },
  programado: { label: "Programado", bar: "bg-brand", dot: "bg-brand" },
  completado: { label: "Completado", bar: "bg-emerald-500", dot: "bg-emerald-500" },
};

// "Acción" tal como la deja el taller S6 "De objetivo a proyecto estratégico" (tablero_proyectos)
// — mismo JSON `content.projects[]` que lee InsumosPanel para otras actividades, aquí se usa para
// PROMOVER cada proyecto a una fila real en `plan_actions`.
interface SourceProject {
  id: string;
  nombre?: string;
  alcance?: string;
  responsable?: string;
}

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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

// Centro de costo guardado como "{subcentro_codigo} · {centro}" — el código va primero porque es
// el identificador único del catálogo (ver cost_centers / "CENTRO DE COSTOS (55).xlsx").
function parseCostCenterValue(value: string | null, costCenters: CostCenterRow[]): { centro: string; codigo: string } {
  if (!value) return { centro: "", codigo: "" };
  const [codigo, ...rest] = value.split(" · ");
  const centro = rest.join(" · ") || costCenters.find((c) => c.subcentro_codigo === codigo)?.centro || "";
  return { centro, codigo };
}
function CostCenterPicker({
  value,
  costCenters,
  onChange,
}: {
  value: string | null;
  costCenters: CostCenterRow[];
  onChange: (next: string | null) => void;
}) {
  const saved = parseCostCenterValue(value, costCenters);
  const [draftCentro, setDraftCentro] = useState<string | null>(null);
  const activeCentro = draftCentro ?? saved.centro;
  const centros = [...new Set(costCenters.map((c) => c.centro))].sort((a, b) => a.localeCompare(b));
  const subcentros = costCenters.filter((c) => c.centro === activeCentro);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <select
        className={inputCls}
        value={activeCentro}
        onChange={(e) => {
          setDraftCentro(e.target.value);
          onChange(null);
        }}
      >
        <option value="">Centro…</option>
        {centros.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        className={inputCls}
        value={saved.codigo && saved.centro === activeCentro ? saved.codigo : ""}
        disabled={!activeCentro}
        onChange={(e) => {
          const sub = subcentros.find((s) => s.subcentro_codigo === e.target.value);
          onChange(sub ? `${sub.subcentro_codigo} · ${sub.centro}` : null);
        }}
      >
        <option value="">Subcentro…</option>
        {subcentros.map((s) => (
          <option key={s.subcentro_codigo} value={s.subcentro_codigo}>
            {s.subcentro_codigo} — {s.descripcion || s.centro}
          </option>
        ))}
      </select>
    </div>
  );
}

function PanelShell({ eyebrow, title, subtitle, onClose, children }: { eyebrow: string; title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{eyebrow}</p>
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            {subtitle}
          </div>
          <button className={btnGhost} onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Cronograma tipo Gantt (sección 6-10 de la especificación) consolidado entre las 3 aspiraciones.
// Todo el CRUD de Proyecto estratégico / Actividad / Concepto de costo vive aquí: cada fila del
// árbol izquierdo se puede abrir en un panel para editarla o borrarla, y hay botones "+" para
// crear actividades/conceptos sin salir del Gantt — un solo lugar de trabajo, en vez de un
// formulario "General" aparte.
export default function GanttPlaneacion({ activity, aspirations, presenter }: { activity: ActivityRow; aspirations: Aspiration[]; presenter: boolean }) {
  const [actions, setActions] = useState<PlanActionRow[]>([]);
  const [activities, setActivities] = useState<PlanActivityRow[]>([]);
  const [items, setItems] = useState<BudgetItemRow[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterRow[]>([]);
  const [sourceProjectsByAsp, setSourceProjectsByAsp] = useState<Record<number, SourceProject[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<ViewMode>("month");
  const [filterAsp, setFilterAsp] = useState<number | "all">("all");
  const [filterArea, setFilterArea] = useState<string>("");
  const [filterCentro, setFilterCentro] = useState<string>("");
  const [filterResponsable, setFilterResponsable] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<{ type: "accion" | "actividad" | "concepto"; id: number } | null>(null);
  const [addingActivityFor, setAddingActivityFor] = useState<number | null>(null);
  const [addingConceptFor, setAddingConceptFor] = useState<number | null>(null);
  const [newName, setNewName] = useState("");

  const actionsFrom = (activity.config.actionsFrom as number | undefined) ?? (activity.config.inputsFrom as number[] | undefined)?.[0];

  async function load() {
    const [a, act, it] = await Promise.all([fetchPlanActions(), fetchPlanActivities(), fetchBudgetItems()]);
    setActions(a);
    setActivities(act);
    setItems(it);
    setLoaded(true);
  }
  async function loadSourceProjects() {
    if (!actionsFrom) {
      setSourceProjectsByAsp({});
      return;
    }
    const map: Record<number, SourceProject[]> = {};
    await Promise.all(
      aspirations.map(async (asp) => {
        const { data } = await supabase.from("submissions").select("content").eq("activity_id", actionsFrom).eq("aspiration_id", asp.id).maybeSingle();
        const projects = ((data?.content as { projects?: SourceProject[] } | null)?.projects ?? []).filter((p) => p.nombre?.trim());
        map[asp.id] = projects;
      })
    );
    setSourceProjectsByAsp(map);
  }
  useEffect(() => {
    fetchCostCenters().then(setCostCenters).catch(console.error);
    load();
    loadSourceProjects();
    const channel = supabase
      .channel(`gantt-planeacion-${activity.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_actions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_activities" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_items" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${actionsFrom}` }, loadSourceProjects)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  const promotedSourceIds = new Set(actions.map((a) => a.source_project_id).filter(Boolean));
  const pendingProjects = aspirations.flatMap((asp) =>
    (sourceProjectsByAsp[asp.id] ?? []).filter((p) => !promotedSourceIds.has(p.id)).map((p) => ({ asp, project: p }))
  );
  async function promoteProject(aspId: number, p: SourceProject) {
    await createPlanAction({
      aspiration_id: aspId,
      name: p.nombre ?? "Acción sin nombre",
      scope: p.alcance ?? null,
      owner: p.responsable ?? null,
      source_activity_id: actionsFrom ?? null,
      source_project_id: p.id,
    });
  }

  async function addActivity(actionId: number) {
    if (!newName.trim()) return;
    await createPlanActivity({ action_id: actionId, name: newName.trim() });
    setNewName("");
    setAddingActivityFor(null);
  }
  async function addConcept(activityId: number) {
    if (!newName.trim()) return;
    await createBudgetItem({ plan_activity_id: activityId, concept: newName.trim(), year: new Date().getFullYear() });
    setNewName("");
    setAddingConceptFor(null);
  }

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
        .filter((x) => !filterResponsable || x.its.length > 0);
      return { a, acts };
    })
    .filter((x) => x.acts.length > 0 || (!filterArea && !filterCentro && !filterResponsable));

  const panelAction = panel?.type === "accion" ? actions.find((a) => a.id === panel.id) ?? null : null;
  const panelActivity = panel?.type === "actividad" ? activities.find((a) => a.id === panel.id) ?? null : null;
  const panelItem = panel?.type === "concepto" ? items.find((i) => i.id === panel.id) ?? null : null;
  const panelItemActivity = panelItem ? activities.find((a) => a.id === panelItem.plan_activity_id) ?? null : null;

  return (
    <div className="space-y-3">
      {pendingProjects.length > 0 && (
        <div className="rounded-lg border border-dashed border-brand/40 bg-brand/5 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-dark">
            📋 Proyectos del taller sin costear todavía — toca para promoverlos a proyecto estratégico
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingProjects.map(({ asp, project }) => {
              const cls = aspClasses(asp.number);
              return (
                <button
                  key={project.id}
                  className={`max-w-xs rounded-md border px-3 py-2 text-left text-xs shadow-sm hover:scale-[1.02] transition-transform ${cls.border} bg-card`}
                  onClick={() => promoteProject(asp.id, project)}
                >
                  <span className={`mb-0.5 block text-[10px] font-bold uppercase tracking-wide ${cls.text}`}>Asp. {asp.number}</span>
                  <span className="block truncate font-semibold text-foreground">{project.nombre}</span>
                  {project.responsable && <span className="mt-0.5 block text-[11px] text-muted">{project.responsable}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
        <p className="text-sm text-muted">Aún no hay proyectos estratégicos para mostrar (o ninguno coincide con los filtros).</p>
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
              const projectBudget = acts.reduce((sum, { its }) => sum + its.reduce((s, it) => s + it.approved, 0), 0);
              return (
                <div key={a.id}>
                  <div className="flex">
                    <div className={`sticky left-0 z-10 flex w-72 shrink-0 items-center gap-1 border-r border-t border-border px-2 py-1.5 ${cls.bgSoft}`}>
                      <button type="button" onClick={() => toggleCollapsed(projKey)} className="shrink-0 text-xs text-muted">
                        {projOpen ? "▾" : "▸"}
                      </button>
                      <button type="button" onClick={() => setPanel({ type: "accion", id: a.id })} className={`min-w-0 flex-1 truncate text-left text-xs font-bold ${cls.text}`}>
                        {a.name}
                      </button>
                      <span className="shrink-0 text-[10px] font-semibold text-muted">{formatMoney(projectBudget)}</span>
                    </div>
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
                      const activityBudget = its.reduce((s, it) => s + it.approved, 0);
                      return (
                        <div key={act.id}>
                          <div className="flex">
                            <div className="sticky left-0 z-10 flex w-72 shrink-0 items-center gap-1 border-r border-t border-border bg-card py-1.5 pl-5 pr-2">
                              <button type="button" onClick={() => toggleCollapsed(actKey)} className="shrink-0 text-xs text-muted">
                                {actOpen ? "▾" : "▸"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setPanel({ type: "actividad", id: act.id })}
                                className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-foreground"
                              >
                                {act.name || "Actividad sin nombre"}
                              </button>
                              <span className="shrink-0 text-[10px] font-semibold text-muted">{formatMoney(activityBudget)}</span>
                            </div>
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
                                    onClick={() => setPanel({ type: "concepto", id: it.id })}
                                    className={`sticky left-0 z-10 flex w-72 shrink-0 items-center justify-between gap-1.5 border-r border-t border-border bg-card py-1.5 pl-9 pr-2 text-left text-xs hover:bg-black/5 ${
                                      panel?.type === "concepto" && panel.id === it.id ? "bg-brand/10" : ""
                                    }`}
                                  >
                                    <span className="truncate text-foreground">{it.concept}</span>
                                    {it.plan_responsable && <span className="shrink-0 text-[10px] text-muted">{it.plan_responsable}</span>}
                                  </button>
                                  <div className="relative border-t border-border" style={{ width: timelineWidth, height: 32 }}>
                                    {style ? (
                                      <button
                                        type="button"
                                        onClick={() => setPanel({ type: "concepto", id: it.id })}
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
                                        onClick={() => setPanel({ type: "concepto", id: it.id })}
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

                          {actOpen && (
                            <div className="flex">
                              {addingConceptFor === act.id ? (
                                <div className="flex w-full items-center gap-1.5 border-t border-border bg-black/[0.01] py-1.5 pl-9 pr-2">
                                  <input
                                    autoFocus
                                    className={inputCls + " h-7 text-xs"}
                                    placeholder="Nombre del concepto de costo"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && addConcept(act.id)}
                                  />
                                  <button className="text-xs font-semibold text-brand-dark" onClick={() => addConcept(act.id)}>
                                    Agregar
                                  </button>
                                  <button
                                    className="text-xs text-muted"
                                    onClick={() => {
                                      setAddingConceptFor(null);
                                      setNewName("");
                                    }}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="w-full border-t border-border bg-black/[0.01] py-1.5 pl-9 text-left text-xs text-brand-dark hover:bg-brand/5"
                                  onClick={() => {
                                    setAddingConceptFor(act.id);
                                    setNewName("");
                                  }}
                                >
                                  + Agregar concepto de costo
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {projOpen && (
                    <div className="flex">
                      {addingActivityFor === a.id ? (
                        <div className="flex w-full items-center gap-1.5 border-t border-border bg-black/[0.01] py-1.5 pl-5 pr-2">
                          <input
                            autoFocus
                            className={inputCls + " h-7 text-xs"}
                            placeholder="Nombre de la actividad"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addActivity(a.id)}
                          />
                          <button className="text-xs font-semibold text-brand-dark" onClick={() => addActivity(a.id)}>
                            Agregar
                          </button>
                          <button
                            className="text-xs text-muted"
                            onClick={() => {
                              setAddingActivityFor(null);
                              setNewName("");
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          className="w-full border-t border-border bg-black/[0.01] py-1.5 pl-5 text-left text-xs text-brand-dark hover:bg-brand/5"
                          onClick={() => {
                            setAddingActivityFor(a.id);
                            setNewName("");
                          }}
                        >
                          + Agregar actividad
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {panelAction && <AccionPanel key={panelAction.id} action={panelAction} presenter={presenter} onClose={() => setPanel(null)} />}
      {panelActivity && (
        <ActividadPanel key={panelActivity.id} activity={panelActivity} costCenters={costCenters} presenter={presenter} onClose={() => setPanel(null)} />
      )}
      {panelItem && panelItemActivity && (
        <ConceptoPanel key={panelItem.id} item={panelItem} activity={panelItemActivity} presenter={presenter} onClose={() => setPanel(null)} />
      )}
    </div>
  );
}

function AccionPanel({ action, presenter, onClose }: { action: PlanActionRow; presenter: boolean; onClose: () => void }) {
  const [start, setStart] = useState(action.start_date ?? "");
  const [end, setEnd] = useState(action.end_date ?? "");
  const [error, setError] = useState<string | null>(null);

  function commit(patch: Partial<PlanActionRow>) {
    updatePlanAction(action.id, patch).catch((err) => setError(err instanceof Error ? err.message : "No se pudo guardar."));
  }
  function commitStart(value: string) {
    if (end && value && end < value) {
      setError("La fecha de inicio no puede quedar después de la fecha final.");
      return;
    }
    setError(null);
    setStart(value);
    commit({ start_date: value || null });
  }
  function commitEnd(value: string) {
    if (start && value && value < start) {
      setError("La fecha final no puede ser anterior a la fecha de inicio.");
      return;
    }
    setError(null);
    setEnd(value);
    commit({ end_date: value || null });
  }

  return (
    <PanelShell eyebrow="Proyecto estratégico" title={action.name} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre">
            <input
              className={inputCls}
              defaultValue={action.name}
                            onBlur={(e) => e.target.value !== action.name && commit({ name: e.target.value })}
            />
          </Field>
          <Field label="Responsable">
            <input
              className={inputCls}
              defaultValue={action.owner ?? ""}
                            onBlur={(e) => e.target.value !== action.owner && commit({ owner: e.target.value || null })}
            />
          </Field>
        </div>
        <Field label="Descripción y alcance">
          <textarea
            className={inputCls + " min-h-14 resize-y"}
            defaultValue={action.scope ?? ""}
                        onBlur={(e) => e.target.value !== action.scope && commit({ scope: e.target.value || null })}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Objetivo estratégico al que contribuye">
            <input
              className={inputCls}
              defaultValue={action.objetivo_estrategico ?? ""}
                            onBlur={(e) => e.target.value !== action.objetivo_estrategico && commit({ objetivo_estrategico: e.target.value || null })}
            />
          </Field>
          <Field label="Meta que se pretende alcanzar">
            <input
              className={inputCls}
              defaultValue={action.meta_descripcion ?? ""}
                            onBlur={(e) => e.target.value !== action.meta_descripcion && commit({ meta_descripcion: e.target.value || null })}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="KPI o indicador de medición">
            <input
              className={inputCls}
              defaultValue={action.kpi ?? ""}
                            onBlur={(e) => e.target.value !== action.kpi && commit({ kpi: e.target.value || null })}
            />
          </Field>
          <Field label="Frecuencia de medición">
            <select
              className={inputCls}
              defaultValue={action.frecuencia_medicion ?? ""}
                            onChange={(e) => commit({ frecuencia_medicion: (e.target.value || null) as PlanActionRow["frecuencia_medicion"] })}
            >
              <option value="">Sin definir…</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
              <option value="trimestral">Trimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tipo de medida">
            <select
              className={inputCls}
              defaultValue={action.tipo_medida ?? ""}
                            onChange={(e) => commit({ tipo_medida: (e.target.value || null) as PlanActionRow["tipo_medida"] })}
            >
              <option value="">Sin definir…</option>
              <option value="valor">Valor o monto</option>
              <option value="porcentaje">Porcentaje</option>
              <option value="binario">Binario (Sí/No)</option>
            </select>
          </Field>
          <Field label="Polaridad">
            <select
              className={inputCls}
              defaultValue={action.polaridad ?? ""}
                            onChange={(e) => commit({ polaridad: (e.target.value || null) as PlanActionRow["polaridad"] })}
            >
              <option value="">Sin definir…</option>
              <option value="ascendente">Ascendente</option>
              <option value="descendente">Descendente</option>
            </select>
          </Field>
          <Field label="Línea base">
            <input
              className={inputCls}
              defaultValue={action.linea_base ?? ""}
                            onBlur={(e) => e.target.value !== action.linea_base && commit({ linea_base: e.target.value || null })}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Valor de la meta">
            <input
              className={inputCls}
              defaultValue={action.valor_meta ?? ""}
              onBlur={(e) => e.target.value !== action.valor_meta && commit({ valor_meta: e.target.value || null })}
            />
          </Field>
          <Field label="Fecha inicio">
            <input type="date" className={inputCls} value={start} onChange={(e) => commitStart(e.target.value)} />
          </Field>
          <Field label="Fecha final">
            <input type="date" className={inputCls} value={end} onChange={(e) => commitEnd(e.target.value)} />
          </Field>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {presenter && (
          <div className="flex justify-end border-t border-border pt-3">
            <DeleteButton label="eliminar proyecto estratégico" onConfirm={() => deletePlanAction(action.id).then(onClose)} />
          </div>
        )}
      </div>
    </PanelShell>
  );
}

function ActividadPanel({
  activity,
  costCenters,
  presenter,
  onClose,
}: {
  activity: PlanActivityRow;
  costCenters: CostCenterRow[];
  presenter: boolean;
  onClose: () => void;
}) {
  const [start, setStart] = useState(activity.start_date ?? "");
  const [end, setEnd] = useState(activity.end_date ?? "");
  const [error, setError] = useState<string | null>(null);

  function commit(patch: Partial<PlanActivityRow>) {
    updatePlanActivity(activity.id, patch).catch((err) => setError(err instanceof Error ? err.message : "No se pudo guardar."));
  }
  function commitStart(value: string) {
    if (end && value && end < value) {
      setError("La fecha de inicio no puede quedar después de la fecha final.");
      return;
    }
    setError(null);
    setStart(value);
    commit({ start_date: value || null });
  }
  function commitEnd(value: string) {
    if (start && value && value < start) {
      setError("La fecha final no puede ser anterior a la fecha de inicio.");
      return;
    }
    setError(null);
    setEnd(value);
    commit({ end_date: value || null });
  }

  return (
    <PanelShell eyebrow="Actividad" title={activity.name || "Actividad sin nombre"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre de la actividad">
            <input
              className={inputCls}
              defaultValue={activity.name}
                            onBlur={(e) => e.target.value !== activity.name && commit({ name: e.target.value })}
            />
          </Field>
          <Field label="Área responsable">
            <input
              className={inputCls}
              placeholder="p. ej. PYO - Planificación y Operaciones"
              defaultValue={activity.area_responsable ?? ""}
                            onBlur={(e) => e.target.value !== activity.area_responsable && commit({ area_responsable: e.target.value || null })}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha inicio">
            <input type="date" className={inputCls} value={start} onChange={(e) => commitStart(e.target.value)} />
          </Field>
          <Field label="Fecha fin">
            <input type="date" className={inputCls} value={end} onChange={(e) => commitEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="Código presupuestal">
          <CostCenterPicker
            value={activity.cost_center}
            costCenters={costCenters}
            onChange={(next) => next !== activity.cost_center && commit({ cost_center: next })}
          />
        </Field>
        <Field label="Descripción y objetivos detallados">
          <textarea
            className={inputCls + " min-h-14 resize-y"}
            defaultValue={activity.notes ?? ""}
                        onBlur={(e) => e.target.value !== activity.notes && commit({ notes: e.target.value || null })}
          />
        </Field>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {presenter && (
          <div className="flex justify-end border-t border-border pt-3">
            <DeleteButton label="eliminar actividad" onConfirm={() => deletePlanActivity(activity.id).then(onClose)} />
          </div>
        )}
      </div>
    </PanelShell>
  );
}

function ConceptoPanel({
  item,
  activity,
  presenter,
  onClose,
}: {
  item: BudgetItemRow;
  activity: PlanActivityRow;
  presenter: boolean;
  onClose: () => void;
}) {
  const [start, setStart] = useState(item.plan_start_date ?? "");
  const [end, setEnd] = useState(item.plan_end_date ?? "");
  const [responsable, setResponsable] = useState(item.plan_responsable ?? "");
  const [estado, setEstado] = useState<BudgetItemPlanEstado>(item.plan_estado ?? "pendiente");
  const [notes, setNotes] = useState(item.plan_notes ?? "");
  const [approvedDraft, setApprovedDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function commit(patch: Partial<BudgetItemRow>) {
    updateBudgetItem(item.id, patch).catch((err) => setError(err instanceof Error ? err.message : "No se pudo guardar."));
  }
  function validateRange(s: string, e: string): string | null {
    if (s && e && e < s) return "La fecha final no puede ser anterior a la fecha de inicio.";
    if (activity.start_date && s && s < activity.start_date) return `La fecha de inicio no puede ser anterior al inicio de la actividad (${activity.start_date}).`;
    if (activity.end_date && e && e > activity.end_date) return `La fecha final no puede ser posterior al final de la actividad (${activity.end_date}).`;
    return null;
  }
  function commitStart(value: string) {
    const err = validateRange(value, end);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStart(value);
    commit({ plan_start_date: value || null });
  }
  function commitEnd(value: string) {
    const err = validateRange(start, value);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setEnd(value);
    commit({ plan_end_date: value || null });
  }

  return (
    <PanelShell
      eyebrow="Concepto de costo"
      title={item.concept}
      subtitle={
        (activity.start_date || activity.end_date) && (
          <p className="mt-1 text-xs text-muted">
            Rango permitido de la actividad: {activity.start_date ?? "sin definir"} → {activity.end_date ?? "sin definir"}
          </p>
        )
      }
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Concepto">
            <input
              className={inputCls}
              defaultValue={item.concept}
                            onBlur={(e) => e.target.value !== item.concept && commit({ concept: e.target.value })}
            />
          </Field>
          <Field label="Presupuesto">
            <input
              className={inputCls + " text-right"}
              value={approvedDraft !== null ? approvedDraft : item.approved ? String(item.approved) : ""}
                            onChange={(e) => setApprovedDraft(e.target.value.replace(/[^\d]/g, ""))}
              onFocus={() => setApprovedDraft(item.approved ? String(item.approved) : "")}
              onBlur={() => {
                if (approvedDraft !== null) commit({ approved: parseMoney(approvedDraft) });
                setApprovedDraft(null);
              }}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha inicio de la planeación">
            <input type="date" className={inputCls} value={start} onChange={(e) => commitStart(e.target.value)} />
          </Field>
          <Field label="Fecha final de la planeación">
            <input type="date" className={inputCls} value={end} onChange={(e) => commitEnd(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Responsable de ejecución/seguimiento">
            <input
              className={inputCls}
              value={responsable}
                            onChange={(e) => setResponsable(e.target.value)}
              onBlur={() => responsable !== (item.plan_responsable ?? "") && commit({ plan_responsable: responsable || null })}
            />
          </Field>
          <Field label="Estado de la planeación">
            <select
              className={inputCls}
              value={estado}
                            onChange={(e) => {
                const v = e.target.value as BudgetItemPlanEstado;
                setEstado(v);
                commit({ plan_estado: v });
              }}
            >
              <option value="pendiente">Pendiente</option>
              <option value="programado">Programado</option>
              <option value="completado">Completado</option>
            </select>
          </Field>
        </div>
        <Field label="Observaciones de la planeación">
          <textarea
            className={inputCls + " min-h-16"}
            value={notes}
                        onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (item.plan_notes ?? "") && commit({ plan_notes: notes || null })}
          />
        </Field>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {presenter && (
          <div className="flex justify-end border-t border-border pt-3">
            <DeleteButton label="eliminar concepto" onConfirm={() => deleteBudgetItem(item.id).then(onClose)} />
          </div>
        )}
      </div>
    </PanelShell>
  );
}
