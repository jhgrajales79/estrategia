"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { ActivityComponentProps, inputCls, btnPrimary, btnGhost, btnDanger, SaveIndicator, uid } from "./shared";

interface Axis {
  key: string;
  label: string;
}
interface Signal {
  id: string;
  axis: string;
  ring: number;
  text: string;
  author: string;
  aspiration_id: number | null;
}
interface Content extends Record<string, unknown> {
  activeRound: number;
  signals: Signal[];
}

const SIZE = 340;
const CENTER = SIZE / 2;
const MAX_R = SIZE / 2 - 46;
const RING_FRACTIONS = [0.35, 0.68, 1];

export default function RadarContexto({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const axes = (activity.config.axes as Axis[]) ?? [];
  const rings = (activity.config.rings as string[]) ?? ["Ya nos afecta", "Nos afectará este año", "En el horizonte"];
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { activeRound: 0, signals: [] }
  );
  const [ring, setRing] = useState(0);
  const [text, setText] = useState("");

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  const activeAxis = content.activeRound > 0 ? axes[content.activeRound - 1] : null;

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
    if (!activeAxis || !text.trim()) return;
    const signal: Signal = {
      id: uid(),
      axis: activeAxis.key,
      ring,
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
    save({ ...content, signals: content.signals.filter((s) => s.id !== id) });
  }

  function axisAngle(i: number) {
    return -90 + (360 / axes.length) * i;
  }
  function point(angleDeg: number, radiusFrac: number) {
    const rad = (angleDeg * Math.PI) / 180;
    const r = radiusFrac * MAX_R;
    return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
  }

  const grouped = new Map<string, Signal[]>();
  for (const s of content.signals) {
    const key = `${s.axis}-${s.ring}`;
    grouped.set(key, [...(grouped.get(key) ?? []), s]);
  }

  return (
    <div className="space-y-4">
      {presenter && (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Control del facilitador</p>
          <div className="flex flex-wrap gap-2">
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

      <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} className="absolute inset-0 overflow-visible">
            {RING_FRACTIONS.map((f, i) => (
              <circle key={i} cx={CENTER} cy={CENTER} r={f * MAX_R} fill="none" stroke="currentColor" className="text-border" strokeWidth={1} />
            ))}
            {axes.map((a, i) => {
              const p = point(axisAngle(i), 1);
              return (
                <line key={a.key} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="currentColor" className="text-border" strokeWidth={1} />
              );
            })}
            {axes.map((a, i) => {
              const p = point(axisAngle(i), 1.18);
              return (
                <text
                  key={a.key}
                  x={p.x}
                  y={p.y}
                  fontSize={9.5}
                  textAnchor="middle"
                  className={activeAxis?.key === a.key ? "fill-brand-dark font-bold" : "fill-muted"}
                >
                  {a.label.length > 18 ? a.label.slice(0, 16) + "…" : a.label}
                </text>
              );
            })}
          </svg>
          {content.signals.map((s) => {
            const axisIndex = axes.findIndex((a) => a.key === s.axis);
            if (axisIndex === -1) return null;
            const group = grouped.get(`${s.axis}-${s.ring}`) ?? [];
            const idxInGroup = group.findIndex((g) => g.id === s.id);
            const spread = (idxInGroup - (group.length - 1) / 2) * 10;
            const p = point(axisAngle(axisIndex) + spread, RING_FRACTIONS[s.ring]);
            const asp = findAspiration(aspirations, s.aspiration_id);
            const cls = aspClasses(asp?.number);
            return (
              <div
                key={s.id}
                title={s.text}
                className={`absolute w-16 -translate-x-1/2 -translate-y-1/2 rounded-sm p-1 text-center text-[9px] leading-tight shadow ${
                  asp ? cls.bgSoft : "bg-postit-yellow"
                }`}
                style={{ left: p.x, top: p.y }}
              >
                {s.text.length > 30 ? s.text.slice(0, 28) + "…" : s.text}
              </div>
            );
          })}
        </div>

        <div className="w-full flex-1 space-y-3">
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
          <div className="max-h-56 space-y-1 overflow-y-auto text-xs text-muted">
            {content.signals.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2">
                <span>
                  {axes.find((a) => a.key === s.axis)?.label} · {rings[s.ring]}: {s.text}
                </span>
                {s.author === participant.name && (
                  <button className={btnDanger} onClick={() => removeSignal(s.id)}>
                    eliminar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} />
    </div>
  );
}
