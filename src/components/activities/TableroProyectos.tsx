"use client";

import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { supabase } from "@/lib/supabase";
import { isPresenter } from "@/lib/presenter";
import { ActivityComponentProps, inputCls, textareaCls, btnPrimary, btnDanger, SaveIndicator, PresenterHint, uid } from "./shared";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea";
}
interface Project extends Record<string, string> {
  id: string;
}
interface Content extends Record<string, unknown> {
  projects: Project[];
}

export default function TableroProyectos({ activity, session, aspirationId, participant }: ActivityComponentProps) {
  const fields = (activity.config.fields as FieldDef[]) ?? [];
  const updatesTrackingBoard = Boolean(activity.config.updatesTrackingBoard);
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { projects: [] }
  );

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  function addProject() {
    const project: Project = { id: uid() };
    fields.forEach((f) => (project[f.key] = ""));
    save({ projects: [...content.projects, project] }, { eventType: "proyecto", summary: `${participant.name} agregó un proyecto en "${activity.title}"` });
  }
  function setField(id: string, key: string, value: string) {
    save({ projects: content.projects.map((p) => (p.id === id ? { ...p, [key]: value } : p)) });
  }
  function removeProject(id: string) {
    save({ projects: content.projects.filter((p) => p.id !== id) });
  }

  async function pushToTrackingBoard() {
    const asp = aspirationId ?? participant.aspiration_id;
    if (!asp) return;
    await supabase
      .from("tracking_board")
      .update({ note: `Plan de acción actualizado por ${participant.name}`, updated_at: new Date().toISOString() })
      .eq("aspiration_id", asp);
  }

  return (
    <div className="space-y-3">
      {presenter && <PresenterHint />}
      {content.projects.map((p) => (
        <div key={p.id} className="rounded-lg border border-border bg-card p-3">
          {!presenter && (
            <div className="mb-2 flex justify-end">
              <button className={btnDanger} onClick={() => removeProject(p.id)}>
                eliminar
              </button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                <label className="mb-1 block text-xs font-medium text-muted">{f.label}</label>
                {presenter ? (
                  <p className="rounded-md bg-black/[0.03] px-3 py-1.5 text-sm text-foreground min-h-8">{p[f.key] || "—"}</p>
                ) : f.type === "textarea" ? (
                  <textarea className={textareaCls} value={p[f.key] ?? ""} onChange={(e) => setField(p.id, f.key, e.target.value)} />
                ) : (
                  <input className={inputCls} value={p[f.key] ?? ""} onChange={(e) => setField(p.id, f.key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {!presenter && (
        <div className="flex gap-2">
          <button className={btnPrimary} onClick={addProject}>
            + Proyecto
          </button>
          {updatesTrackingBoard && (
            <button className={btnPrimary} onClick={pushToTrackingBoard}>
              Marcar tablero actualizado
            </button>
          )}
        </div>
      )}
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
