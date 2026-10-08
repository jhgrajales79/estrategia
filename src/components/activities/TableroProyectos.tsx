"use client";

import { useEffect, useState } from "react";
import { useSubmission, fetchLatestContent } from "@/lib/useSubmission";
import { supabase } from "@/lib/supabase";
import { fetchGoals } from "@/lib/data";
import { isPresenter } from "@/lib/presenter";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
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

// Meta u objetivo al que un proyecto estratégico responde — se usa para que el organigrama de
// "Estrategia general" (/estrategia) pueda anidar el plan de acción como hijo de la meta, en vez
// de mostrarlo como una rama aparte. Combina las metas vigentes/nuevas de `goals` con las
// candidatas que ya ganaron fichas en la Subasta (actividad 18), igual que hace /metas y
// /estrategia — el id lleva un prefijo ("goal:"/"cand:") porque ambas fuentes usan ids con
// formato distinto (numérico vs. string corto).
interface MetaOption {
  id: string;
  label: string;
}
interface MetaCandidate {
  id: string;
  text: string;
  aspiration_id?: number | null;
}
interface MetaVote {
  candidate_id: string;
  points: number;
}
const METAS_SUBASTA_ACTIVITY_ID = 18;

export default function TableroProyectos({ activity, session, aspirationId, aspirations, participant }: ActivityComponentProps) {
  const fields = (activity.config.fields as FieldDef[]) ?? [];
  const updatesTrackingBoard = Boolean(activity.config.updatesTrackingBoard);
  const perAspiration = Boolean(activity.config.perAspiration);
  const presenter = isPresenter(participant);
  // No hay (todavía) una asignación real de aspiración por participante — todos se registran con
  // aspiration_id null — así que, igual que en MatrizPonderada/TarjetaEstructurada/DofaCruzado,
  // la separación real depende de una pestaña local que cada equipo elige, no de la identidad.
  const [activeAspId, setActiveAspId] = useState<number | null>(() => aspirations[0]?.id ?? null);
  useEffect(() => {
    if (activeAspId === null && aspirations.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveAspId(aspirations[0].id);
    }
  }, [aspirations, activeAspId]);
  const submissionAspId = perAspiration ? activeAspId : null;
  const emptyContent: Content = { projects: [] };
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    emptyContent
  );

  // Metas por aspiración, para el selector "Meta que atiende" de cada proyecto — mismas fuentes
  // que /metas y /estrategia (goals + ganadoras de la Subasta), en vivo.
  const [metaOptionsByAsp, setMetaOptionsByAsp] = useState<Record<number, MetaOption[]>>({});
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const goals = await fetchGoals();
      const { data } = await supabase.from("submissions").select("content").eq("activity_id", METAS_SUBASTA_ACTIVITY_ID);
      const rows = (data as { content: { candidates?: MetaCandidate[]; votes?: MetaVote[] } }[] | null) ?? [];
      const candidates = rows.flatMap((r) => r.content?.candidates ?? []);
      const votes = rows.flatMap((r) => r.content?.votes ?? []);
      const pointsByCandidate: Record<string, number> = {};
      for (const v of votes) pointsByCandidate[v.candidate_id] = (pointsByCandidate[v.candidate_id] ?? 0) + v.points;
      const winning = candidates.filter((c) => (pointsByCandidate[c.id] ?? 0) > 0);
      const map: Record<number, MetaOption[]> = {};
      for (const g of goals) {
        (map[g.aspiration_id] ??= []).push({ id: `goal:${g.id}`, label: g.description });
      }
      for (const c of winning) {
        if (c.aspiration_id === null || c.aspiration_id === undefined) continue;
        (map[c.aspiration_id] ??= []).push({ id: `cand:${c.id}`, label: c.text });
      }
      if (!cancelled) setMetaOptionsByAsp(map);
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`proyectos-metas-${activity.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${METAS_SUBASTA_ACTIVITY_ID}` }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const asp = submissionAspId ?? aspirationId ?? participant.aspiration_id;
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
      {perAspiration && aspirations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {aspirations.map((a) => {
            const cls = aspClasses(a.number);
            const active = activeAspId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setActiveAspId(a.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active ? `border-transparent ${cls.bg} text-dark` : `${cls.border} ${cls.text} bg-card hover:bg-black/5`
                }`}
              >
                Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
              </button>
            );
          })}
        </div>
      )}
      {content.projects.map((p) => {
        const metaOptions = metaOptionsByAsp[activeAspId ?? -1] ?? [];
        const metaLabel = metaOptions.find((m) => m.id === p.meta_id)?.label;
        return (
        <div key={p.id} className="rounded-lg border border-border bg-card p-3">
          {!presenter && (
            <div className="mb-2 flex justify-end">
              <button className={btnDanger} onClick={() => removeProject(p.id)}>
                eliminar
              </button>
            </div>
          )}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-muted">Meta que atiende</label>
            {presenter ? (
              <p className="rounded-md bg-black/[0.03] px-3 py-1.5 text-sm text-foreground min-h-8">{metaLabel || "—"}</p>
            ) : (
              <select className={inputCls} value={p.meta_id ?? ""} onChange={(e) => setField(p.id, "meta_id", e.target.value)}>
                <option value="">Sin meta asignada…</option>
                {metaOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>
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
        );
      })}
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
