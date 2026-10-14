"use client";

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { isPresenter } from "@/lib/presenter";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import {
  createBudgetItem,
  createPlanAction,
  createPlanActivity,
  deleteBudgetItem,
  deletePlanAction,
  deletePlanActivity,
  fetchBudgetItemTotals,
  fetchBudgetItems,
  fetchBudgetByAction,
  fetchPlanActions,
  fetchPlanActivities,
  formatMoney,
  formatPct,
  parseMoney,
  updateBudgetItem,
  updatePlanAction,
  updatePlanActivity,
} from "@/lib/budget";
import { fetchCostCenters } from "@/lib/data";
import GanttPlaneacion from "./GanttPlaneacion";
import type { BudgetByAction, BudgetItemRow, BudgetItemTotals, CostCenterRow, PlanActionRow, PlanActivityRow } from "@/lib/types";
import { ActivityComponentProps, inputCls, btnPrimary, btnDanger, btnGhost, PresenterHint, DeleteButton } from "./shared";

// "Acción" tal como la deja el taller S6 "De objetivo a proyecto estratégico"
// (tablero_proyectos) — mismo JSON `content.projects[]` que lee InsumosPanel para otras
// actividades, aquí se usa para PROMOVER cada proyecto a una fila real en `plan_actions`.
interface SourceProject {
  id: string;
  nombre?: string;
  alcance?: string;
  responsable?: string;
}

function MoneyField({ value, onCommit, placeholder }: { value: number; onCommit: (n: number) => void; placeholder?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className={inputCls + " text-right"}
      placeholder={placeholder}
      value={draft !== null ? draft : value ? String(value) : ""}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
      onFocus={() => setDraft(value ? String(value) : "")}
      onBlur={() => {
        if (draft !== null) onCommit(parseMoney(draft));
        setDraft(null);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function BudgetItemRowView({
  item,
  presenter,
  onChanged,
}: {
  item: BudgetItemRow;
  presenter: boolean;
  onChanged: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          className={inputCls + " sm:col-span-2"}
          placeholder="Concepto (p. ej. Licenciamiento)"
          defaultValue={item.concept}
          disabled={presenter}
          onBlur={(e) => e.target.value !== item.concept && updateBudgetItem(item.id, { concept: e.target.value }).then(onChanged)}
        />
        {!presenter ? (
          <MoneyField value={item.approved} placeholder="Presupuesto" onCommit={(n) => updateBudgetItem(item.id, { approved: n }).then(onChanged)} />
        ) : (
          <p className="rounded-md bg-black/[0.03] px-3 py-1.5 text-right text-sm text-foreground">{formatMoney(item.approved)}</p>
        )}
        <div className="flex items-center justify-end gap-1">
          {!presenter && <DeleteButton onConfirm={() => deleteBudgetItem(item.id).then(onChanged)} />}
        </div>
      </div>
    </div>
  );
}

// Centro de costo guardado como "{subcentro_codigo} · {centro}" (p. ej. "001101 ·
// 011-DIRECCION EJECUTIVA") — el código va primero porque es el identificador único del
// catálogo (ver cost_centers / "CENTRO DE COSTOS (55).xlsx"), el nombre del centro es solo para
// que se lea de un vistazo. Selección en cascada: primero el centro (proyecto), luego su
// subcentro — evita tener que buscar entre 318 códigos sueltos.
function parseCostCenterValue(value: string | null, costCenters: CostCenterRow[]): { centro: string; codigo: string } {
  if (!value) return { centro: "", codigo: "" };
  const [codigo, ...rest] = value.split(" · ");
  const centro = rest.join(" · ") || costCenters.find((c) => c.subcentro_codigo === codigo)?.centro || "";
  return { centro, codigo };
}

function CostCenterPicker({
  value,
  costCenters,
  disabled,
  onChange,
}: {
  value: string | null;
  costCenters: CostCenterRow[];
  disabled: boolean;
  onChange: (next: string | null) => void;
}) {
  const saved = parseCostCenterValue(value, costCenters);
  const [draftCentro, setDraftCentro] = useState<string | null>(null);
  const activeCentro = draftCentro ?? saved.centro;
  const centros = [...new Set(costCenters.map((c) => c.centro))].sort((a, b) => a.localeCompare(b));
  const subcentros = costCenters.filter((c) => c.centro === activeCentro);

  if (disabled) {
    const match = costCenters.find((c) => c.subcentro_codigo === saved.codigo);
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Centro</p>
          <p className="rounded-md bg-black/[0.03] px-3 py-1.5 text-sm text-foreground min-h-8">{saved.centro || "—"}</p>
        </div>
        <div>
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Subcentro</p>
          <p className="rounded-md bg-black/[0.03] px-3 py-1.5 text-sm text-foreground min-h-8">
            {saved.codigo ? `${saved.codigo}${match?.descripcion ? ` — ${match.descripcion}` : ""}` : "—"}
          </p>
        </div>
      </div>
    );
  }
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

// Campo con etiqueta — mismo patrón visual que el mockup "Detalle de Acción Estratégica"
// (front.jpg): etiqueta corta arriba, el control abajo.
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
function PlanActivityCard({
  activity,
  costCenters,
  presenter,
  onChanged,
}: {
  activity: PlanActivityRow;
  costCenters: CostCenterRow[];
  presenter: boolean;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<BudgetItemRow[]>([]);
  const [totals, setTotals] = useState<BudgetItemTotals[]>([]);
  const [newConcept, setNewConcept] = useState("");

  async function load() {
    const [budgetItems, itemTotals] = await Promise.all([fetchBudgetItems(activity.id), fetchBudgetItemTotals(activity.id)]);
    setItems(budgetItems);
    setTotals(itemTotals);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.id]);

  async function addConcept() {
    if (!newConcept.trim()) return;
    await createBudgetItem({ plan_activity_id: activity.id, concept: newConcept.trim(), year: new Date().getFullYear() });
    setNewConcept("");
    load();
    onChanged();
  }

  const [showDetail, setShowDetail] = useState(false);
  const totalApproved = items.reduce((a, i) => a + i.approved, 0);
  const totalExecuted = totals.reduce((a, t) => a + t.executed, 0);
  const pctEjec = totalApproved > 0 ? (totalExecuted / totalApproved) * 100 : 0;
  const summaryBits = [activity.area_responsable, activity.start_date && activity.end_date ? `${activity.start_date} → ${activity.end_date}` : null].filter(
    Boolean
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setShowDetail((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-black/[0.015]"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{activity.name || "Actividad sin nombre"}</p>
          <p className="truncate text-xs text-muted">
            {summaryBits.length > 0 ? summaryBits.join(" · ") : "Sin fechas ni área definidas"} · {items.length}{" "}
            {items.length === 1 ? "concepto" : "conceptos"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right text-xs leading-tight">
            <p className="font-bold text-foreground">{formatMoney(totalApproved)}</p>
            <p className="text-muted">ejecutado {formatPct(pctEjec)}</p>
          </div>
          <span className="text-muted">{showDetail ? "▾" : "▸"}</span>
        </div>
      </button>

      {showDetail && (
        <div className="space-y-3 border-t border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre de la actividad">
              <input
                className={inputCls}
                defaultValue={activity.name}
                disabled={presenter}
                onBlur={(e) => e.target.value !== activity.name && updatePlanActivity(activity.id, { name: e.target.value }).then(onChanged)}
              />
            </Field>
            <Field label="Área responsable">
              <input
                className={inputCls}
                placeholder="p. ej. PYO - Planificación y Operaciones"
                defaultValue={activity.area_responsable ?? ""}
                disabled={presenter}
                onBlur={(e) =>
                  e.target.value !== activity.area_responsable &&
                  updatePlanActivity(activity.id, { area_responsable: e.target.value || null }).then(onChanged)
                }
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fecha inicio">
              <input
                type="date"
                className={inputCls}
                defaultValue={activity.start_date ?? ""}
                disabled={presenter}
                onBlur={(e) => e.target.value !== activity.start_date && updatePlanActivity(activity.id, { start_date: e.target.value || null }).then(onChanged)}
              />
            </Field>
            <Field label="Fecha fin">
              <input
                type="date"
                className={inputCls}
                defaultValue={activity.end_date ?? ""}
                disabled={presenter}
                onBlur={(e) => e.target.value !== activity.end_date && updatePlanActivity(activity.id, { end_date: e.target.value || null }).then(onChanged)}
              />
            </Field>
          </div>

          <Field label="Código presupuestal">
            <CostCenterPicker
              value={activity.cost_center}
              costCenters={costCenters}
              disabled={presenter}
              onChange={(next) => next !== activity.cost_center && updatePlanActivity(activity.id, { cost_center: next }).then(onChanged)}
            />
          </Field>

          <Field label="Descripción y objetivos detallados">
            <textarea
              className={inputCls + " min-h-14 resize-y"}
              defaultValue={activity.notes ?? ""}
              disabled={presenter}
              onBlur={(e) => e.target.value !== activity.notes && updatePlanActivity(activity.id, { notes: e.target.value || null }).then(onChanged)}
            />
          </Field>

          {!presenter && (
            <div className="flex justify-end">
              <DeleteButton label="eliminar actividad" onConfirm={() => deletePlanActivity(activity.id).then(onChanged)} />
            </div>
          )}
        </div>
      )}

      <div className="space-y-2 border-t border-border bg-black/[0.01] p-3">
        {items.map((it) => (
          <BudgetItemRowView
            key={it.id}
            item={it}
            presenter={presenter}
            onChanged={() => {
              load();
              onChanged();
            }}
          />
        ))}
        {items.length === 0 && <p className="text-xs text-muted">Aún no hay conceptos de costo.</p>}
        {!presenter && (
          <div className="flex items-center gap-1.5">
            <input className={inputCls} placeholder="Nuevo concepto (p. ej. Capacitación)" value={newConcept} onChange={(e) => setNewConcept(e.target.value)} />
            <button className={btnGhost} onClick={addConcept}>
              + Concepto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanActionCard({
  action,
  costCenters,
  presenter,
  onChanged,
}: {
  action: PlanActionRow;
  costCenters: CostCenterRow[];
  presenter: boolean;
  onChanged: () => void;
}) {
  const [activities, setActivities] = useState<PlanActivityRow[]>([]);
  const [totals, setTotals] = useState<BudgetByAction | undefined>();
  const [newActivityName, setNewActivityName] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  // Fechas del proyecto estratégico en estado local (controlado): a diferencia de los campos de
  // texto de abajo (defaultValue + onBlur), estas sí necesitan validarse entre sí al vuelo — la
  // fecha final no puede quedar antes que la de inicio (regla 8.3 de la especificación).
  const [startDraft, setStartDraft] = useState(action.start_date ?? "");
  const [endDraft, setEndDraft] = useState(action.end_date ?? "");
  const detailFieldsFilled = [
    action.objetivo_estrategico,
    action.meta_descripcion,
    action.kpi,
    action.frecuencia_medicion,
    action.tipo_medida,
    action.polaridad,
    action.linea_base,
    action.valor_meta,
    action.start_date,
    action.end_date,
  ].filter(Boolean).length;

  async function load() {
    const [acts, allTotals] = await Promise.all([fetchPlanActivities(action.id), fetchBudgetByAction()]);
    setActivities(acts);
    setTotals(allTotals.find((t) => t.action_id === action.id));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.id]);

  async function addActivity() {
    if (!newActivityName.trim()) return;
    await createPlanActivity({ action_id: action.id, name: newActivityName.trim() });
    setNewActivityName("");
    load();
    onChanged();
  }

  function setStartDate(value: string) {
    if (endDraft && value && endDraft < value) {
      alert("La fecha de inicio no puede quedar después de la fecha final. Ajusta primero la fecha final.");
      return;
    }
    setStartDraft(value);
    updatePlanAction(action.id, { start_date: value || null }).then(onChanged);
  }
  function setEndDate(value: string) {
    if (startDraft && value && value < startDraft) {
      alert("La fecha final no puede ser anterior a la fecha de inicio del proyecto.");
      return;
    }
    setEndDraft(value);
    updatePlanAction(action.id, { end_date: value || null }).then(onChanged);
  }

  return (
    <div className="rounded-xl border-2 border-border bg-card p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-foreground">{action.name}</p>
          {(action.scope || action.owner) && (
            <p className="truncate text-xs text-muted">
              {action.scope}
              {action.scope && action.owner ? " · " : ""}
              {action.owner && `Responsable: ${action.owner}`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-3">
          {totals && (
            <div className="text-right text-xs">
              <p className="font-semibold text-foreground">{formatMoney(totals.approved)} aprobado</p>
              <p className="text-muted">
                {formatMoney(totals.executed)} ejecutado · {formatPct(totals.pct_ejecucion)}
              </p>
            </div>
          )}
          {!presenter && <DeleteButton label="eliminar acción" onConfirm={() => deletePlanAction(action.id).then(onChanged)} />}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowDetail((v) => !v)}
        className="mb-3 flex w-full items-center justify-between gap-2 rounded-md border border-dashed border-border bg-black/[0.015] px-3 py-2 text-left text-xs font-semibold text-brand-dark hover:bg-brand/5"
      >
        <span>{showDetail ? "▾" : "▸"} Detalle estratégico (objetivo, KPI, meta, fechas…)</span>
        <span className="rounded-full bg-black/5 px-2 py-0.5 font-bold text-muted">{detailFieldsFilled}/10</span>
      </button>

      {showDetail && (
        <div className="mb-3 space-y-3 rounded-lg border border-dashed border-border bg-black/[0.015] p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Objetivo estratégico al que contribuye">
            <input
              className={inputCls}
              defaultValue={action.objetivo_estrategico ?? ""}
              disabled={presenter}
              onBlur={(e) =>
                e.target.value !== action.objetivo_estrategico &&
                updatePlanAction(action.id, { objetivo_estrategico: e.target.value || null }).then(onChanged)
              }
            />
          </Field>
          <Field label="Meta que se pretende alcanzar">
            <input
              className={inputCls}
              defaultValue={action.meta_descripcion ?? ""}
              disabled={presenter}
              onBlur={(e) =>
                e.target.value !== action.meta_descripcion && updatePlanAction(action.id, { meta_descripcion: e.target.value || null }).then(onChanged)
              }
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="KPI o indicador de medición">
            <input
              className={inputCls}
              defaultValue={action.kpi ?? ""}
              disabled={presenter}
              onBlur={(e) => e.target.value !== action.kpi && updatePlanAction(action.id, { kpi: e.target.value || null }).then(onChanged)}
            />
          </Field>
          <Field label="Frecuencia de medición">
            <select
              className={inputCls}
              defaultValue={action.frecuencia_medicion ?? ""}
              disabled={presenter}
              onChange={(e) => updatePlanAction(action.id, { frecuencia_medicion: (e.target.value || null) as PlanActionRow["frecuencia_medicion"] }).then(onChanged)}
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
              disabled={presenter}
              onChange={(e) => updatePlanAction(action.id, { tipo_medida: (e.target.value || null) as PlanActionRow["tipo_medida"] }).then(onChanged)}
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
              disabled={presenter}
              onChange={(e) => updatePlanAction(action.id, { polaridad: (e.target.value || null) as PlanActionRow["polaridad"] }).then(onChanged)}
            >
              <option value="">Sin definir…</option>
              <option value="ascendente">Ascendente (mayor es mejor)</option>
              <option value="descendente">Descendente (menor es mejor)</option>
            </select>
          </Field>
          <Field label="Línea base">
            <input
              className={inputCls}
              defaultValue={action.linea_base ?? ""}
              disabled={presenter}
              onBlur={(e) => e.target.value !== action.linea_base && updatePlanAction(action.id, { linea_base: e.target.value || null }).then(onChanged)}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Valor de la meta">
            <input
              className={inputCls}
              defaultValue={action.valor_meta ?? ""}
              disabled={presenter}
              onBlur={(e) => e.target.value !== action.valor_meta && updatePlanAction(action.id, { valor_meta: e.target.value || null }).then(onChanged)}
            />
          </Field>
          <Field label="Fecha inicio">
            <input type="date" className={inputCls} value={startDraft} disabled={presenter} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Fecha final">
            <input type="date" className={inputCls} value={endDraft} disabled={presenter} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        </div>
      )}

      <div className="space-y-2">
        {activities.map((a) => (
          <PlanActivityCard
            key={a.id}
            activity={a}
            costCenters={costCenters}
            presenter={presenter}
            onChanged={() => {
              load();
              onChanged();
            }}
          />
        ))}
      </div>
      {!presenter && (
        <div className="mt-2 flex items-center gap-1.5">
          <input className={inputCls} placeholder="+ Nueva actividad de esta acción" value={newActivityName} onChange={(e) => setNewActivityName(e.target.value)} />
          <button className={btnPrimary} onClick={addActivity}>
            Agregar
          </button>
        </div>
      )}
    </div>
  );
}

export default function PlanPresupuesto({ activity, aspirations, aspirationId, participant }: ActivityComponentProps) {
  const presenter = isPresenter(participant);
  // "General" = lo que ya existía (acciones/actividades/conceptos por aspiración). "Planeación de
  // acciones" es el cronograma tipo Gantt de la especificación — consolidado entre las 3
  // aspiraciones, no por pestaña de aspiración (así se acordó): se construye en una siguiente
  // iteración; por ahora queda el tab y un aviso de qué va a mostrar.
  const [mainTab, setMainTab] = useState<"general" | "gantt">("general");
  const [activeAspId, setActiveAspId] = useState<number | null>(() => aspirationId ?? aspirations[0]?.id ?? null);
  const [actions, setActions] = useState<PlanActionRow[]>([]);
  const [sourceProjects, setSourceProjects] = useState<SourceProject[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchCostCenters().then(setCostCenters).catch(console.error);
  }, []);

  // De qué actividad de taller vienen las Acciones a promover — por defecto, la primera de
  // config.inputsFrom (en S6, "De objetivo a proyecto estratégico").
  const actionsFrom = (activity.config.actionsFrom as number | undefined) ?? (activity.config.inputsFrom as number[] | undefined)?.[0];

  async function loadActions() {
    const all = await fetchPlanActions();
    setActions(activeAspId ? all.filter((a) => a.aspiration_id === activeAspId) : all);
    setLoaded(true);
  }

  async function loadSourceProjects() {
    if (!actionsFrom || activeAspId === null) {
      setSourceProjects([]);
      return;
    }
    const { data } = await supabase.from("submissions").select("content").eq("activity_id", actionsFrom).eq("aspiration_id", activeAspId).maybeSingle();
    const projects = ((data?.content as { projects?: SourceProject[] } | null)?.projects ?? []).filter((p) => p.nombre?.trim());
    setSourceProjects(projects);
  }

  useEffect(() => {
    loadActions();
    loadSourceProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAspId]);

  useEffect(() => {
    const channel = supabase
      .channel(`presupuesto-${activity.id}-${activeAspId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_actions" }, loadActions)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_activities" }, loadActions)
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_items" }, loadActions)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAspId]);

  const promotedSourceIds = new Set(actions.map((a) => a.source_project_id).filter(Boolean));
  const pendingProjects = sourceProjects.filter((p) => !promotedSourceIds.has(p.id));

  async function promoteProject(p: SourceProject) {
    if (!activeAspId) return;
    await createPlanAction({
      aspiration_id: activeAspId,
      name: p.nombre ?? "Acción sin nombre",
      scope: p.alcance ?? null,
      owner: p.responsable ?? null,
      source_activity_id: actionsFrom ?? null,
      source_project_id: p.id,
    });
    loadActions();
  }

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  return (
    <div className="space-y-3">
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PresenterHint />
          {Boolean(activity.config.boardRoute) && (
            <button
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 transition-colors"
              title="Ver el tablero financiero consolidado en una pestaña nueva"
              onClick={() => window.open(`/${activity.config.boardRoute}/${activity.id}`, "_blank", "noopener,noreferrer")}
            >
              ⛶ Ver tablero
            </button>
          )}
        </div>
      )}

      <div className="flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setMainTab("general")}
          className={`rounded-t-md px-3 py-2 text-sm font-semibold transition-colors ${
            mainTab === "general" ? "border-b-2 border-brand text-brand-dark" : "text-muted hover:text-foreground"
          }`}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => setMainTab("gantt")}
          className={`rounded-t-md px-3 py-2 text-sm font-semibold transition-colors ${
            mainTab === "gantt" ? "border-b-2 border-brand text-brand-dark" : "text-muted hover:text-foreground"
          }`}
        >
          Planeación de acciones
        </button>
      </div>

      {mainTab === "gantt" ? (
        <GanttPlaneacion aspirations={aspirations} />
      ) : (
        <>
      {aspirations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {aspirations.map((a) => {
            const cls = aspClasses(a.number);
            const active = activeAspId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setActiveAspId(a.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active ? `border-transparent ${cls.bg} text-dark` : `${cls.border} ${cls.text} bg-card hover:bg-black/5`
                }`}
              >
                Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
              </button>
            );
          })}
        </div>
      )}

      {pendingProjects.length > 0 && !presenter && (
        <div className="rounded-lg border border-dashed border-brand/40 bg-brand/5 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-dark">
            📋 Proyectos del taller sin costear todavía — toca para promoverlos a Acción
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingProjects.map((p) => (
              <button
                key={p.id}
                className="max-w-xs rounded-md border border-brand/40 bg-card px-3 py-2 text-left text-xs shadow-sm hover:scale-[1.02] transition-transform"
                onClick={() => promoteProject(p)}
              >
                <span className="block truncate font-semibold text-foreground">{p.nombre}</span>
                {p.responsable && <span className="mt-0.5 block text-[11px] text-muted">{p.responsable}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {actions.length === 0 ? (
        <p className="text-sm text-muted">
          {pendingProjects.length > 0
            ? "Aún no se ha promovido ningún proyecto a Acción."
            : "Aún no hay proyectos estratégicos del taller para costear en esta aspiración."}
        </p>
      ) : (
        <div className="space-y-3">
          {actions.map((a) => (
            <PlanActionCard key={a.id} action={a} costCenters={costCenters} presenter={presenter} onChanged={loadActions} />
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}
