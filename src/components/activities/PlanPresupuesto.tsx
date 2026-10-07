"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isPresenter } from "@/lib/presenter";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import {
  createBudgetItem,
  createPlanAction,
  createPlanActivity,
  deleteBudgetItem,
  deletePlanActivity,
  fetchBudgetExecutions,
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
  upsertBudgetExecution,
} from "@/lib/budget";
import type { BudgetByAction, BudgetExecutionRow, BudgetItemRow, BudgetItemTotals, PlanActionRow, PlanActivityRow } from "@/lib/types";
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
  totals,
  presenter,
  onChanged,
}: {
  item: BudgetItemRow;
  totals: BudgetItemTotals | undefined;
  presenter: boolean;
  onChanged: () => void;
}) {
  const [showExec, setShowExec] = useState(false);
  const [executions, setExecutions] = useState<BudgetExecutionRow[]>([]);
  const [month, setMonth] = useState("");
  const [amount, setAmount] = useState("");

  async function loadExecutions() {
    setExecutions(await fetchBudgetExecutions(item.id));
  }
  useEffect(() => {
    if (showExec) loadExecutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExec]);

  async function addExecution() {
    if (!month || !amount) return;
    try {
      await upsertBudgetExecution({ budget_item_id: item.id, month: `${month}-01`, amount: parseMoney(amount) });
      setMonth("");
      setAmount("");
      await loadExecutions();
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo registrar la ejecución (¿supera lo aprobado?)");
    }
  }

  const executed = totals?.executed ?? 0;
  const saldo = totals?.saldo ?? item.approved;
  const pct = totals?.pct_ejecucion ?? 0;

  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
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
          <>
            <MoneyField value={item.estimated} placeholder="Estimado" onCommit={(n) => updateBudgetItem(item.id, { estimated: n }).then(onChanged)} />
            <MoneyField value={item.approved} placeholder="Aprobado" onCommit={(n) => updateBudgetItem(item.id, { approved: n }).then(onChanged)} />
          </>
        ) : (
          <>
            <p className="rounded-md bg-black/[0.03] px-3 py-1.5 text-right text-sm text-foreground">{formatMoney(item.estimated)}</p>
            <p className="rounded-md bg-black/[0.03] px-3 py-1.5 text-right text-sm text-foreground">{formatMoney(item.approved)}</p>
          </>
        )}
        <div className="flex items-center justify-end gap-1">
          {!presenter && <DeleteButton onConfirm={() => deleteBudgetItem(item.id).then(onChanged)} />}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted">
          Ejecutado: <span className="font-semibold text-foreground">{formatMoney(executed)}</span>
        </span>
        <span className="text-muted">
          Saldo: <span className={`font-semibold ${saldo < 0 ? "text-red-600" : "text-foreground"}`}>{formatMoney(saldo)}</span>
        </span>
        <span className="text-muted">
          Ejecución: <span className="font-semibold text-brand-dark">{formatPct(pct)}</span>
        </span>
        <button className="text-brand-dark hover:underline" onClick={() => setShowExec((v) => !v)}>
          {showExec ? "ocultar meses ▴" : "ver ejecución mensual ▾"}
        </button>
      </div>
      {showExec && (
        <div className="mt-2 space-y-1.5 border-t border-border pt-2">
          {executions.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-xs">
              <span className="text-muted">{e.month.slice(0, 7)}</span>
              <span className="font-medium text-foreground">{formatMoney(e.amount)}</span>
            </div>
          ))}
          {executions.length === 0 && <p className="text-xs text-muted">Sin ejecución registrada todavía.</p>}
          {!presenter && (
            <div className="flex items-center gap-1.5 pt-1">
              <input type="month" className={inputCls + " w-auto"} value={month} onChange={(e) => setMonth(e.target.value)} />
              <input
                className={inputCls + " w-auto"}
                placeholder="Monto ejecutado"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              />
              <button className={btnGhost} onClick={addExecution}>
                Registrar mes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlanActivityCard({
  activity,
  presenter,
  onChanged,
}: {
  activity: PlanActivityRow;
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
    <div className="rounded-lg border border-border bg-bg/50 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          className={inputCls}
          placeholder="Nombre de la actividad"
          defaultValue={activity.name}
          disabled={presenter}
          onBlur={(e) => e.target.value !== activity.name && updatePlanActivity(activity.id, { name: e.target.value }).then(onChanged)}
        />
        <input
          className={inputCls}
          placeholder="Responsable"
          defaultValue={activity.owner ?? ""}
          disabled={presenter}
          onBlur={(e) => e.target.value !== activity.owner && updatePlanActivity(activity.id, { owner: e.target.value || null }).then(onChanged)}
        />
        <div className="flex items-center gap-2">
          <input
            type="date"
            className={inputCls}
            defaultValue={activity.start_date ?? ""}
            disabled={presenter}
            onBlur={(e) => e.target.value !== activity.start_date && updatePlanActivity(activity.id, { start_date: e.target.value || null }).then(onChanged)}
          />
          <input
            type="date"
            className={inputCls}
            defaultValue={activity.end_date ?? ""}
            disabled={presenter}
            onBlur={(e) => e.target.value !== activity.end_date && updatePlanActivity(activity.id, { end_date: e.target.value || null }).then(onChanged)}
          />
        </div>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        <select
          className={inputCls}
          defaultValue={activity.status}
          disabled={presenter}
          onChange={(e) => updatePlanActivity(activity.id, { status: e.target.value as PlanActivityRow["status"] }).then(onChanged)}
        >
          <option value="pendiente">Pendiente</option>
          <option value="en_curso">En curso</option>
          <option value="completada">Completada</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={100}
            className={inputCls}
            placeholder="% avance"
            defaultValue={activity.progress_pct}
            disabled={presenter}
            onBlur={(e) => Number(e.target.value) !== activity.progress_pct && updatePlanActivity(activity.id, { progress_pct: Number(e.target.value) }).then(onChanged)}
          />
          <span className="text-xs text-muted">%</span>
        </div>
        <input
          className={inputCls}
          placeholder="Fuente de financiación"
          defaultValue={activity.funding_source ?? ""}
          disabled={presenter}
          onBlur={(e) => e.target.value !== activity.funding_source && updatePlanActivity(activity.id, { funding_source: e.target.value || null }).then(onChanged)}
        />
        <input
          className={inputCls}
          placeholder="Centro de costo"
          defaultValue={activity.cost_center ?? ""}
          disabled={presenter}
          onBlur={(e) => e.target.value !== activity.cost_center && updatePlanActivity(activity.id, { cost_center: e.target.value || null }).then(onChanged)}
        />
      </div>
      <textarea
        className={inputCls + " mt-2 min-h-14 resize-y"}
        placeholder="Observaciones financieras"
        defaultValue={activity.notes ?? ""}
        disabled={presenter}
        onBlur={(e) => e.target.value !== activity.notes && updatePlanActivity(activity.id, { notes: e.target.value || null }).then(onChanged)}
      />

      <div className="mt-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Conceptos de costo</p>
        {items.map((it) => (
          <BudgetItemRowView
            key={it.id}
            item={it}
            totals={totals.find((t) => t.budget_item_id === it.id)}
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
              + Concepto
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <span className="text-sm font-semibold text-foreground">
          Total actividad: {formatMoney(totalApproved)} · ejecutado {formatMoney(totalExecuted)} ({formatPct(pctEjec)})
        </span>
        {!presenter && <DeleteButton onConfirm={() => deletePlanActivity(activity.id).then(onChanged)} />}
      </div>
    </div>
  );
}

function PlanActionCard({
  action,
  presenter,
  onChanged,
}: {
  action: PlanActionRow;
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
  const [loaded, setLoaded] = useState(false);

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
            <PlanActionCard key={a.id} action={a} presenter={presenter} onChanged={loadActions} />
          ))}
        </div>
      )}
    </div>
  );
}
