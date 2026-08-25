import { supabase } from "./supabase";
import type { ActivityRow, Aspiration, GoalRow, OutputRow, SessionRow, TrackingBoardRow } from "./types";

export async function fetchAspirations(): Promise<Aspiration[]> {
  const { data, error } = await supabase.from("aspirations").select("*").order("number");
  if (error) throw error;
  return data as Aspiration[];
}

export async function fetchSessions(): Promise<SessionRow[]> {
  const { data, error } = await supabase.from("sessions").select("*").order("order_index");
  if (error) throw error;
  return data as SessionRow[];
}

export async function fetchSessionByCode(code: string): Promise<SessionRow | null> {
  const { data, error } = await supabase.from("sessions").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  return data as SessionRow | null;
}

export async function fetchActivities(sessionId: number): Promise<ActivityRow[]> {
  const { data, error } = await supabase.from("activities").select("*").eq("session_id", sessionId).order("order_index");
  if (error) throw error;
  return data as ActivityRow[];
}

export async function fetchOutputs(sessionId?: number): Promise<OutputRow[]> {
  let q = supabase.from("outputs").select("*").order("order_index");
  if (sessionId) q = q.eq("session_id", sessionId);
  const { data, error } = await q;
  if (error) throw error;
  return data as OutputRow[];
}

export async function fetchGoals(): Promise<GoalRow[]> {
  const { data, error } = await supabase.from("goals").select("*").order("created_at");
  if (error) throw error;
  return data as GoalRow[];
}

export async function fetchTrackingBoard(): Promise<TrackingBoardRow[]> {
  const { data, error } = await supabase.from("tracking_board").select("*");
  if (error) throw error;
  return data as TrackingBoardRow[];
}
