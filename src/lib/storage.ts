import { supabase } from "./supabase";

const BUCKET = "activity-media";

export async function uploadMedia(file: File, scope: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${scope}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
