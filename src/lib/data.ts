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

export async function fetchActivityById(id: number): Promise<ActivityRow | null> {
  const { data, error } = await supabase.from("activities").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as ActivityRow | null;
}

export async function fetchSessionById(id: number): Promise<SessionRow | null> {
  const { data, error } = await supabase.from("sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as SessionRow | null;
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

export async function fetchSubmissionsByActivityIds(
  ids: number[]
): Promise<{ activity_id: number; aspiration_id: number | null; content: Record<string, unknown>; updated_at: string }[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("submissions")
    .select("activity_id, aspiration_id, content, updated_at")
    .in("activity_id", ids);
  if (error) throw error;
  return data as { activity_id: number; aspiration_id: number | null; content: Record<string, unknown>; updated_at: string }[];
}

export async function resetSessionActivitiesData(sessionId: number): Promise<void> {
  const { data: acts, error: actsError } = await supabase.from("activities").select("id").eq("session_id", sessionId);
  if (actsError) throw actsError;
  const ids = (acts ?? []).map((a) => a.id);
  if (ids.length === 0) return;
  const { error } = await supabase.from("submissions").delete().in("activity_id", ids);
  if (error) throw error;
}

export interface SessionMedia {
  session_id: number;
  activity_title: string;
  media: string[];
  external_link: string | null;
}

export async function fetchSessionMedia(): Promise<SessionMedia[]> {
  const { data: acts, error: actsError } = await supabase
    .from("activities")
    .select("id, session_id, title")
    .contains("config", { allowMedia: true });
  if (actsError) throw actsError;
  if (!acts || acts.length === 0) return [];

  const ids = acts.map((a) => a.id);
  const { data: subs, error: subsError } = await supabase.from("submissions").select("activity_id, content").in("activity_id", ids);
  if (subsError) throw subsError;

  const result: SessionMedia[] = [];
  for (const a of acts) {
    const sub = subs?.find((s) => s.activity_id === a.id);
    const content = (sub?.content ?? {}) as { media?: string[]; external_link?: string };
    if ((content.media?.length ?? 0) === 0 && !content.external_link) continue;
    result.push({
      session_id: a.session_id,
      activity_title: a.title,
      media: content.media ?? [],
      external_link: content.external_link || null,
    });
  }
  return result;
}
