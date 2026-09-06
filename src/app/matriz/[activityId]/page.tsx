"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchAspirations, fetchSessionById } from "@/lib/data";
import { useSubmission } from "@/lib/useSubmission";
import { axisColor } from "@/components/RadarChartView";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";
import type { StoredParticipant } from "@/lib/participant";

interface SimpleRow {
  id: string;
  factor: string;
  peso: number;
  calificacion: number;
  aspiration_id: number | null;
}
interface RatingLabel {
  value: number;
  label: string;
}
interface Content extends Record<string, unknown> {
  rows: SimpleRow[];
}

const WEIGHT_TARGET = 1;
const WEIGHT_TOLERANCE = 0.02;

function parseThreshold(hint?: string): number | null {
  if (!hint) return null;
  const m = hint.match(/([\d.]+)/);
  return m ? Number(m[1]) : null;
}

function ratingLabelFor(ratingLabels: RatingLabel[] | undefined, value: number): string | null {
  return ratingLabels?.find((rl) => rl.value === value)?.label ?? null;
}

function MatrizPanel({
  activity,
  session,
  aspirationId,
  participant,
  ratingLabels,
  interpretHint,
  active,
  compact = false,
  heading,
}: {
  activity: ActivityRow;
  session: SessionRow;
  aspirationId: number | null;
  participant: StoredParticipant;
  ratingLabels: RatingLabel[] | undefined;
  interpretHint?: string;
  active: boolean;
  compact?: boolean;
  heading?: { label: string; bgClass: string };
}) {
  const { content, loaded } = useSubmission<Content>(activity, session, aspirationId, participant, { rows: [] });

  if (!active) return null;

  const rows = content.rows.filter((r) => r.factor.trim() !== "");
  const pesoTotal = rows.reduce((a, r) => a + r.peso, 0);
  const total = rows.reduce((a, r) => a + r.peso * (Number(r.calificacion) || 0), 0);
  const pesoOk = Math.abs(pesoTotal - WEIGHT_TARGET) <= WEIGHT_TOLERANCE;
  const threshold = parseThreshold(interpretHint);
  const isStrong = threshold !== null ? total > threshold : null;
  const ranked = [...rows].sort((a, b) => b.peso * b.calificacion - a.peso * a.calificacion);
  const maxPonderado = Math.max(0.01, ...ranked.map((r) => r.peso * r.calificacion));

  if (compact) {
    return (
      <div className="flex w-full max-w-xs flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        {heading && (
          <span className={`self-start rounded-full px-3 py-1 text-xs font-bold text-dark ${heading.bgClass}`}>{heading.label}</span>
        )}
        {!loaded ? (
          <p className="text-sm text-white/40">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-white/40">Sin factores registrados.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wide text-white/50">Ponderado total</span>
              <span className="text-2xl font-bold text-white">{total.toFixed(2)}</span>
            </div>
            {isStrong !== null && (
              <span className={`self-start rounded-full px-2 py-0.5 text-[11px] font-semibold ${isStrong ? "bg-brand/20 text-brand" : "bg-amber-500/20 text-amber-400"}`}>
                {isStrong ? "🟢 Fuerte" : "🟠 Débil"}
              </span>
            )}
            <div className="space-y-1">
              {ranked.slice(0, 3).map((r, i) => (
                <div key={r.id} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 truncate text-white/60" title={r.factor}>
                    {r.factor}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${((r.peso * r.calificacion) / maxPonderado) * 100}%`, backgroundColor: axisColor(i) }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/40">
              {rows.length} {rows.length === 1 ? "factor" : "factores"} · peso {pesoTotal.toFixed(2)}
            </p>
          </>
        )}
      </div>
    );
  }

  if (!loaded) return <div className="flex h-64 items-center justify-center text-sm text-white/40">Cargando…</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wide text-white/50">Peso total</span>
            <span className={`font-bold ${pesoOk ? "text-brand" : "text-red-400"}`}>
              {pesoTotal.toFixed(2)} / {WEIGHT_TARGET.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${pesoOk ? "bg-brand" : "bg-amber-500"}`}
              style={{ width: `${Math.min((pesoTotal / WEIGHT_TARGET) * 100, 100)}%` }}
            />
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wide text-white/50">Puntaje ponderado total</span>
            <span className="text-lg font-bold text-white">{total.toFixed(2)}</span>
          </div>
          {isStrong !== null ? (
            <p className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isStrong ? "bg-brand/20 text-brand" : "bg-amber-500/20 text-amber-400"}`}>
              {isStrong ? "🟢 Posición relativamente fuerte" : "🟠 Posición relativamente débil"}
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-white/40">Sin factores suficientes para interpretar.</p>
          )}
          {interpretHint && <p className="mt-1 text-[11px] text-white/40">{interpretHint}</p>}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-white/40">Aún no hay factores registrados en esta vista.</p>
      ) : (
        <>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">Puntaje ponderado por factor</p>
            <div className="space-y-2">
              {ranked.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 text-sm">
                  <span className="w-48 shrink-0 truncate text-white/70" title={r.factor}>
                    {r.factor}
                  </span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-white/10">
                    <div
                      className="h-full rounded transition-all duration-300 ease-out"
                      style={{ width: `${((r.peso * r.calificacion) / maxPonderado) * 100}%`, backgroundColor: axisColor(i) }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right font-semibold text-white">{(r.peso * r.calificacion).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-sm text-white/80">
              <thead className="bg-white/[0.05] text-white/50">
                <tr>
                  <th className="p-2 text-left font-medium">Factor</th>
                  <th className="p-2 text-left font-medium">Peso</th>
                  <th className="p-2 text-left font-medium">Calificación</th>
                  <th className="p-2 text-left font-medium">Ponderado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="p-2">{r.factor}</td>
                    <td className="p-2">{r.peso.toFixed(2)}</td>
                    <td className="p-2">
                      {r.calificacion}
                      {ratingLabelFor(ratingLabels, r.calificacion) && (
                        <span className="ml-1 text-xs text-white/40">— {ratingLabelFor(ratingLabels, r.calificacion)}</span>
                      )}
                    </td>
                    <td className="p-2 font-semibold text-white">{(r.peso * r.calificacion).toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="border-t border-white/10 bg-white/[0.05] font-semibold text-white">
                  <td className="p-2">Totales</td>
                  <td className="p-2">{pesoTotal.toFixed(2)}</td>
                  <td className="p-2" />
                  <td className="p-2">{total.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function MatrizFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [view, setView] = useState<"consolidado" | number>("consolidado");

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
    fetchActivityById(Number(activityId)).then((a) => {
      setActivity(a);
      if (a) fetchSessionById(a.session_id).then(setSession).catch(console.error);
    });
  }, [activityId]);

  if (!participant || !activity || !session) {
    return <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>;
  }

  if (!presenter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark px-4 text-center text-sm text-white/60">
        Solo el facilitador puede abrir este tablero.
      </div>
    );
  }

  const mode = (activity.config.mode as string) ?? "simple";
  if (mode !== "simple") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark px-4 text-center text-sm text-white/60">
        Este tablero está disponible solo para matrices en modo simple (EFI / EFE).
      </div>
    );
  }

  const perAspiration = Boolean(activity.config.perAspiration);
  const ratingLabels = activity.config.ratingLabels as RatingLabel[] | undefined;
  const interpretHint = activity.config.interpretHint as string | undefined;
  const tabs = perAspiration ? aspirations : [];

  return (
    <div className="min-h-screen bg-dark bg-[radial-gradient(circle_at_50%_0%,rgba(128,198,18,0.08),transparent_60%)] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto brightness-0 invert" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{activity.title}</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name}
          </p>
        </div>
      </div>

      {perAspiration && (
        <div className="mx-auto mt-6 flex max-w-[1400px] flex-wrap gap-2">
          <button
            onClick={() => setView("consolidado")}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              view === "consolidado"
                ? "border-transparent bg-brand text-dark"
                : "border-white/15 bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
            }`}
          >
            📊 Consolidado
          </button>
          {tabs.map((a) => {
            const cls = aspClasses(a.number);
            const active = view === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setView(a.id)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                  active ? `border-transparent ${cls.bg} text-dark` : "border-white/15 bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
                }`}
              >
                Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
              </button>
            );
          })}
        </div>
      )}

      <div className="mx-auto mt-10 max-w-[1400px]">
        {perAspiration ? (
          view === "consolidado" ? (
            <div className="flex flex-wrap items-start justify-center gap-6">
              {aspirations.map((a) => (
                <MatrizPanel
                  key={a.id}
                  activity={activity}
                  session={session}
                  aspirationId={a.id}
                  participant={participant}
                  ratingLabels={ratingLabels}
                  interpretHint={interpretHint}
                  active
                  compact
                  heading={{ label: `Aspiración ${a.number} · ${ARCHETYPE_LABEL[a.number]}`, bgClass: aspClasses(a.number).bg }}
                />
              ))}
            </div>
          ) : (
            aspirations.map((a) => (
              <MatrizPanel
                key={a.id}
                activity={activity}
                session={session}
                aspirationId={a.id}
                participant={participant}
                ratingLabels={ratingLabels}
                interpretHint={interpretHint}
                active={view === a.id}
              />
            ))
          )
        ) : (
          <MatrizPanel
            activity={activity}
            session={session}
            aspirationId={null}
            participant={participant}
            ratingLabels={ratingLabels}
            interpretHint={interpretHint}
            active
          />
        )}
      </div>
    </div>
  );
}
