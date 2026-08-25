import { supabase } from "./supabase";

export async function logActivity(params: {
  session_id?: number | null;
  aspiration_id?: number | null;
  participant_id?: string | null;
  activity_id?: number | null;
  event_type: string;
  summary: string;
}) {
  const { error } = await supabase.from("activity_feed").insert({
    session_id: params.session_id ?? null,
    aspiration_id: params.aspiration_id ?? null,
    participant_id: params.participant_id ?? null,
    activity_id: params.activity_id ?? null,
    event_type: params.event_type,
    summary: params.summary,
  });
  if (error) console.error("logActivity error", error);
}
