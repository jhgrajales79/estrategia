"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import BarChart from "@/components/charts/BarChart";
import { ActivityComponentProps, inputCls, btnPrimary, btnGhost, SaveIndicator, PresenterHint, uid } from "./shared";

interface Candidate {
  id: string;
  text: string;
  author: string;
}
interface Vote {
  participant_id: string;
  participant_name: string;
  candidate_id: string;
  points: number;
}
type Phase = "sketch" | "gallery" | "closed";
interface Content extends Record<string, unknown> {
  candidates: Candidate[];
  votes: Vote[];
  phase: Phase;
}

const PHASE_META: Record<Phase, { label: string; icon: string; badge: string }> = {
  sketch: { label: "Boceto individual", icon: "✏️", badge: "bg-asp-2-soft text-asp-2" },
  gallery: { label: "Galería y votación", icon: "🗳️", badge: "bg-asp-1-soft text-asp-1" },
  closed: { label: "Cerrada", icon: "✅", badge: "bg-brand/10 text-brand-dark" },
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Crazy8({ activity, session, participant }: ActivityComponentProps) {
  const pointsPerPerson = (activity.config.pointsPerPerson as number) ?? 3;
  const maxTextLength = (activity.config.maxTextLength as number) ?? 60;
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { candidates: [], votes: [], phase: "sketch" }
  );
  const [draft, setDraft] = useState("");

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  const phase = content.phase ?? "sketch";
  const myIdea = content.candidates.find((c) => c.author === participant.name);
  const myVotes = content.votes.filter((v) => v.participant_id === participant.id);
  const myRemaining = pointsPerPerson - myVotes.length;

  const totals = content.candidates
    .map((c) => ({ c, total: content.votes.filter((v) => v.candidate_id === c.id).reduce((a, v) => a + v.points, 0) }))
    .sort((a, b) => a.c.id.localeCompare(b.c.id));
  const ranked = [...totals].sort((a, b) => b.total - a.total);

  function setPhase(next: Phase) {
    save({ ...content, phase: next });
  }

  function submitIdea() {
    const text = draft.trim();
    if (!text) return;
    const others = content.candidates.filter((c) => c.author !== participant.name);
    const idea: Candidate = { id: uid(), text, author: participant.name };
    save(
      { ...content, candidates: [...others, idea] },
      { eventType: "candidata", summary: `${participant.name} propuso una idea Crazy 8 en "${activity.title}"` }
    );
    setDraft("");
  }

  function editMyIdea() {
    if (!myIdea) return;
    setDraft(myIdea.text);
    save({ ...content, candidates: content.candidates.filter((c) => c.id !== myIdea.id), votes: content.votes.filter((v) => v.candidate_id !== myIdea.id) });
  }

  function toggleVote(candidateId: string) {
    const already = content.votes.some((v) => v.participant_id === participant.id && v.candidate_id === candidateId);
    if (!already && myRemaining <= 0) return;
    const votes = already
      ? content.votes.filter((v) => !(v.participant_id === participant.id && v.candidate_id === candidateId))
      : [...content.votes, { participant_id: participant.id, participant_name: participant.name, candidate_id: candidateId, points: 1 }];
    save({ ...content, votes }, { eventType: "voto", summary: `${participant.name} votó en "${activity.title}"` });
  }

  const meta = PHASE_META[phase];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.badge}`}>
          {meta.icon} {meta.label}
        </span>
        {presenter && (
          <div className="flex flex-wrap items-center gap-2">
            <PresenterHint />
            <button
              className={btnGhost}
              title="Ampliar como nube de ideas en una pestaña nueva"
              onClick={() => window.open(`/ideas/${activity.id}`, "_blank", "noopener,noreferrer")}
            >
              ⛶ Ampliar
            </button>
            {phase === "sketch" && (
              <button className={btnPrimary} onClick={() => setPhase("gallery")}>
                🗳️ Abrir galería y votación
              </button>
            )}
            {phase === "gallery" && (
              <>
                <button className={btnGhost} onClick={() => setPhase("sketch")}>
                  ← Volver a boceto
                </button>
                <button className={btnPrimary} onClick={() => setPhase("closed")}>
                  ✅ Cerrar y anunciar top 3
                </button>
              </>
            )}
            {phase === "closed" && (
              <button className={btnGhost} onClick={() => setPhase("gallery")}>
                ↺ Reabrir votación
              </button>
            )}
          </div>
        )}
      </div>

      {phase === "sketch" && (
        <div className="rounded-xl border border-border bg-gradient-to-b from-asp-2-soft/40 to-transparent p-5 text-center">
          <p className="text-3xl">✏️</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Escribe aquí <strong className="text-foreground">tu mejor idea</strong>.
          </p>
          <div className="mx-auto mt-4 max-w-md">
            {myIdea ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-left">
                <p className="text-sm text-foreground">&ldquo;{myIdea.text}&rdquo;</p>
                <button className={btnGhost + " shrink-0"} onClick={editMyIdea}>
                  ✏️ Editar
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className={inputCls}
                  placeholder="Tu mejor idea Crazy 8…"
                  maxLength={maxTextLength}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, maxTextLength))}
                  onKeyDown={(e) => e.key === "Enter" && submitIdea()}
                />
                <button className={btnPrimary + " shrink-0"} onClick={submitIdea}>
                  Guardar idea
                </button>
              </div>
            )}
          </div>
          {presenter && (
            <p className="mt-4 text-xs text-muted">
              {content.candidates.length} de las ideas del grupo ya están guardadas. Cuando todos hayan transcrito la
              suya, abre la galería.
            </p>
          )}
        </div>
      )}

      {phase === "gallery" && (
        <>
          {!presenter && (
            <p className="text-sm text-muted">
              Fichas disponibles: <span className="font-semibold text-foreground">{myRemaining}</span> de {pointsPerPerson}{" "}
              (1 ficha por idea, como los adhesivos de la galería en papel)
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {totals.map(({ c, total }) => {
              const mine = myVotes.some((v) => v.candidate_id === c.id);
              return (
                <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
                  <p className="text-sm text-foreground">&ldquo;{c.text}&rdquo;</p>
                  <p className="text-xs text-muted">{c.author}</p>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    {presenter ? (
                      <span className="text-xs font-semibold text-brand-dark">{total} pts</span>
                    ) : (
                      <span />
                    )}
                    {!presenter && (
                      <button
                        className={`w-full rounded-md border px-3 py-1.5 text-sm transition-colors ${
                          mine ? "border-brand bg-brand/10 text-brand-dark" : "border-border hover:bg-black/5"
                        } disabled:opacity-40`}
                        disabled={!mine && myRemaining <= 0}
                        onClick={() => toggleVote(c.id)}
                      >
                        {mine ? "✓ Con mi ficha" : "🗳️ Poner ficha"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {totals.length === 0 && <p className="text-sm text-muted">Aún no hay ideas guardadas para votar.</p>}
          </div>
        </>
      )}

      {phase === "closed" && (
        <div className="space-y-4">
          {ranked.slice(0, 3).some((r) => r.total > 0) && (
            <div className="grid gap-3 sm:grid-cols-3">
              {ranked.slice(0, 3).map(({ c, total }, i) =>
                total > 0 ? (
                  <div key={c.id} className="rounded-xl border-2 border-brand/40 bg-brand/5 p-3 text-center shadow-sm">
                    <p className="text-2xl">{MEDALS[i]}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">&ldquo;{c.text}&rdquo;</p>
                    <p className="text-xs text-muted">{c.author}</p>
                    <p className="mt-1 text-sm font-bold text-brand-dark">{total} pts</p>
                  </div>
                ) : null
              )}
            </div>
          )}
          {ranked.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Todos los resultados</p>
              <BarChart bars={ranked.map((t) => ({ label: `${t.c.text} (${t.c.author})`, value: t.total, colorClass: "bg-brand" }))} unit=" pts" />
            </div>
          )}
        </div>
      )}

      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
