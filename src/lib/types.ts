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
  | "radar_contexto";

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
