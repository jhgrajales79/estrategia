"use client";

import { useSubmission, effectiveAspirationId, fetchLatestContent } from "@/lib/useSubmission";
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
  const emptyContent: Content = { projects: [] };
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    emptyContent
  );

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  // Varios equipos editan proyectos de la misma submission casi al mismo tiempo — releer la
  // fila más reciente antes de aplicar cada cambio evita que un guardado pise en silencio el de
  // otra persona (mismo bug que se corrigió en VotacionFichas.tsx: content desactualizado +
  // guardado optimista = pérdida de datos cuando dos guardados se cruzan).
  async function mutateContent(fn: (latest: Content) => Content, opts?: { eventType?: string; summary?: string }) {
    const latest = await fetchLatestContent<Content>(activity.id, submissionAspId, emptyContent);
    await save(fn(latest), opts);
  }

  function addProject() {
    const project: Project = { id: uid() };
    fields.forEach((f) => (project[f.key] = ""));
    mutateContent((latest) => ({ projects: [...latest.projects, project] }), {
      eventType: "proyecto",
      summary: `${participant.name} agregó un proyecto en "${activity.title}"`,
    });
  }
  function setField(id: string, key: string, value: string) {
    mutateContent((latest) => ({ projects: latest.projects.map((p) => (p.id === id ? { ...p, [key]: value } : p)) }));
  }
  function removeProject(id: string) {
    mutateContent((latest) => ({ projects: latest.projects.filter((p) => p.id !== id) }));
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
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PresenterHint />
          {Boolean(activity.config.boardRoute) && (
            <button
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 transition-colors"
              title="Ver el tablero de proyectos en una pestaña nueva"
              onClick={() => window.open(`/${activity.config.boardRoute}/${activity.id}`, "_blank", "noopener,noreferrer")}
            >
              ⛶ Ver tablero
            </button>
          )}
        </div>
      )}
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
