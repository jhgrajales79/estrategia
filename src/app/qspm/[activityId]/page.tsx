"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchAspirations, fetchSessionById } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import BarChart from "@/components/charts/BarChart";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";

interface SourceRow {
  id: string;
  factor: string;
  peso: number;
}
interface CustomFactor {
  id: string;
  factor: string;
  peso: number;
}
interface Strategy {
  id: string;
  name: string;
  originLabels?: string[];
}
interface Content extends Record<string, unknown> {
  activeKeys: string[];
  customFactors: CustomFactor[];
  strategies: Strategy[];
  ratings: Record<string, Record<string, number>>;
}
interface FactorRow {
  key: string;
  factor: string;
  peso: number;
  origin: "EFI" | "EFE" | "Personalizado";
}
interface StrategyResult {
  aspNumber: number;
  name: string;
  total: number;
  pesoSum: number;
  rows: { factor: FactorRow; rating: number }[];
}

function gaugePoint(value: number, max: number) {
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const angle = 180 - 180 * fraction;
  const rad = (angle * Math.PI) / 180;
  return { x: Math.round((100 + 80 * Math.cos(rad)) * 10) / 10, y: Math.round((100 - 80 * Math.sin(rad)) * 10) / 10 };
}

function Gauge({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const p = gaugePoint(value, max);
  return (
    <svg viewBox="0 0 200 112" className="w-28 shrink-0 overflow-visible" role="img" aria-label={`${value.toFixed(2)} de un máximo de ${max.toFixed(2)}`}>
      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" className="text-black/10" stroke="currentColor" strokeWidth="13" strokeLinecap="round" />
      <path d={`M 20 100 A 80 80 0 0 1 ${p.x} ${p.y}`} fill="none" className={colorClass} stroke="currentColor" strokeWidth="13" strokeLinecap="round" />
      <circle cx={p.x} cy={p.y} r="5.5" className="fill-card" />
      <g fontSize="10" className="fill-muted">
        <text x="4" y="108">0</text>
        <text x="196" y="108" textAnchor="end">{max.toFixed(1)}</text>
      </g>
    </svg>
  );
}

async function loadAspirationResults(activity: ActivityRow, asp: Aspiration): Promise<StrategyResult[]> {
  const [efiFrom, efeFrom] = (activity.config.inputsFrom as number[]) ?? [];
  const [efi, efe, own] = await Promise.all([
    supabase.from("submissions").select("content").eq("activity_id", efiFrom).eq("aspiration_id", asp.id).maybeSingle(),
    supabase.from("submissions").select("content").eq("activity_id", efeFrom).eq("aspiration_id", asp.id).maybeSingle(),
    supabase.from("submissions").select("content").eq("activity_id", activity.id).eq("aspiration_id", asp.id).maybeSingle(),
  ]);
  const content = (own.data?.content as Content | null) ?? { activeKeys: [], customFactors: [], strategies: [], ratings: {} };
  const efiRows = ((efi.data?.content as { rows?: SourceRow[] } | null)?.rows ?? []).filter((r) => r.factor.trim());
  const efeRows = ((efe.data?.content as { rows?: SourceRow[] } | null)?.rows ?? []).filter((r) => r.factor.trim());
  const allFactors: FactorRow[] = [
    ...efiRows.map((r) => ({ key: `efi:${r.id}`, factor: r.factor, peso: r.peso, origin: "EFI" as const })),
    ...efeRows.map((r) => ({ key: `efe:${r.id}`, factor: r.factor, peso: r.peso, origin: "EFE" as const })),
    ...content.customFactors.map((c) => ({ key: `custom:${c.id}`, factor: c.factor, peso: c.peso, origin: "Personalizado" as const })),
  ];
  const activeFactors = allFactors.filter((f) => content.activeKeys.includes(f.key));
  return content.strategies.map((s) => {
    const rows = activeFactors.map((f) => ({ factor: f, rating: content.ratings[f.key]?.[s.id] ?? 0 }));
    const total = rows.reduce((a, r) => a + r.factor.peso * r.rating, 0);
    const pesoSum = activeFactors.reduce((a, f) => a + f.peso, 0);
    return { aspNumber: asp.number, name: s.name || "(sin nombre)", total, pesoSum, rows };
  });
}

// Tablero proyectable de la Priorización QSPM: todas las estrategias de las 3 aspiraciones, cada
// una con su propia tarjeta (misma línea gráfica que el ejemplo guiado dentro de la actividad) más
// una calificación global que las compara a todas en un solo ranking, sin importar de qué
// aspiración vengan.
export default function QspmFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [resultsByAsp, setResultsByAsp] = useState<Map<number, StrategyResult[]>>(new Map());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
    fetchActivityById(Number(activityId)).then((a) => {
      setActivity(a);
      if (a) fetchSessionById(a.session_id).then(setSession).catch(console.error);
    });
  }, [activityId]);

  useEffect(() => {
    if (!activity || aspirations.length === 0) return;
    const [efiFrom, efeFrom] = (activity.config.inputsFrom as number[]) ?? [];
    async function load() {
      if (!activity) return;
      const entries = await Promise.all(aspirations.map((a) => loadAspirationResults(activity, a).then((r) => [a.id, r] as const)));
      setResultsByAsp(new Map(entries));
      setLoaded(true);
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`qspm-board-${activityId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${activity.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${efiFrom}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${efeFrom}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, aspirations.length, activityId]);

  if (!participant || !activity || !session || !loaded) {
    return <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>;
  }
  if (!presenter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark px-4 text-center text-sm text-white/60">
        Solo el facilitador puede abrir este tablero.
      </div>
    );
  }

  const allResults = aspirations.flatMap((a) => resultsByAsp.get(a.id) ?? []);
  const globalRanked = [...allResults].sort((a, b) => b.total - a.total);

  return (
    <div className="min-h-screen bg-dark bg-[radial-gradient(circle_at_50%_0%,rgba(128,198,18,0.08),transparent_60%)] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto brightness-0 invert" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{activity.title}</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
          {allResults.length} {allResults.length === 1 ? "estrategia" : "estrategias"}
        </span>
      </div>

      {globalRanked.length > 0 && (
        <div className="mx-auto mt-8 max-w-[1500px] rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">
            Calificación global · ranking de las {globalRanked.length} estrategias, sin importar la aspiración
          </p>
          <BarChart
            bars={globalRanked.map((r) => ({
              label: `${r.name} (Asp. ${r.aspNumber})`,
              value: Number(r.total.toFixed(2)),
              colorClass: aspClasses(r.aspNumber).bg,
            }))}
          />
        </div>
      )}

      <div className="mx-auto mt-8 grid max-w-[1500px] gap-5 md:grid-cols-3">
        {aspirations.map((asp) => {
          const cls = aspClasses(asp.number);
          const results = resultsByAsp.get(asp.id) ?? [];
          return (
            <div key={asp.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cls.bg}`} />
                <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Aspiración {asp.number} · {ARCHETYPE_LABEL[asp.number]}
                </p>
                <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/60">{results.length}</span>
              </div>

              {results.length === 0 ? (
                <p className="py-10 text-center text-sm italic text-white/30">Aún sin estrategias creadas.</p>
              ) : (
                <div className="space-y-3">
                  {[...results]
                    .sort((a, b) => b.total - a.total)
                    .map((r, i) => {
                      const max = Math.max(r.pesoSum * 4, r.total, 0.01);
                      return (
                        <div key={i} className="overflow-hidden rounded-lg bg-card text-foreground">
                          <div className={`h-1.5 ${cls.bg}`} />
                          <div className="p-3">
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <h3 className="text-sm font-bold leading-snug">{r.name}</h3>
                              {i === 0 && (
                                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${cls.bgSoft} ${cls.text}`}>🏆 #1</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Gauge value={r.total} max={max} colorClass={cls.text} />
                              <div>
                                <p className="font-mono text-xl font-extrabold">
                                  {r.total.toFixed(2)}
                                  <span className="text-xs font-normal text-muted"> /{max.toFixed(2)}</span>
                                </p>
                                <p className="text-[10px] text-muted">puntaje total ponderado</p>
                              </div>
                            </div>
                            {r.rows.length > 0 && (
                              <div className="mt-2 overflow-x-auto rounded border border-border">
                                <table className="w-full text-[11px]">
                                  <thead className="bg-black/[0.03] text-muted">
                                    <tr>
                                      <th className="p-1 text-left font-medium">Factor</th>
                                      <th className="p-1 text-right font-medium">Peso</th>
                                      <th className="p-1 text-right font-medium">AS</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.rows.map((row) => (
                                      <tr key={row.factor.key} className="border-t border-border">
                                        <td className="p-1">
                                          <span className="mr-1 rounded bg-black/5 px-1 text-[9px] font-bold text-muted">{row.factor.origin}</span>
                                          {row.factor.factor}
                                        </td>
                                        <td className="p-1 text-right tabular-nums">{row.factor.peso.toFixed(2)}</td>
                                        <td className="p-1 text-right tabular-nums">{row.rating || "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
