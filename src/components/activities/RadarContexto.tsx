"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import RadarChartView, { axisColor } from "@/components/RadarChartView";
import HomologatedRadarView from "@/components/HomologatedRadarView";
import { cellKey, parseHomologacionXml, type HomologacionSignal } from "@/lib/homologacion";
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
  // Evaluación homologada por el facilitador: totalmente aparte de signals/votes/roundStatus,
  // nunca se lee ni se escribe desde la lógica del radar en vivo.
  homologacion?: { cells: Record<string, string> };
}

const HOMOLOGACION_KEY = "__homologacion__";

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
  const pointsPerPerson = (activity.config.pointsPerPerson as number) ?? 2;
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
  const [homologDraft, setHomologDraft] = useState<Record<string, string>>({});
  const [pendingXml, setPendingXml] = useState<HomologacionSignal[] | null>(null);
  const [xmlError, setXmlError] = useState<string | null>(null);
  const homologFileRef = useRef<HTMLInputElement>(null);

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

  function homologCellValue(axisKey: string, ring: number) {
    const key = cellKey(axisKey, ring);
    return homologDraft[key] ?? content.homologacion?.cells?.[key] ?? "";
  }

  function commitHomologCell(axisKey: string, ring: number) {
    const key = cellKey(axisKey, ring);
    const text = (homologDraft[key] ?? "").trim();
    setHomologDraft((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
    const current = content.homologacion?.cells?.[key] ?? "";
    if (text === current) return;
    const nextCells = { ...(content.homologacion?.cells ?? {}) };
    if (text) nextCells[key] = text;
    else delete nextCells[key];
    save(
      { ...content, homologacion: { cells: nextCells } },
      { eventType: "homologacion", summary: `${participant.name} ajustó la homologación (${axisLabel(axisKey)})` }
    );
  }

  function handleHomologXmlFile(file: File) {
    setXmlError(null);
    file
      .text()
      .then((text) => {
        try {
          setPendingXml(parseHomologacionXml(text));
        } catch (err) {
          setXmlError(err instanceof Error ? err.message : "No se pudo leer el archivo.");
        }
      })
      .catch(() => setXmlError("No se pudo leer el archivo."));
  }

  function confirmHomologImport() {
    if (!pendingXml) return;
    const cells: Record<string, string> = {};
    for (const s of pendingXml) {
      if (!axes.some((a) => a.key === s.axis)) continue;
      cells[cellKey(s.axis, s.ring)] = s.text;
    }
    save(
      { ...content, homologacion: { cells } },
      { eventType: "homologacion", summary: `${participant.name} importó una homologación desde XML` }
    );
    setPendingXml(null);
  }

  const liveAxisKeys = axes.filter((a) => stageOf(a.key) === "collect" || stageOf(a.key) === "vote").map((a) => a.key);

  function remainingFor(axisKey: string) {
    const signalsInAxis = content.signals.filter((s) => s.axis === axisKey);
    const used = content.votes
      .filter((v) => v.participant_id === participant.id && signalsInAxis.some((s) => s.id === v.signal_id))
      .reduce((a, v) => a + v.points, 0);
    return pointsPerPerson - used;
  }

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
    if (!already && remainingFor(key) <= 0) return;
    const votes = already
      ? content.votes.filter((v) => !(v.participant_id === participant.id && v.signal_id === signalId))
      : [...content.votes, { participant_id: participant.id, signal_id: signalId, points: 1 }];
    save({ ...content, votes }, { eventType: "voto_radar", summary: `${participant.name} votó una señal del radar` });
  }

  const isHomologTab = activeKey === HOMOLOGACION_KEY;
  const activeAxis = !isHomologTab ? axes.find((a) => a.key === activeKey) ?? axes[0] : undefined;
  const stage = activeAxis ? stageOf(activeAxis.key) : "pending";
  const myRemaining = activeAxis ? remainingFor(activeAxis.key) : 0;
  const signalsInAxis = activeAxis ? content.signals.filter((s) => s.axis === activeAxis.key) : [];
  const winner = activeAxis ? winnerByAxis[activeAxis.key] : undefined;
  const sortedSignals = [...signalsInAxis].sort((a, b) => (voteTotal[b.id] ?? 0) - (voteTotal[a.id] ?? 0));

  return (
    <div className="space-y-4">
      {presenter && <PresenterHint text="Cada dimensión avanza sola: recolecta, vota y muestra el resultado en la misma pestaña." />}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {presenter && (
          <div className="w-full shrink-0 lg:w-64">
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Radar consolidado</p>
                <button
                  className={btnGhost + " !px-2 !py-1"}
                  title="Ampliar radar en una pestaña nueva"
                  onClick={() => window.open(`/radar/${activity.id}`, "_blank", "noopener,noreferrer")}
                >
                  ⛶
                </button>
              </div>
              <div className="flex justify-center">
                <RadarChartView axes={axes} winnerByAxis={winnerByAxis} voteTotal={voteTotal} activeAxisKey={liveAxisKeys} size={220} />
              </div>
              <div className="mt-2 space-y-1 border-t border-border pt-2">
                {axes.map((a, i) => {
                  const w = winnerByAxis[a.key];
                  return (
                    <div key={a.key} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-muted">
                        {w && <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: axisColor(i) }} />}
                        {a.label}
                      </span>
                      <span className="shrink-0 font-semibold text-brand-dark">{w ? `${voteTotal[w.id] ?? 0} pts` : "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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
            {presenter && (
              <button
                onClick={() => setActiveKey(HOMOLOGACION_KEY)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-left transition-colors ${
                  isHomologTab ? "border-brand-dark bg-brand/5" : "border-border bg-card hover:bg-black/5"
                }`}
                style={{ minWidth: 150 }}
              >
                <p className="text-xs font-semibold text-foreground">🗂️ Homologación</p>
                <p className="mt-1 text-[10px] text-muted">Solo facilitador</p>
              </button>
            )}
          </div>

          {isHomologTab && presenter && (
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Homologación de la evaluación</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Vista independiente, solo tuya: nunca se mezcla con las señales ni los votos del radar en vivo.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button className={btnGhost} onClick={() => homologFileRef.current?.click()}>
                    ⬆ Subir XML
                  </button>
                  <input
                    ref={homologFileRef}
                    type="file"
                    accept=".xml,text/xml,application/xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleHomologXmlFile(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>

              {xmlError && <p className="mb-2 text-xs text-red-600">{xmlError}</p>}

              {pendingXml && (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                  <span>
                    Se importarán {pendingXml.length} señal(es). Esto reemplazará por completo la homologación actual
                    (no afecta el radar en vivo). ¿Continuar?
                  </span>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <button
                      className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-black/5"
                      onClick={() => setPendingXml(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700"
                      onClick={confirmHomologImport}
                    >
                      Sí, reemplazar
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-4 flex justify-center">
                <HomologatedRadarView axes={axes} rings={rings} cells={content.homologacion?.cells ?? {}} size={300} />
              </div>

              <div className="overflow-x-auto">
                <div
                  className="grid min-w-[640px] gap-2"
                  style={{ gridTemplateColumns: `160px repeat(${rings.length}, minmax(200px, 1fr))` }}
                >
                  <div />
                  {rings.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ["#087062", "#ff8300", "#00a0df"][i] }} />
                      {r}
                    </div>
                  ))}
                  {axes.map((a) => (
                    <Fragment key={a.key}>
                      <div className="flex items-center text-xs font-semibold text-foreground">{a.label}</div>
                      {rings.map((_, ringIdx) => (
                        <textarea
                          key={ringIdx}
                          className="min-h-[70px] w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/40"
                          placeholder="Texto homologado…"
                          value={homologCellValue(a.key, ringIdx)}
                          onChange={(e) => setHomologDraft((d) => ({ ...d, [cellKey(a.key, ringIdx)]: e.target.value }))}
                          onBlur={() => commitHomologCell(a.key, ringIdx)}
                        />
                      ))}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

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
