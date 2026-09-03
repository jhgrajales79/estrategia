import { supabase } from "./supabase";
import { fetchSubmissionsByActivityIds } from "./data";

export interface BackupRow {
  activity_id: number;
  activity_title?: string;
  aspiration_id: number | null;
  content: Record<string, unknown>;
  updated_at?: string;
}

export interface BackupFile {
  exported_at: string;
  scope: "actividad" | "sistema";
  rows: BackupRow[];
}

export async function exportActivityBackup(activity: { id: number; title: string }): Promise<BackupFile> {
  const subs = await fetchSubmissionsByActivityIds([activity.id]);
  return {
    exported_at: new Date().toISOString(),
    scope: "actividad",
    rows: subs.map((s) => ({
      activity_id: s.activity_id,
      activity_title: activity.title,
      aspiration_id: s.aspiration_id,
      content: s.content,
      updated_at: s.updated_at,
    })),
  };
}

export async function exportAllBackup(): Promise<BackupFile> {
  const { data: activities, error: actError } = await supabase.from("activities").select("id, title");
  if (actError) throw actError;
  const { data: subs, error } = await supabase.from("submissions").select("activity_id, aspiration_id, content, updated_at");
  if (error) throw error;
  const titleById = new Map((activities ?? []).map((a) => [a.id as number, a.title as string]));
  return {
    exported_at: new Date().toISOString(),
    scope: "sistema",
    rows: (subs ?? []).map((s) => ({
      activity_id: s.activity_id,
      activity_title: titleById.get(s.activity_id),
      aspiration_id: s.aspiration_id,
      content: s.content as Record<string, unknown>,
      updated_at: s.updated_at,
    })),
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function slugifyFilename(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

export function parseBackupFile(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }
  const obj = data as Partial<BackupFile> | null;
  if (!obj || !Array.isArray(obj.rows)) {
    throw new Error("Archivo inválido: falta la lista 'rows'.");
  }
  for (const r of obj.rows) {
    if (typeof r.activity_id !== "number" || typeof r.content !== "object" || r.content === null) {
      throw new Error("Archivo inválido: cada fila necesita 'activity_id' y 'content'.");
    }
  }
  return { exported_at: obj.exported_at ?? new Date().toISOString(), scope: obj.scope ?? "sistema", rows: obj.rows as BackupRow[] };
}

// No se usa upsert con onConflict: la tabla tiene dos índices únicos parciales
// (aspiration_id nulo / no nulo) que el cliente de Supabase no puede expresar en
// un solo ON CONFLICT, así que se busca la fila existente y se actualiza o inserta.
export async function restoreRows(rows: BackupRow[]): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      let query = supabase.from("submissions").select("id").eq("activity_id", r.activity_id);
      query = r.aspiration_id === null || r.aspiration_id === undefined ? query.is("aspiration_id", null) : query.eq("aspiration_id", r.aspiration_id);
      const { data: existing } = await query.maybeSingle();
      const payload = {
        activity_id: r.activity_id,
        aspiration_id: r.aspiration_id ?? null,
        content: r.content,
        updated_at: new Date().toISOString(),
      };
      if (existing) {
        const { error } = await supabase.from("submissions").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("submissions").insert(payload);
        if (error) throw error;
      }
      ok++;
    } catch (err) {
      console.error(err);
      failed++;
    }
  }
  return { ok, failed };
}
