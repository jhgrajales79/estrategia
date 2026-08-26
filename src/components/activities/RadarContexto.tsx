"use client";

import { useEffect, useMemo, useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import { ActivityComponentProps, inputCls, btnPrimary, btnGhost, btnDanger, SaveIndicator, PresenterHint, ToggleSwitch, ROUND_PALETTE, autoBg, uid } from "./shared";

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
  showOnlyFocus: boolean;
}

const BASE_SIZE = 340;

export default function RadarContexto({ activity, session, participant }: ActivityComponentProps) {
  const axes = (activity.config.axes as Axis[]) ?? [];
  const rings = (activity.config.rings as string[]) ?? ["Ya nos afecta", "Nos afectará este año", "En el horizonte"];
  const pointsPerPerson = (activity.config.pointsPerPerson as number) ?? 3;
  const focusCount = (activity.config.focusCount as number) ?? 3;
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { activeRound: 0, signals: [], votes: [], showOnlyFocus: false }
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

  const focusIds = useMemo(() => {
    if (!content) return new Set<string>();
    return new Set(
      Object.entries(voteTotal)
        .filter(([, total]) => total > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, focusCount)
        .map(([id]) => id)
    );
  }, [voteTotal, focusCount, content]);

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

  function voteSignal(signalId: string, points: number) {
    if (presenter || points < 0) return;
    const others = content.votes.filter((v) => !(v.participant_id === participant.id && v.signal_id === signalId));
    const usedByOthers = others.filter((v) => v.participant_id === participant.id).reduce((a, v) => a + v.points, 0);
    if (usedByOthers + points > pointsPerPerson) return;
    const votes = points === 0 ? others : [...others, { participant_id: participant.id, signal_id: signalId, points }];
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
  const visibleSignals = content.showOnlyFocus ? content.signals.filter((s) => focusIds.has(s.id)) : content.signals;
  const grouped = new Map<string, Signal[]>();
  for (const s of visibleSignals) {
    const key = `${s.axis}-${s.ring}`;
    grouped.set(key, [...(grouped.get(key) ?? []), s]);
  }

  function renderRadar(size: number) {
    const center = size / 2;
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
        </svg>
        {visibleSignals.map((s) => {
          const axisIndex = axes.findIndex((a) => a.key === s.axis);
          if (axisIndex === -1) return null;
          const group = grouped.get(`${s.axis}-${s.ring}`) ?? [];
          const idxInGroup = group.findIndex((g) => g.id === s.id);
          const spread = (idxInGroup - (group.length - 1) / 2) * 10;
          const p = point(size, axisAngle(axisIndex) + spread, ringFractions[s.ring]);
          const chipSize = size > BASE_SIZE ? "w-24 text-[11px] p-1.5" : "w-16 text-[9px] p-1";
          const isFocus = focusIds.has(s.id);
          return (
            <div
              key={s.id}
              title={s.text}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-sm text-center leading-tight shadow ${chipSize} ${autoBg(
                s.round - 1,
                ROUND_PALETTE
              )} ${isFocus ? "ring-2 ring-brand shadow-lg z-10" : ""}`}
              style={{ left: p.x, top: p.y }}
            >
              {isFocus && "🎯 "}
              {s.text.length > 30 ? s.text.slice(0, 28) + "…" : s.text}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {presenter && (
        <div className="rounded-lg border border-border bg-card p-3">
          <PresenterHint text="Solo puedes controlar las rondas, ver la votación y ampliar el radar." />
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
          <div className="mt-3">
            <ToggleSwitch
              checked={content.showOnlyFocus}
              onChange={(next) => save({ ...content, showOnlyFocus: next })}
              label={`Mostrar solo foco (top ${focusCount} votadas)`}
            />
          </div>
        </div>
      )}

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

        <div className="w-full flex-1 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {rings.map((r, i) => (
              <span key={i} className="rounded-full bg-black/5 px-2 py-1 text-[11px] text-muted">
                Anillo {i + 1}: {r}
              </span>
            ))}
          </div>
          {!presenter &&
            (activeAxis ? (
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
            ))}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Vota las más impactantes</p>
              {!presenter && (
                <span className="text-xs text-muted">
                  Fichas: <span className="font-semibold text-foreground">{myRemaining}</span>/{pointsPerPerson}
                </span>
              )}
            </div>
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {content.signals.map((s) => {
                const mine = content.votes.find((v) => v.participant_id === participant.id && v.signal_id === s.id)?.points ?? 0;
                const total = voteTotal[s.id] ?? 0;
                const isFocus = focusIds.has(s.id);
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                    <span className="min-w-0 flex-1 truncate" title={s.text}>
                      {isFocus && "🎯 "}
                      {axes.find((a) => a.key === s.axis)?.label} · {rings[s.ring]}: {s.text}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="font-semibold text-brand">{total}</span>
                      {!presenter && (
                        <>
                          <button className="w-5 rounded border border-border" onClick={() => voteSignal(s.id, Math.max(0, mine - 1))}>
                            -
                          </button>
                          <button
                            className="w-5 rounded border border-border disabled:opacity-40"
                            disabled={myRemaining <= 0}
                            onClick={() => voteSignal(s.id, mine + 1)}
                          >
                            +
                          </button>
                        </>
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
              {content.signals.length === 0 && <p className="text-xs text-muted">Aún no hay señales registradas.</p>}
            </div>
          </div>
        </div>
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} />

      {expanded && (
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
