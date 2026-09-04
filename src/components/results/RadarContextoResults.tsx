"use client";

import { useState } from "react";
import RadarChartView, { axisColor } from "@/components/RadarChartView";
import HomologatedRadarView from "@/components/HomologatedRadarView";
import type { HomologSignal } from "@/components/HomologatedRadarView";
import AxisRingsView from "@/components/AxisRingsView";

interface Axis {
  key: string;
  label: string;
}
interface Signal {
  id: string;
  axis: string;
  ring: number;
  text: string;
  round: number;
  author: string;
  aspiration_id: number | null;
}

export default function RadarContextoResults({
  axes,
  rings,
  signals,
  voteTotal,
  winnerByAxis,
  homologSignals,
  large = false,
}: {
  axes: Axis[];
  rings: string[];
  signals: Signal[];
  voteTotal: Record<string, number>;
  winnerByAxis: Record<string, Signal | undefined>;
  homologSignals: HomologSignal[];
  large?: boolean;
}) {
  const [tab, setTab] = useState<"vivo" | "homolog">("vivo");
  const [homologDimension, setHomologDimension] = useState<"anillo" | "eje">("anillo");
  const [homologView, setHomologView] = useState<"general" | 0 | 1 | 2>("general");
  const [homologAxisFilter, setHomologAxisFilter] = useState<string>(axes[0]?.key ?? "");

  const hasVotedSignals = signals.some((s) => (voteTotal[s.id] ?? 0) > 0);
  const hasHomolog = homologSignals.length > 0;
  const chartSize = large ? 560 : 340;

  return (
    <div className="space-y-4">
      {hasHomolog && (
        <div className="mx-auto flex w-fit flex-wrap justify-center gap-1 rounded-full border border-border bg-black/[0.02] p-1">
          <button
            type="button"
            onClick={() => setTab("vivo")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              tab === "vivo" ? "bg-card text-foreground shadow-sm" : "text-muted hover:bg-black/5"
            }`}
          >
            📡 Radar en vivo
          </button>
          <button
            type="button"
            onClick={() => setTab("homolog")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              tab === "homolog" ? "bg-card text-foreground shadow-sm" : "text-muted hover:bg-black/5"
            }`}
          >
            🗂️ Radar homologado
          </button>
        </div>
      )}

      {tab === "vivo" || !hasHomolog ? (
        <div className="flex flex-col items-center gap-4">
          <RadarChartView axes={axes} winnerByAxis={winnerByAxis} voteTotal={voteTotal} size={chartSize} />
          {hasVotedSignals && (
            <div className="w-full space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Señales votadas</p>
              {axes.map((a, i) => {
                const inAxis = signals.filter((s) => s.axis === a.key && (voteTotal[s.id] ?? 0) > 0);
                if (inAxis.length === 0) return null;
                return (
                  <div key={a.key}>
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: axisColor(i) }} />
                      {a.label}
                    </p>
                    <ul className="space-y-1">
                      {inAxis
                        .sort((x, y) => (voteTotal[y.id] ?? 0) - (voteTotal[x.id] ?? 0))
                        .map((s) => (
                          <li key={s.id} className="text-sm text-foreground">
                            {s.text} <span className="text-xs text-muted">· {rings[s.ring] ?? ""} · {voteTotal[s.id] ?? 0} votos</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-1.5 rounded-full border border-border bg-black/[0.02] p-1">
            <button
              type="button"
              onClick={() => setHomologDimension("anillo")}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                homologDimension === "anillo" ? "bg-card text-foreground shadow-sm" : "text-muted hover:bg-black/5"
              }`}
            >
              Por anillo (radar)
            </button>
            <button
              type="button"
              onClick={() => setHomologDimension("eje")}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                homologDimension === "eje" ? "bg-card text-foreground shadow-sm" : "text-muted hover:bg-black/5"
              }`}
            >
              Por eje (barras)
            </button>
          </div>

          {homologDimension === "anillo" ? (
            <>
              <div className="flex flex-wrap justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setHomologView("general")}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                    homologView === "general" ? "border-brand-dark bg-brand/10 text-brand-dark" : "border-border text-muted hover:bg-black/5"
                  }`}
                >
                  📊 General
                </button>
                {rings.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setHomologView(i as 0 | 1 | 2)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                      homologView === i ? "border-brand-dark bg-brand/10 text-brand-dark" : "border-border text-muted hover:bg-black/5"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <HomologatedRadarView
                axes={axes}
                rings={rings}
                signals={homologSignals}
                size={chartSize}
                ringFilter={homologView === "general" ? null : homologView}
              />
            </>
          ) : (
            <>
              <div className="flex flex-wrap justify-center gap-1.5">
                {axes.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setHomologAxisFilter(a.key)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                      homologAxisFilter === a.key ? "border-brand-dark bg-brand/10 text-brand-dark" : "border-border text-muted hover:bg-black/5"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <AxisRingsView
                axisLabel={axes.find((a) => a.key === homologAxisFilter)?.label ?? homologAxisFilter}
                rings={rings}
                signals={homologSignals.filter((s) => s.axis === homologAxisFilter)}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
