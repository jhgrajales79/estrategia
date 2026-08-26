"use client";

import { useMemo, useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import RadarChartView from "@/components/RadarChartView";
import { ActivityComponentProps, inputCls, btnPrimary, btnGhost, btnDanger, SaveIndicator, PresenterHint, uid } from "./shared";

interface Axis {
  key: string;
  label: string;
}
interface Signal {
  id: string;
  axis: string;
  ring: number;
  round: number;
  text: string;
  author: string;
  aspiration_id: number | null;
}
interface Vote {
  participant_id: string;
  signal_id: string;
  points: number;
}
interface Content extends Record<string, unknown> {
  activeRound: number;
  votingRound: number;
  signals: Signal[];
  votes: Vote[];
}

export default function RadarContexto({ activity, session, participant }: ActivityComponentProps) {
  const axes = (activity.config.axes as Axis[]) ?? [];
  const rings = (activity.config.rings as string[]) ?? ["Ya nos afecta", "Nos afectará este año", "En el horizonte"];
  const pointsPerPerson = (activity.config.pointsPerPerson as number) ?? 3;
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { activeRound: 0, votingRound: 0, signals: [], votes: [] }
  );
  const [ring, setRing] = useState(0);
  const [text, setText] = useState("");

  const voteTotal = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const v of content?.votes ?? []) totals[v.signal_id] = (totals[v.signal_id] ?? 0) + v.points;
    return totals;
  }, [content?.votes]);

  // La señal más votada de cada dimensión (eje) — es lo único que dibuja el radar.
  const winnerByAxis = useMemo(() => {
    const winners: Record<string, Signal | undefined> = {};
    for (const a of axes) {
      const inAxis = (content?.signals ?? []).filter((s) => s.axis === a.key);
      let best: Signal | undefined;
      let bestVotes = -1;
      for (const s of inAxis) {
        const v = voteTotal[s.id] ?? 0;
        if (v > bestVotes) {
          best = s;
          bestVotes = v;
        }
      }
      winners[a.key] = bestVotes > 0 ? best : undefined;
    }
    return winners;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content?.signals, voteTotal]);

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  const activeAxis = content.activeRound > 0 ? axes[content.activeRound - 1] : null;
  const votingAxis = content.votingRound > 0 ? axes[content.votingRound - 1] : null;
  const myUsed = content.votes.filter((v) => v.participant_id === participant.id).reduce((a, v) => a + v.points, 0);
  const myRemaining = pointsPerPerson - myUsed;

  function setRound(n: number) {
    save(
      { ...content, activeRound: n },
      {
        eventType: "ronda",
        summary:
          n === 0
            ? `${participant.name} cerró las rondas del radar`
            : `${participant.name} abrió la ronda "${axes[n - 1]?.label}" del radar`,
      }
    );
  }

  function setVotingRound(n: number) {
    save(
      { ...content, votingRound: n },
      {
        eventType: "ronda_votacion",
        summary:
          n === 0
            ? `${participant.name} cerró la votación del radar`
            : `${participant.name} abrió la votación de "${axes[n - 1]?.label}" en el radar`,
      }
    );
  }

  function addSignal() {
    if (!activeAxis || !text.trim() || presenter) return;
    const signal: Signal = {
      id: uid(),
      axis: activeAxis.key,
      ring,
      round: content.activeRound,
      text: text.trim(),
      author: participant.name,
      aspiration_id: participant.aspiration_id,
    };
    save(
      { ...content, signals: [...content.signals, signal] },
      { eventType: "senal", summary: `${participant.name} ubicó una señal en el radar (${activeAxis.label})` }
    );
    setText("");
  }

  function removeSignal(id: string) {
    save({ ...content, signals: content.signals.filter((s) => s.id !== id), votes: content.votes.filter((v) => v.signal_id !== id) });
  }

  function toggleVote(signalId: string) {
    if (presenter || !votingAxis) return;
    const signal = content.signals.find((s) => s.id === signalId);
    if (!signal || signal.axis !== votingAxis.key) return;
    const already = content.votes.some((v) => v.participant_id === participant.id && v.signal_id === signalId);
    if (!already && myRemaining <= 0) return;
    const votes = already
      ? content.votes.filter((v) => !(v.participant_id === participant.id && v.signal_id === signalId))
      : [...content.votes, { participant_id: participant.id, signal_id: signalId, points: 1 }];
    save({ ...content, votes }, { eventType: "voto_radar", summary: `${participant.name} votó una señal del radar` });
  }

  return (
    <div className="space-y-4">
      {presenter && (
        <div className="rounded-lg border border-border bg-card p-3">
          <PresenterHint text="Ves el radar con la señal más votada de cada dimensión. Controla las rondas y amplía el radar." />
          <div className="mt-3 flex flex-wrap gap-2">
            {axes.map((a, i) => (
              <button key={a.key} className={content.activeRound === i + 1 ? btnPrimary : btnGhost} onClick={() => setRound(i + 1)}>
                Ronda {i + 1}: {a.label}
              </button>
            ))}
            <button className={btnGhost} onClick={() => setRound(0)}>
              Cerrar rondas
            </button>
          </div>
          {content.activeRound === 0 ? (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Votación por ronda</p>
              <div className="flex flex-wrap gap-2">
                {axes.map((a, i) => (
                  <button
                    key={a.key}
                    className={content.votingRound === i + 1 ? btnPrimary : btnGhost}
                    onClick={() => setVotingRound(i + 1)}
                  >
                    Votar: {a.label}
                  </button>
                ))}
                <button className={btnGhost} onClick={() => setVotingRound(0)}>
                  Cerrar votación
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
              La votación por ronda se habilita cuando cierres todas las rondas de recolección.
            </p>
          )}
        </div>
      )}

      {presenter ? (
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
          <div className="relative mx-10 my-6">
            <RadarChartView axes={axes} winnerByAxis={winnerByAxis} voteTotal={voteTotal} activeAxisKey={activeAxis?.key ?? null} />
            <button
              className={btnGhost + " absolute -bottom-2 -right-2 bg-card"}
              title="Ampliar radar en una pestaña nueva"
              onClick={() => window.open(`/radar/${activity.id}`, "_blank", "noopener,noreferrer")}
            >
              ⛶
            </button>
          </div>
          <div className="w-full flex-1 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Más votada por dimensión</p>
            {axes.map((a) => {
              const w = winnerByAxis[a.key];
              return (
                <div key={a.key} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                  <p className="text-xs font-medium text-muted">{a.label}</p>
                  {w ? (
                    <p className="text-foreground">
                      {w.text} <span className="text-xs font-semibold text-brand">· {voteTotal[w.id] ?? 0} pts</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted">Sin votos aún</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {rings.map((r, i) => (
              <span key={i} className="rounded-full bg-black/5 px-2 py-1 text-[11px] text-muted">
                Anillo {i + 1}: {r}
              </span>
            ))}
          </div>
          {activeAxis ? (
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="mb-2 text-sm font-semibold text-foreground">Ronda activa: {activeAxis.label}</p>
              <div className="mb-2 flex flex-wrap gap-2">
                {rings.map((r, i) => (
                  <button key={i} onClick={() => setRing(i)} className={i === ring ? btnPrimary : btnGhost}>
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  placeholder="Señal de cambio del entorno…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSignal()}
                />
                <button className={btnPrimary} onClick={addSignal}>
                  Agregar
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Esperando a que el facilitador abra una ronda…</p>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {votingAxis ? `Vota: ${votingAxis.label}` : "Votación"}
              </p>
              {votingAxis && (
                <span className="text-xs text-muted">
                  Votos disponibles: <span className="font-semibold text-foreground">{myRemaining}</span>/{pointsPerPerson}
                </span>
              )}
            </div>
            {!votingAxis && (
              <p className="mb-2 text-xs text-muted">
                La votación se habilita, ronda por ronda, cuando el facilitador cierra la recolección de señales.
              </p>
            )}
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {(votingAxis ? content.signals.filter((s) => s.axis === votingAxis.key) : content.signals).map((s) => {
                const mine = content.votes.some((v) => v.participant_id === participant.id && v.signal_id === s.id);
                const total = voteTotal[s.id] ?? 0;
                return (
                  <div key={s.id} className="flex items-start justify-between gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                    <span className="min-w-0 flex-1">
                      {axes.find((a) => a.key === s.axis)?.label} · {rings[s.ring]}: {s.text}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="font-semibold text-brand">{total}</span>
                      {votingAxis && (
                        <button
                          className={`rounded border px-2 py-0.5 ${
                            mine ? "border-brand bg-brand/10 text-brand-dark" : "border-border"
                          } disabled:opacity-40`}
                          disabled={!mine && myRemaining <= 0}
                          onClick={() => toggleVote(s.id)}
                        >
                          {mine ? "✓ Votado" : "Votar"}
                        </button>
                      )}
                      {s.author === participant.name && (
                        <button className={btnDanger} onClick={() => removeSignal(s.id)}>
                          eliminar
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
              {(votingAxis ? content.signals.filter((s) => s.axis === votingAxis.key) : content.signals).length === 0 && (
                <p className="text-xs text-muted">Aún no hay señales registradas.</p>
              )}
            </div>
          </div>
        </div>
      )}
      <SaveIndicator saving={saving} updatedAt={updatedAt} />
    </div>
  );
}
