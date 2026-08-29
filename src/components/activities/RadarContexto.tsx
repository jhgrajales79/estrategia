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
type RoundStage = "pending" | "collect" | "vote" | "closed";

interface Content extends Record<string, unknown> {
  signals: Signal[];
  votes: Vote[];
  roundStatus: Record<string, RoundStage>;
}

const STAGE_META: Record<RoundStage, { label: string; icon: string; badgeClass: string; tabActiveClass: string }> = {
  pending: { label: "Pendiente", icon: "⏳", badgeClass: "bg-black/5 text-muted", tabActiveClass: "border-border bg-card" },
  collect: { label: "Recolectando", icon: "✏️", badgeClass: "bg-asp-2-soft text-asp-2", tabActiveClass: "border-asp-2 bg-asp-2-soft/40" },
  vote: { label: "Votando", icon: "🗳️", badgeClass: "bg-asp-1-soft text-asp-1", tabActiveClass: "border-asp-1 bg-asp-1-soft/40" },
  closed: { label: "Cerrada", icon: "✅", badgeClass: "bg-brand/10 text-brand-dark", tabActiveClass: "border-brand-dark bg-brand/5" },
};

function StagePill({ stage }: { stage: RoundStage }) {
  const m = STAGE_META[stage];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.badgeClass}`}>
      {m.icon} {m.label}
    </span>
  );
}

export default function RadarContexto({ activity, session, participant }: ActivityComponentProps) {
  const axes = (activity.config.axes as Axis[]) ?? [];
  const rings = (activity.config.rings as string[]) ?? ["Ya nos afecta", "Nos afectará este año", "En el horizonte"];
  const pointsPerPerson = (activity.config.pointsPerPerson as number) ?? 3;
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { signals: [], votes: [], roundStatus: {} }
  );
  const [activeKey, setActiveKey] = useState<string>(axes[0]?.key ?? "");
  const [draftText, setDraftText] = useState<Record<string, string>>({});
  const [draftRing, setDraftRing] = useState<Record<string, number>>({});

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

  function stageOf(key: string): RoundStage {
    const explicit = content.roundStatus?.[key];
    if (explicit) return explicit;
    // Compatibilidad con radares creados antes de las pestañas por dimensión.
    const signalsInAxis = content.signals.filter((s) => s.axis === key);
    if (signalsInAxis.length === 0) return "pending";
    const hasVotes = content.votes.some((v) => signalsInAxis.some((s) => s.id === v.signal_id));
    return hasVotes ? "closed" : "collect";
  }

  function axisLabel(key: string) {
    return axes.find((a) => a.key === key)?.label ?? key;
  }

  function setStage(key: string, stage: RoundStage) {
    save(
      { ...content, roundStatus: { ...content.roundStatus, [key]: stage } },
      { eventType: "ronda", summary: `${participant.name} cambió "${axisLabel(key)}" a "${STAGE_META[stage].label}"` }
    );
  }

  const liveAxisKeys = axes.filter((a) => stageOf(a.key) === "collect" || stageOf(a.key) === "vote").map((a) => a.key);
  const myUsed = content.votes.filter((v) => v.participant_id === participant.id).reduce((a, v) => a + v.points, 0);
  const myRemaining = pointsPerPerson - myUsed;

  function addSignal(key: string) {
    const text = (draftText[key] ?? "").trim();
    if (!text || presenter) return;
    const axisIndex = axes.findIndex((a) => a.key === key);
    const signal: Signal = {
      id: uid(),
      axis: key,
      ring: draftRing[key] ?? 0,
      round: axisIndex + 1,
      text,
      author: participant.name,
      aspiration_id: participant.aspiration_id,
    };
    save(
      { ...content, signals: [...content.signals, signal] },
      { eventType: "senal", summary: `${participant.name} ubicó una señal en el radar (${axisLabel(key)})` }
    );
    setDraftText((d) => ({ ...d, [key]: "" }));
  }

  function removeSignal(id: string) {
    save({ ...content, signals: content.signals.filter((s) => s.id !== id), votes: content.votes.filter((v) => v.signal_id !== id) });
  }

  function toggleVote(key: string, signalId: string) {
    if (presenter || stageOf(key) !== "vote") return;
    const signal = content.signals.find((s) => s.id === signalId);
    if (!signal || signal.axis !== key) return;
    const already = content.votes.some((v) => v.participant_id === participant.id && v.signal_id === signalId);
    if (!already && myRemaining <= 0) return;
    const votes = already
      ? content.votes.filter((v) => !(v.participant_id === participant.id && v.signal_id === signalId))
      : [...content.votes, { participant_id: participant.id, signal_id: signalId, points: 1 }];
    save({ ...content, votes }, { eventType: "voto_radar", summary: `${participant.name} votó una señal del radar` });
  }

  const activeAxis = axes.find((a) => a.key === activeKey) ?? axes[0];
  const stage = activeAxis ? stageOf(activeAxis.key) : "pending";
  const signalsInAxis = activeAxis ? content.signals.filter((s) => s.axis === activeAxis.key) : [];
  const winner = activeAxis ? winnerByAxis[activeAxis.key] : undefined;
  const sortedSignals = [...signalsInAxis].sort((a, b) => (voteTotal[b.id] ?? 0) - (voteTotal[a.id] ?? 0));

  return (
    <div className="space-y-4">
      {presenter && <PresenterHint text="Cada dimensión avanza sola: recolecta, vota y muestra el resultado en la misma pestaña." />}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="w-full shrink-0 lg:w-64">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Radar consolidado</p>
              {presenter && (
                <button
                  className={btnGhost + " !px-2 !py-1"}
                  title="Ampliar radar en una pestaña nueva"
                  onClick={() => window.open(`/radar/${activity.id}`, "_blank", "noopener,noreferrer")}
                >
                  ⛶
                </button>
              )}
            </div>
            <div className="flex justify-center">
              <RadarChartView axes={axes} winnerByAxis={winnerByAxis} voteTotal={voteTotal} activeAxisKey={liveAxisKeys} size={220} />
            </div>
            <div className="mt-2 space-y-1 border-t border-border pt-2">
              {axes.map((a) => {
                const w = winnerByAxis[a.key];
                return (
                  <div key={a.key} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate text-muted">{a.label}</span>
                    <span className="shrink-0 font-semibold text-brand-dark">{w ? `${voteTotal[w.id] ?? 0} pts` : "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {axes.map((a) => {
              const s = stageOf(a.key);
              return (
                <button
                  key={a.key}
                  onClick={() => setActiveKey(a.key)}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-left transition-colors ${
                    a.key === activeKey ? STAGE_META[s].tabActiveClass : "border-border bg-card hover:bg-black/5"
                  }`}
                  style={{ minWidth: 150 }}
                >
                  <p className="text-xs font-semibold text-foreground">{a.label}</p>
                  <div className="mt-1">
                    <StagePill stage={s} />
                  </div>
                </button>
              );
            })}
          </div>

          {activeAxis && (
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{activeAxis.label}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {stage === "collect" && (presenter ? "Los equipos están escribiendo señales." : "Escribe una señal de cambio del entorno.")}
                    {stage === "vote" && "Votación y resultado en vivo — sin esperar al cierre."}
                    {stage === "pending" && "Aún no se ha abierto esta dimensión."}
                    {stage === "closed" && "Dimensión cerrada."}
                  </p>
                </div>
                {presenter && (
                  <div className="flex flex-wrap gap-2">
                    {stage === "pending" && (
                      <button className={btnPrimary} onClick={() => setStage(activeAxis.key, "collect")}>
                        ▶ Iniciar recolección
                      </button>
                    )}
                    {stage === "collect" && (
                      <>
                        <button className={btnPrimary} onClick={() => setStage(activeAxis.key, "vote")}>
                          🗳 Pasar a votación
                        </button>
                        <button className={btnGhost} onClick={() => setStage(activeAxis.key, "pending")}>
                          ↺ Reiniciar
                        </button>
                      </>
                    )}
                    {stage === "vote" && (
                      <>
                        <button className={btnPrimary} onClick={() => setStage(activeAxis.key, "closed")}>
                          ✓ Cerrar y fijar ganador
                        </button>
                        <button className={btnGhost} onClick={() => setStage(activeAxis.key, "collect")}>
                          ← Volver a recolección
                        </button>
                      </>
                    )}
                    {stage === "closed" && (
                      <button className={btnGhost} onClick={() => setStage(activeAxis.key, "vote")}>
                        ↺ Reabrir votación
                      </button>
                    )}
                  </div>
                )}
              </div>

              {stage === "pending" && !presenter && <p className="text-sm text-muted">Esperando a que el facilitador abra esta dimensión…</p>}

              {stage === "collect" && !presenter && (
                <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                  <select
                    className={inputCls + " sm:w-56"}
                    value={draftRing[activeAxis.key] ?? 0}
                    onChange={(e) => setDraftRing((d) => ({ ...d, [activeAxis.key]: Number(e.target.value) }))}
                  >
                    {rings.map((r, i) => (
                      <option key={i} value={i}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <input
                    className={inputCls}
                    placeholder="Señal de cambio del entorno…"
                    value={draftText[activeAxis.key] ?? ""}
                    onChange={(e) => setDraftText((d) => ({ ...d, [activeAxis.key]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addSignal(activeAxis.key)}
                  />
                  <button className={btnPrimary} onClick={() => addSignal(activeAxis.key)}>
                    Agregar
                  </button>
                </div>
              )}

              {(stage === "vote" || stage === "closed") && winner && (
                <div className="mb-3 flex items-center gap-2 rounded-md border border-brand-dark/30 bg-brand/5 px-3 py-2">
                  <span className="text-lg leading-none">{stage === "closed" ? "🏆" : "🔥"}</span>
                  <p className="text-sm text-foreground">
                    {stage === "closed" ? "Ganadora: " : "Va ganando: "}
                    <span className="font-semibold">{winner.text}</span>{" "}
                    <span className="text-xs text-muted">
                      · {voteTotal[winner.id] ?? 0} pts · {rings[winner.ring]}
                    </span>
                  </p>
                </div>
              )}

              {stage === "vote" && !presenter && (
                <div className="mb-2 flex items-center justify-end text-xs text-muted">
                  Votos disponibles: <span className="ml-1 font-semibold text-foreground">{myRemaining}</span>/{pointsPerPerson}
                </div>
              )}

              <div className="max-h-72 space-y-1.5 overflow-y-auto">
                {sortedSignals.length === 0 && <p className="text-xs text-muted">Aún no hay señales registradas.</p>}
                {sortedSignals.map((s) => {
                  const mine = content.votes.some((v) => v.participant_id === participant.id && v.signal_id === s.id);
                  const total = voteTotal[s.id] ?? 0;
                  const isWinner = winner?.id === s.id && (stage === "vote" || stage === "closed");
                  return (
                    <div
                      key={s.id}
                      className={`flex items-start justify-between gap-2 rounded-md border px-2 py-1.5 text-xs ${
                        isWinner ? "border-brand-dark bg-brand/5" : "border-border bg-card"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        {rings[s.ring]}: {s.text}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {stage !== "collect" && stage !== "pending" && <span className="font-semibold text-brand-dark">{total}</span>}
                        {stage === "vote" && !presenter && (
                          <button
                            className={`rounded border px-2 py-0.5 ${
                              mine ? "border-brand-dark bg-brand/10 text-brand-dark" : "border-border"
                            } disabled:opacity-40`}
                            disabled={!mine && myRemaining <= 0}
                            onClick={() => toggleVote(activeAxis.key, s.id)}
                          >
                            {mine ? "✓ Votado" : "Votar"}
                          </button>
                        )}
                        {!presenter && s.author === participant.name && total === 0 && (
                          <button className={btnDanger} onClick={() => removeSignal(s.id)}>
                            eliminar
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
