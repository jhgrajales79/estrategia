export type AspirationColor = "naranja" | "azul" | "verde";

export interface Aspiration {
  id: number;
  number: number;
  name: string;
  color: AspirationColor;
  hex: string;
}

export type ParticipantRole = "facilitador" | "participante";

export interface Participant {
  id: string;
  name: string;
  role: ParticipantRole;
  aspiration_id: number | null;
  created_at: string;
  last_seen_at: string;
}

export type SessionStatus = "pendiente" | "en_curso" | "completada";

export interface SessionRow {
  id: number;
  code: string;
  name: string;
  week_label: string | null;
  duration_label: string | null;
  methodology: string | null;
  objective: string | null;
  aspiration_link: string | null;
  order_index: number;
  status: SessionStatus;
  is_enabled: boolean;
  audio_url: string | null;
}

export type ActivityType =
  | "notas"
  | "matriz_ponderada"
  | "matriz_cuadrantes"
  | "rueda_evaluacion"
  | "votacion_fichas"
  | "tarjeta_estructurada"
  | "mapa_estrategico"
  | "tablero_proyectos"
  | "ficha_kpi"
  | "checklist_salidas"
  | "radar_contexto"
  | "tejido_conexiones"
  | "notas_matriz"
  | "crazy8"
  | "compromiso_personal"
  | "plan_presupuesto";

export interface ActivityRow {
  id: number;
  session_id: number;
  title: string;
  time_minutes: number | null;
  description: string | null;
  materials: string | null;
  activity_type: ActivityType;
  config: Record<string, unknown>;
  order_index: number;
  is_enabled: boolean;
  timer_status: "idle" | "running" | "paused" | "finished";
  timer_end_at: string | null;
  timer_remaining_seconds: number | null;
}

export type SubmissionStatus = "borrador" | "enviado";

export interface SubmissionRow {
  id: string;
  activity_id: number;
  aspiration_id: number | null;
  content: Record<string, unknown>;
  updated_by: string | null;
  updated_at: string;
  status: SubmissionStatus;
}

export interface OutputRow {
  id: number;
  session_id: number;
  aspiration_id: number | null;
  description: string;
  is_done: boolean;
  linked_submission_id: string | null;
  order_index: number;
}

export interface GoalRow {
  id: number;
  aspiration_id: number;
  description: string;
  is_new: boolean;
  owner_participant_id: string | null;
  target_date: string | null;
  created_at: string;
}

export interface TrackingBoardRow {
  id: number;
  aspiration_id: number;
  planeacion_pct: number;
  ejecucion_pct: number;
  note: string | null;
  updated_at: string;
}

export interface ActivityFeedRow {
  id: number;
  session_id: number | null;
  aspiration_id: number | null;
  participant_id: string | null;
  activity_id: number | null;
  event_type: string;
  summary: string;
  created_at: string;
}

// --- Módulo de Presupuesto Financiero de la Planeación ---
// Jerarquía: Aspiración (existente) → Acción (plan_actions, nace en el taller S6
// "De objetivo a proyecto estratégico") → Actividad del plan (plan_activities — distinta de
// `activities`, que son los ejercicios de taller) → Concepto de costo (budget_items, por año)
// → Ejecución real (budget_executions, mes a mes).

export type PlanActionStatus = "activa" | "pausada" | "cerrada";

export interface PlanActionRow {
  id: number;
  aspiration_id: number;
  name: string;
  scope: string | null;
  owner: string | null;
  source_activity_id: number | null;
  source_project_id: string | null;
  status: PlanActionStatus;
  created_at: string;
}

export type PlanActivityStatus = "pendiente" | "en_curso" | "completada" | "cancelada";

export interface PlanActivityRow {
  id: number;
  action_id: number;
  name: string;
  owner: string | null;
  start_date: string | null;
  end_date: string | null;
  progress_pct: number;
  status: PlanActivityStatus;
  cost_center: string | null;
  funding_source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetItemRow {
  id: number;
  plan_activity_id: number;
  concept: string;
  year: number;
  estimated: number;
  approved: number;
  funding_source: string | null;
  cost_center: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetExecutionRow {
  id: number;
  budget_item_id: number;
  month: string; // fecha del día 1 del mes, p. ej. "2027-03-01"
  amount: number;
  registered_by: string | null;
  registered_at: string;
  notes: string | null;
}

export interface BudgetAuditRow {
  id: number;
  entity_type: "budget_item" | "budget_execution" | "plan_activity" | "plan_action";
  entity_id: string;
  plan_activity_id: number | null;
  participant_id: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
}

// --- Vistas de consolidación (solo lectura, nunca se escriben) ---

export interface BudgetItemTotals {
  budget_item_id: number;
  plan_activity_id: number;
  concept: string;
  year: number;
  estimated: number;
  approved: number;
  executed: number;
  saldo: number;
  pct_ejecucion: number;
  funding_source: string | null;
  cost_center: string | null;
}

export interface BudgetByActivity {
  plan_activity_id: number;
  action_id: number;
  name: string;
  owner: string | null;
  progress_pct: number;
  status: PlanActivityStatus;
  start_date: string | null;
  end_date: string | null;
  cost_center: string | null;
  funding_source: string | null;
  estimated: number;
  approved: number;
  executed: number;
  saldo: number;
  pct_ejecucion: number;
}

export interface BudgetByAction {
  action_id: number;
  aspiration_id: number;
  name: string;
  owner: string | null;
  status: PlanActionStatus;
  estimated: number;
  approved: number;
  executed: number;
  saldo: number;
  pct_ejecucion: number;
  num_actividades: number;
}

export interface BudgetByAspiration {
  aspiration_id: number;
  number: number;
  name: string;
  estimated: number;
  approved: number;
  executed: number;
  saldo: number;
  pct_ejecucion: number;
  num_acciones: number;
}

export interface BudgetTotal {
  estimated: number;
  approved: number;
  executed: number;
  saldo: number;
  pct_ejecucion: number;
  num_actividades: number;
  num_actividades_con_presupuesto: number;
}

export interface BudgetByYear {
  year: number;
  estimated: number;
  approved: number;
  executed: number;
}

export interface BudgetByMonth {
  month: string;
  year: number;
  executed: number;
}

export interface BudgetByOwner {
  owner: string;
  estimated: number;
  approved: number;
  executed: number;
}

export interface BudgetBySource {
  funding_source: string;
  estimated: number;
  approved: number;
  executed: number;
}

export interface BudgetVsProgress {
  plan_activity_id: number;
  name: string;
  owner: string | null;
  avance_fisico_pct: number;
  ejecucion_presupuestal_pct: number;
  brecha: number;
  desviacion_significativa: boolean;
}
