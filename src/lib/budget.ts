import { supabase } from "./supabase";
import type {
  BudgetByAction,
  BudgetByActivity,
  BudgetByAspiration,
  BudgetByMonth,
  BudgetByOwner,
  BudgetBySource,
  BudgetByYear,
  BudgetExecutionRow,
  BudgetItemRow,
  BudgetItemTotals,
  BudgetTotal,
  BudgetVsProgress,
  PlanActionRow,
  PlanActivityRow,
} from "./types";

// Moneda: COP sin decimales (igual que el resto de la planeación — presupuestos en pesos
// colombianos, montos grandes donde los centavos no aportan información).
export function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value || 0);
}

export function parseMoney(input: string): number {
  const digits = input.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export function formatPct(value: number): string {
  return `${(value ?? 0).toFixed(1)}%`;
}

// Umbral de desviación significativa entre avance físico y ejecución financiera — ver
// v_budget_vs_progress en la migración 0084.
export const DESVIACION_SIGNIFICATIVA_PTS = 25;

export async function fetchPlanActions(): Promise<PlanActionRow[]> {
  const { data, error } = await supabase.from("plan_actions").select("*").order("created_at");
  if (error) throw error;
  return data as PlanActionRow[];
}

export async function fetchPlanActionsByAspiration(aspirationId: number): Promise<PlanActionRow[]> {
  const { data, error } = await supabase.from("plan_actions").select("*").eq("aspiration_id", aspirationId).order("created_at");
  if (error) throw error;
  return data as PlanActionRow[];
}

export async function createPlanAction(input: {
  aspiration_id: number;
  name: string;
  scope?: string | null;
  owner?: string | null;
  source_activity_id?: number | null;
  source_project_id?: string | null;
}): Promise<PlanActionRow> {
  const { data, error } = await supabase.from("plan_actions").insert(input).select().single();
  if (error) throw error;
  return data as PlanActionRow;
}

export async function fetchPlanActivities(actionId?: number): Promise<PlanActivityRow[]> {
  let query = supabase.from("plan_activities").select("*").order("created_at");
  if (actionId !== undefined) query = query.eq("action_id", actionId);
  const { data, error } = await query;
  if (error) throw error;
  return data as PlanActivityRow[];
}

export async function createPlanActivity(input: {
  action_id: number;
  name: string;
  owner?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  cost_center?: string | null;
  funding_source?: string | null;
  notes?: string | null;
}): Promise<PlanActivityRow> {
  const { data, error } = await supabase.from("plan_activities").insert(input).select().single();
  if (error) throw error;
  return data as PlanActivityRow;
}

export async function updatePlanActivity(id: number, patch: Partial<PlanActivityRow>): Promise<void> {
  const { error } = await supabase.from("plan_activities").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePlanActivity(id: number): Promise<void> {
  const { error } = await supabase.from("plan_activities").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchBudgetItems(planActivityId?: number): Promise<BudgetItemRow[]> {
  let query = supabase.from("budget_items").select("*").order("year");
  if (planActivityId !== undefined) query = query.eq("plan_activity_id", planActivityId);
  const { data, error } = await query;
  if (error) throw error;
  return data as BudgetItemRow[];
}

export async function createBudgetItem(input: {
  plan_activity_id: number;
  concept: string;
  year: number;
  estimated?: number;
  approved?: number;
  funding_source?: string | null;
  cost_center?: string | null;
  notes?: string | null;
}): Promise<BudgetItemRow> {
  const { data, error } = await supabase.from("budget_items").insert(input).select().single();
  if (error) throw error;
  return data as BudgetItemRow;
}

export async function updateBudgetItem(id: number, patch: Partial<BudgetItemRow>): Promise<void> {
  const { error } = await supabase.from("budget_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteBudgetItem(id: number): Promise<void> {
  const { error } = await supabase.from("budget_items").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchBudgetExecutions(budgetItemId: number): Promise<BudgetExecutionRow[]> {
  const { data, error } = await supabase.from("budget_executions").select("*").eq("budget_item_id", budgetItemId).order("month");
  if (error) throw error;
  return data as BudgetExecutionRow[];
}

// La ejecución es acumulativa por mes: registrar un nuevo monto para un mes que ya tenía uno lo
// reemplaza (upsert sobre la restricción unique(budget_item_id, month)), nunca lo suma por
// error si alguien reabre el mismo mes para corregirlo.
export async function upsertBudgetExecution(input: {
  budget_item_id: number;
  month: string;
  amount: number;
  registered_by?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("budget_executions").upsert(input, { onConflict: "budget_item_id,month" });
  if (error) throw error;
}

export async function deleteBudgetExecution(id: number): Promise<void> {
  const { error } = await supabase.from("budget_executions").delete().eq("id", id);
  if (error) throw error;
}

// --- Vistas de consolidación: siempre de solo lectura ---

export async function fetchBudgetItemTotals(planActivityId?: number): Promise<BudgetItemTotals[]> {
  let query = supabase.from("v_budget_item_totals").select("*");
  if (planActivityId !== undefined) query = query.eq("plan_activity_id", planActivityId);
  const { data, error } = await query;
  if (error) throw error;
  return data as BudgetItemTotals[];
}

export async function fetchBudgetByActivity(): Promise<BudgetByActivity[]> {
  const { data, error } = await supabase.from("v_budget_by_activity").select("*");
  if (error) throw error;
  return data as BudgetByActivity[];
}

export async function fetchBudgetByAction(): Promise<BudgetByAction[]> {
  const { data, error } = await supabase.from("v_budget_by_action").select("*");
  if (error) throw error;
  return data as BudgetByAction[];
}

export async function fetchBudgetByAspiration(): Promise<BudgetByAspiration[]> {
  const { data, error } = await supabase.from("v_budget_by_aspiration").select("*").order("number");
  if (error) throw error;
  return data as BudgetByAspiration[];
}

export async function fetchBudgetTotal(): Promise<BudgetTotal> {
  const { data, error } = await supabase.from("v_budget_total").select("*").single();
  if (error) throw error;
  return data as BudgetTotal;
}

export async function fetchBudgetByYear(): Promise<BudgetByYear[]> {
  const { data, error } = await supabase.from("v_budget_by_year").select("*").order("year");
  if (error) throw error;
  return data as BudgetByYear[];
}

export async function fetchBudgetByMonth(): Promise<BudgetByMonth[]> {
  const { data, error } = await supabase.from("v_budget_by_month").select("*").order("month");
  if (error) throw error;
  return data as BudgetByMonth[];
}

export async function fetchBudgetByOwner(): Promise<BudgetByOwner[]> {
  const { data, error } = await supabase.from("v_budget_by_owner").select("*");
  if (error) throw error;
  return data as BudgetByOwner[];
}

export async function fetchBudgetBySource(): Promise<BudgetBySource[]> {
  const { data, error } = await supabase.from("v_budget_by_source").select("*");
  if (error) throw error;
  return data as BudgetBySource[];
}

export async function fetchBudgetVsProgress(): Promise<BudgetVsProgress[]> {
  const { data, error } = await supabase.from("v_budget_vs_progress").select("*");
  if (error) throw error;
  return data as BudgetVsProgress[];
}
