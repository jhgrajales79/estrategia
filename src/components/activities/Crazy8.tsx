"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId, fetchLatestContent } from "@/lib/useSubmission";
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
const MAX_STARS = 2;

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
  const [starLimitMsg, setStarLimitMsg] = useState<string | null>(null);

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  const phase = content.phase ?? "sketch";
  const myIdeas = content.candidates.filter((c) => c.author === participant.name);
  const myFilled = myIdeas.filter((c) => c.text.trim()).length;
  const myStarredList = myIdeas.filter((c) => c.starred);
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

  // Todos los participantes comparten una sola submission (no hay una fila por persona), así
  // que dos personas escribiendo/marcando/votando casi a la vez pueden pisarse: el `content`
  // local de React solo se refresca cuando llega el eco de tiempo real, así que construir el
  // cambio sobre ese `content` puede partir de datos ya desactualizados y borrar en silencio lo
  // que la otra persona acababa de guardar. Para evitar eso, cada mutación relee la fila más
  // reciente directo de Supabase justo antes de aplicar su propio cambio y guardar.
  async function withLatestContent(
    mutate: (latest: Content) => Content | null,
    opts?: { eventType?: string; summary?: string }
  ) {
    const latest = await fetchLatestContent<Content>(activity.id, null, { candidates: [], votes: [], phase: "sketch" });
    const next = mutate(latest);
    if (next) await save(next, opts);
  }

  async function commitSlot(slot: number, rawText: string) {
    const text = rawText.trim();
    await withLatestContent((latest) => {
      const existing = latest.candidates.find((c) => c.author === participant.name && c.slot === slot);
      if (!text) {
        if (!existing) return null;
        return { ...latest, candidates: latest.candidates.filter((c) => c !== existing) };
      }
      if (existing) {
        if (existing.text === text) return null;
        return { ...latest, candidates: latest.candidates.map((c) => (c === existing ? { ...c, text } : c)) };
      }
      return { ...latest, candidates: [...latest.candidates, { id: uid(), text, author: participant.name, slot, starred: false }] };
    });
    setDrafts((d) => {
      const next = { ...d };
      delete next[slot];
      return next;
    });
  }

  async function toggleStar(slot: number) {
    // El texto puede no estar guardado todavía (la persona marcó la estrella antes de salir
    // del campo): se usa el borrador local para poder crear/estrellar la idea en un solo paso.
    const draftText = drafts[slot];
    setStarLimitMsg(null);
    await withLatestContent((latest) => {
      const existing = latest.candidates.find((c) => c.author === participant.name && c.slot === slot);
      const text = (draftText ?? existing?.text ?? "").trim();
      if (!text) return null;
      const isStarred = existing?.starred ?? false;
      if (!isStarred) {
        const myStarredCount = latest.candidates.filter((c) => c.author === participant.name && c.starred).length;
        if (myStarredCount >= MAX_STARS) {
          setStarLimitMsg(`Ya marcaste ${MAX_STARS} favoritas — quita una para elegir otra.`);
          return null;
        }
      }
      if (existing) {
        return {
          ...latest,
          candidates: latest.candidates.map((c) => (c === existing ? { ...c, text, starred: !isStarred } : c)),
        };
      }
      return { ...latest, candidates: [...latest.candidates, { id: uid(), text, author: participant.name, slot, starred: true }] };
    });
    if (draftText !== undefined) {
      setDrafts((d) => {
        const next = { ...d };
        delete next[slot];
        return next;
      });
    }
  }

  function myPointsOn(candidateId: string) {
    return content.votes.find((v) => v.participant_id === participant.id && v.candidate_id === candidateId)?.points ?? 0;
  }

  async function addPoint(candidateId: string) {
    if (myRemaining <= 0) return;
    await withLatestContent(
      (latest) => {
        const used = latest.votes
          .filter((v) => v.participant_id === participant.id)
          .reduce((a, v) => a + v.points, 0);
        if (used >= pointsPerPerson) return null;
        const existing = latest.votes.find((v) => v.participant_id === participant.id && v.candidate_id === candidateId);
        const votes = existing
          ? latest.votes.map((v) => (v === existing ? { ...v, points: v.points + 1 } : v))
          : [...latest.votes, { participant_id: participant.id, participant_name: participant.name, candidate_id: candidateId, points: 1 }];
        return { ...latest, votes };
      },
      { eventType: "voto", summary: `${participant.name} votó en "${activity.title}"` }
    );
  }

  async function removePoint(candidateId: string) {
    await withLatestContent((latest) => {
      const existing = latest.votes.find((v) => v.participant_id === participant.id && v.candidate_id === candidateId);
      if (!existing) return null;
      const votes =
        existing.points <= 1
          ? latest.votes.filter((v) => v !== existing)
          : latest.votes.map((v) => (v === existing ? { ...v, points: v.points - 1 } : v));
      return { ...latest, votes };
    });
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
              {myStarredList.length > 0 ? (
                <span className="text-brand-dark">
                  ⭐ {myStarredList.length}/{MAX_STARS} favoritas marcadas
                </span>
              ) : (
                <span>marca hasta {MAX_STARS} favoritas ⭐ antes de la galería</span>
              )}
            </p>
          </div>
          {starLimitMsg && <p className="mb-3 text-xs text-amber-700">{starLimitMsg}</p>}
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
                        title="Marcar como favorita"
                        // Evita que el clic le quite el foco al input de texto primero: si eso
                        // pasara, dispararía su guardado (onBlur) justo antes de que esto
                        // corriera, compitiendo por escribir la misma idea al mismo tiempo.
                        onMouseDown={(e) => e.preventDefault()}
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
                  <p className="mt-0.5 text-right text-[9px] text-muted">
                    {text.length}/{maxTextLength}
                  </p>
                </div>
              );
            })}
          </div>
          {presenter && (
            <p className="mt-4 text-xs text-muted">
              {authorsStarted} personas ya escribieron ideas · {authorsStarred} ya marcaron alguna favorita. Cuando el
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
