"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import BarChart from "@/components/charts/BarChart";
import { ActivityComponentProps, btnPrimary, btnGhost, SaveIndicator, PresenterHint, uid } from "./shared";

interface Candidate {
  id: string;
  text: string;
  author: string;
  slot: number;
  starred?: boolean;
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
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];

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
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  const phase = content.phase ?? "sketch";
  const myIdeas = content.candidates.filter((c) => c.author === participant.name);
  const myFilled = myIdeas.filter((c) => c.text.trim()).length;
  const myStarred = myIdeas.find((c) => c.starred);
  const myVotes = content.votes.filter((v) => v.participant_id === participant.id);
  const myRemaining = pointsPerPerson - myVotes.reduce((a, v) => a + v.points, 0);

  const shortlisted = content.candidates.filter((c) => c.starred && c.text.trim());
  const totals = shortlisted
    .map((c) => ({ c, total: content.votes.filter((v) => v.candidate_id === c.id).reduce((a, v) => a + v.points, 0) }))
    .sort((a, b) => a.c.id.localeCompare(b.c.id));
  const ranked = [...totals].sort((a, b) => b.total - a.total);

  const authorsStarted = new Set(content.candidates.filter((c) => c.text.trim()).map((c) => c.author)).size;
  const authorsStarred = new Set(content.candidates.filter((c) => c.starred).map((c) => c.author)).size;

  function setPhase(next: Phase) {
    save({ ...content, phase: next });
  }

  function commitSlot(slot: number, rawText: string) {
    const text = rawText.trim();
    const existing = content.candidates.find((c) => c.author === participant.name && c.slot === slot);
    let candidates: Candidate[];
    if (!text) {
      candidates = existing ? content.candidates.filter((c) => c !== existing) : content.candidates;
      if (!existing) return;
    } else if (existing) {
      if (existing.text === text) return;
      candidates = content.candidates.map((c) => (c === existing ? { ...c, text } : c));
    } else {
      candidates = [...content.candidates, { id: uid(), text, author: participant.name, slot, starred: false }];
    }
    save({ ...content, candidates });
    setDrafts((d) => {
      const next = { ...d };
      delete next[slot];
      return next;
    });
  }

  function toggleStar(slot: number) {
    const target = myIdeas.find((c) => c.slot === slot);
    if (!target || !target.text.trim()) return;
    const nextStarred = !target.starred;
    const candidates = content.candidates.map((c) =>
      c.author === participant.name ? { ...c, starred: c.slot === slot ? nextStarred : false } : c
    );
    save({ ...content, candidates });
  }

  function myPointsOn(candidateId: string) {
    return content.votes.find((v) => v.participant_id === participant.id && v.candidate_id === candidateId)?.points ?? 0;
  }

  function addPoint(candidateId: string) {
    if (myRemaining <= 0) return;
    const existing = content.votes.find((v) => v.participant_id === participant.id && v.candidate_id === candidateId);
    const votes = existing
      ? content.votes.map((v) => (v === existing ? { ...v, points: v.points + 1 } : v))
      : [...content.votes, { participant_id: participant.id, participant_name: participant.name, candidate_id: candidateId, points: 1 }];
    save({ ...content, votes }, { eventType: "voto", summary: `${participant.name} votó en "${activity.title}"` });
  }

  function removePoint(candidateId: string) {
    const existing = content.votes.find((v) => v.participant_id === participant.id && v.candidate_id === candidateId);
    if (!existing) return;
    const votes =
      existing.points <= 1
        ? content.votes.filter((v) => v !== existing)
        : content.votes.map((v) => (v === existing ? { ...v, points: v.points - 1 } : v));
    save({ ...content, votes });
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
        <div className="rounded-xl border border-border bg-gradient-to-b from-asp-2-soft/40 to-transparent p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              <strong className="text-foreground">{myFilled}/8</strong> ideas ·{" "}
              {myStarred ? (
                <span className="text-brand-dark">⭐ favorita marcada</span>
              ) : (
                <span>marca tu favorita ⭐ antes de la galería</span>
              )}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SLOTS.map((slot) => {
              const mine = myIdeas.find((c) => c.slot === slot);
              const text = drafts[slot] ?? mine?.text ?? "";
              return (
                <div
                  key={slot}
                  className={`flex flex-col rounded-lg border bg-card p-2 ${mine?.starred ? "border-brand shadow-sm" : "border-border"}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Idea {slot}</span>
                    {text.trim() && (
                      <button
                        className={`text-sm leading-none ${mine?.starred ? "" : "opacity-40 hover:opacity-100"}`}
                        title="Marcar como mi favorita"
                        onClick={() => toggleStar(slot)}
                      >
                        {mine?.starred ? "⭐" : "☆"}
                      </button>
                    )}
                  </div>
                  <input
                    className="w-full bg-transparent text-xs text-foreground placeholder:text-muted focus:outline-none"
                    placeholder="Escribe…"
                    maxLength={maxTextLength}
                    value={text}
                    onChange={(e) => setDrafts((d) => ({ ...d, [slot]: e.target.value }))}
                    onBlur={(e) => commitSlot(slot, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  />
                </div>
              );
            })}
          </div>
          {presenter && (
            <p className="mt-4 text-xs text-muted">
              {authorsStarted} personas ya escribieron ideas · {authorsStarred} ya marcaron su favorita. Cuando el
              grupo esté listo, abre la galería (solo se vota lo marcado con ⭐).
            </p>
          )}
        </div>
      )}

      {phase === "gallery" && (
        <>
          {!presenter && (
            <p className="text-sm text-muted">
              Fichas disponibles: <span className="font-semibold text-foreground">{myRemaining}</span> de {pointsPerPerson}{" "}
              — repártelas como quieras, incluso todas en una sola idea.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {totals.map(({ c, total }) => {
              const mine = myPointsOn(c.id);
              return (
                <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
                  <p className="text-sm text-foreground">&ldquo;{c.text}&rdquo;</p>
                  <p className="text-xs text-muted">{c.author}</p>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    {presenter ? (
                      <span className="text-xs font-semibold text-brand-dark">{total} pts</span>
                    ) : (
                      <span className="text-xs text-muted">{total} pts</span>
                    )}
                    {!presenter && (
                      <div className="flex items-center gap-2">
                        <button
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm hover:bg-black/5 disabled:opacity-40"
                          disabled={mine <= 0}
                          onClick={() => removePoint(c.id)}
                          aria-label="Quitar una ficha"
                        >
                          −
                        </button>
                        <span className={`w-5 text-center text-sm font-semibold ${mine > 0 ? "text-brand-dark" : "text-muted"}`}>
                          {mine}
                        </span>
                        <button
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm hover:bg-black/5 disabled:opacity-40"
                          disabled={myRemaining <= 0}
                          onClick={() => addPoint(c.id)}
                          aria-label="Poner una ficha"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {totals.length === 0 && (
              <p className="text-sm text-muted">Nadie ha marcado una idea favorita todavía. Vuelve al boceto para que el grupo elija.</p>
            )}
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
