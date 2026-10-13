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
  updatePlanActivity,
} from "@/lib/budget";
import { fetchCostCenters } from "@/lib/data";
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <input
          className={inputCls + " sm:col-span-2"}
          placeholder="Concepto (p. ej. Licenciamiento)"
          defaultValue={item.concept}
          disabled={presenter}
          onBlur={(e) => e.target.value !== item.concept && updateBudgetItem(item.id, { concept: e.target.value }).then(onChanged)}
        />
        <input
          type="number"
          className={inputCls}
          placeholder="Año"
          defaultValue={item.year}
          disabled={presenter}
          onBlur={(e) => Number(e.target.value) !== item.year && updateBudgetItem(item.id, { year: Number(e.target.value) }).then(onChanged)}
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
function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-wide text-brand-dark">{children}</p>;
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

  const totalApproved = items.reduce((a, i) => a + i.approved, 0);
  const totalExecuted = totals.reduce((a, t) => a + t.executed, 0);
  const pctEjec = totalApproved > 0 ? (totalExecuted / totalApproved) * 100 : 0;

  return (
    <div className="overflow-hidden rounded-xl border-2 border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-black/[0.02] px-4 py-3">
        <h4 className="text-sm font-bold uppercase tracking-wide text-foreground">📋 Detalle de la actividad</h4>
        <div className="rounded-md border border-brand/30 bg-brand/5 px-3 py-1.5 text-right text-xs leading-tight">
          <p className="font-bold text-foreground">Aprobado: {formatMoney(totalApproved)}</p>
          <p className="text-muted">
            Ejecutado: {formatMoney(totalExecuted)} ({formatPct(pctEjec)})
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <SectionLabel>Sección 1 · Identificación de la actividad</SectionLabel>

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

        <SectionLabel>Sección 2 · Conceptos de costo</SectionLabel>
        <div className="space-y-2">
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
          {!presenter && (
            <div className="flex items-center gap-1.5">
              <input className={inputCls} placeholder="Nuevo concepto (p. ej. Capacitación)" value={newConcept} onChange={(e) => setNewConcept(e.target.value)} />
              <button className={btnGhost} onClick={addConcept}>
                + Añadir nuevo concepto
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
          <span className="text-sm font-semibold text-foreground">
            Resumen total: {formatMoney(totalApproved)} aprobado · {formatMoney(totalExecuted)} ejecutado ({formatPct(pctEjec)})
          </span>
          {!presenter && <DeleteButton onConfirm={() => deletePlanActivity(activity.id).then(onChanged)} />}
        </div>
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

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-foreground">{action.name}</p>
          {action.scope && <p className="text-xs text-muted">{action.scope}</p>}
          {action.owner && <p className="text-xs text-muted">Responsable: {action.owner}</p>}
        </div>
        {totals && (
          <div className="text-right text-xs">
            <p className="font-semibold text-foreground">{formatMoney(totals.approved)} aprobado</p>
            <p className="text-muted">
              {formatMoney(totals.executed)} ejecutado · {formatPct(totals.pct_ejecucion)}
            </p>
          </div>
        )}
      </div>
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
    </div>
  );
}
