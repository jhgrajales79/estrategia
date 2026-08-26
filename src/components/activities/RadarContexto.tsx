"use client";

import { useEffect, useMemo, useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import { ActivityComponentProps, inputCls, btnPrimary, btnGhost, btnDanger, SaveIndicator, PresenterHint, ROUND_PALETTE, autoBg, uid } from "./shared";

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
  signals: Signal[];
  votes: Vote[];
}

const BASE_SIZE = 340;

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
    { activeRound: 0, signals: [], votes: [] }
  );
  const [ring, setRing] = useState(0);
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [viewportSize, setViewportSize] = useState(BASE_SIZE);

  useEffect(() => {
    if (!expanded) return;
    function computeSize() {
      setViewportSize(Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.82));
    }
    computeSize();
    window.addEventListener("resize", computeSize);
    return () => window.removeEventListener("resize", computeSize);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

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
    if (presenter) return;
    const already = content.votes.some((v) => v.participant_id === participant.id && v.signal_id === signalId);
    if (!already && myRemaining <= 0) return;
    const votes = already
      ? content.votes.filter((v) => !(v.participant_id === participant.id && v.signal_id === signalId))
      : [...content.votes, { participant_id: participant.id, signal_id: signalId, points: 1 }];
    save({ ...content, votes }, { eventType: "voto_radar", summary: `${participant.name} votó una señal del radar` });
  }

  function axisAngle(i: number) {
    return -90 + (360 / axes.length) * i;
  }
  function point(size: number, angleDeg: number, radiusFrac: number) {
    const center = size / 2;
    const maxR = size / 2 - 46;
    const rad = (angleDeg * Math.PI) / 180;
    const r = radiusFrac * maxR;
    return { x: center + r * Math.cos(rad), y: center + r * Math.sin(rad) };
  }

  const ringFractions = [0.35, 0.68, 1];

  function renderRadar(size: number) {
    const center = size / 2;
    const vertices = axes.map((a, i) => {
      const winner = winnerByAxis[a.key];
      const radiusFrac = winner ? ringFractions[winner.ring] : 0;
      return { axis: a, winner, ...point(size, axisAngle(i), radiusFrac) };
    });
    const hasAny = vertices.some((v) => v.winner);
    const polygonPoints = vertices.map((v) => `${v.x},${v.y}`).join(" ");

    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0 overflow-visible">
          {ringFractions.map((f, i) => (
            <circle key={i} cx={center} cy={center} r={f * (size / 2 - 46)} fill="none" stroke="currentColor" className="text-border" strokeWidth={1} />
          ))}
          {axes.map((a, i) => {
            const p = point(size, axisAngle(i), 1);
            return <line key={a.key} x1={center} y1={center} x2={p.x} y2={p.y} stroke="currentColor" className="text-border" strokeWidth={1} />;
          })}
          {axes.map((a, i) => {
            const p = point(size, axisAngle(i), 1.18);
            return (
              <text
                key={a.key}
                x={p.x}
                y={p.y}
                fontSize={size > BASE_SIZE ? 14 : 9.5}
                textAnchor="middle"
                className={activeAxis?.key === a.key ? "fill-brand-dark font-bold" : "fill-muted"}
              >
                {a.label.length > 18 ? a.label.slice(0, 16) + "…" : a.label}
              </text>
            );
          })}
          {hasAny && (
            <polygon
              points={polygonPoints}
              className="fill-[#2f9e4f]/[0.06] stroke-[#2f9e4f]/40"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          )}
          {vertices.map(
            (v) =>
              v.winner && <circle key={v.axis.key} cx={v.x} cy={v.y} r={size > BASE_SIZE ? 5 : 3.5} className="fill-[#2f9e4f]/80" />
          )}
        </svg>
        {vertices.map(
          (v) =>
            v.winner && (
              <div
                key={v.axis.key}
                title={v.winner.text}
                className={`absolute -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-sm text-center leading-tight shadow ${
                  size > BASE_SIZE ? "w-28 text-[11px] p-1.5" : "w-20 text-[9px] p-1"
                } ${autoBg(v.winner.round - 1, ROUND_PALETTE)}`}
                style={{ left: v.x, top: v.y }}
              >
                {v.winner.text.length > 34 ? v.winner.text.slice(0, 32) + "…" : v.winner.text}
                <div className="mt-0.5 font-semibold text-brand-dark">{voteTotal[v.winner.id] ?? 0} pts</div>
              </div>
            )
        )}
      </div>
    );
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
        </div>
      )}

      {presenter ? (
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
          <div className="relative">
            {renderRadar(BASE_SIZE)}
            <button
              className={btnGhost + " absolute -bottom-2 -right-2 bg-card"}
              title="Ampliar radar a pantalla completa"
              onClick={() => setExpanded(true)}
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
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Vota las más impactantes</p>
              <span className="text-xs text-muted">
                Votos disponibles: <span className="font-semibold text-foreground">{myRemaining}</span>/{pointsPerPerson}
              </span>
            </div>
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {content.signals.map((s) => {
                const mine = content.votes.some((v) => v.participant_id === participant.id && v.signal_id === s.id);
                const total = voteTotal[s.id] ?? 0;
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                    <span className="min-w-0 flex-1 truncate" title={s.text}>
                      {axes.find((a) => a.key === s.axis)?.label} · {rings[s.ring]}: {s.text}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="font-semibold text-brand">{total}</span>
                      <button
                        className={`rounded border px-2 py-0.5 ${
                          mine ? "border-brand bg-brand/10 text-brand-dark" : "border-border"
                        } disabled:opacity-40`}
                        disabled={!mine && myRemaining <= 0}
                        onClick={() => toggleVote(s.id)}
                      >
                        {mine ? "✓ Votado" : "Votar"}
                      </button>
                      {s.author === participant.name && (
                        <button className={btnDanger} onClick={() => removeSignal(s.id)}>
                          eliminar
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
              {content.signals.length === 0 && <p className="text-xs text-muted">Aún no hay señales registradas.</p>}
            </div>
          </div>
        </div>
      )}
      <SaveIndicator saving={saving} updatedAt={updatedAt} />

      {expanded && presenter && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/98 p-6">
          <button className={btnGhost + " absolute right-6 top-6"} onClick={() => setExpanded(false)}>
            ✕ Cerrar
          </button>
          {renderRadar(viewportSize)}
        </div>
      )}
    </div>
  );
}
