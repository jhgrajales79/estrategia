"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/budget";
import { aspClasses } from "@/lib/aspirationStyle";
import type { ProyectoEstrategicoNode, StrategyTree } from "./strategyTree";

type ViewMode = "week" | "month";
const PX_PER_DAY: Record<ViewMode, number> = { week: 10, month: 3.4 };
const MONTH_LABEL = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function toDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Si el proyecto estratégico no tiene fechas propias, se infieren a partir del rango que cubren
// sus actividades — para que igual aparezca una barra consolidada en el roadmap.
function proyectoRange(p: ProyectoEstrategicoNode): [Date, Date] | null {
  const start = toDate(p.startDate);
  const end = toDate(p.endDate);
  if (start && end) return [start, end];
  const dates = p.actividades.flatMap((a) => [toDate(a.startDate), toDate(a.endDate)]).filter((d): d is Date => d !== null);
  if (dates.length === 0) return null;
  return [new Date(Math.min(...dates.map((d) => d.getTime()))), new Date(Math.max(...dates.map((d) => d.getTime())))];
}

export default function RoadmapGanttView({ tree }: { tree: StrategyTree }) {
  const [view, setView] = useState<ViewMode>("month");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const allDates = useMemo(() => {
    const dates: Date[] = [];
    for (const asp of tree.aspiraciones) {
      for (const meta of asp.metas) {
        for (const p of meta.proyectos) {
          const range = proyectoRange(p);
          if (range) dates.push(range[0], range[1]);
          for (const act of p.actividades) {
            const s = toDate(act.startDate);
            const e = toDate(act.endDate);
            if (s) dates.push(s);
            if (e) dates.push(e);
          }
        }
      }
    }
    return dates;
  }, [tree]);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (allDates.length === 0) {
    return <p className="text-sm text-muted">Aún no hay fechas programadas en el plan de acción para mostrar un roadmap.</p>;
  }

  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
  const rangeStart = addDays(minDate, -10);
  const rangeEnd = addDays(maxDate, 10);
  const totalDays = daysBetween(rangeStart, rangeEnd);
  const pxPerDay = PX_PER_DAY[view];
  const timelineWidth = totalDays * pxPerDay;

  function barStyle(start: Date, end: Date): { left: string; width: string } {
    const left = daysBetween(rangeStart, start) * pxPerDay;
    const width = Math.max(4, daysBetween(start, end) * pxPerDay);
    return { left: `${left}px`, width: `${width}px` };
  }

  const ticks: { key: string; left: number; label: string }[] = [];
  {
    let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (cursor <= rangeEnd) {
      ticks.push({
        key: isoDate(cursor),
        left: daysBetween(rangeStart, cursor) * pxPerDay,
        label: `${MONTH_LABEL[cursor.getMonth()]} ${cursor.getFullYear()}`,
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Línea de tiempo consolidada del plan de acción — cada proyecto estratégico y sus actividades, con fechas
          reales.
        </p>
        <div className="flex shrink-0 rounded-md border border-border bg-card p-0.5">
          {(["week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                view === v ? "bg-brand text-dark" : "text-muted hover:bg-black/5"
              }`}
            >
              {v === "week" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <div className="inline-block min-w-full">
          <div className="flex">
            <div className="sticky left-0 z-10 w-72 shrink-0 border-r border-border bg-card" />
            <div className="relative shrink-0 border-b border-border bg-black/[0.02]" style={{ width: timelineWidth, height: 26 }}>
              {ticks.map((t) => (
                <div
                  key={t.key}
                  className="absolute top-0 flex h-full items-center border-l border-border/60 pl-1 text-[10px] text-muted"
                  style={{ left: t.left }}
                >
                  {t.label}
                </div>
              ))}
            </div>
          </div>

          {tree.aspiraciones.map((asp) => {
            const tone = aspClasses(asp.number);
            const aspKey = `asp-${asp.id}`;
            const aspOpen = !collapsed.has(aspKey);
            return (
              <div key={asp.id}>
                <div className={`flex ${tone.bgSoft}`}>
                  <button
                    type="button"
                    onClick={() => toggle(aspKey)}
                    className="sticky left-0 z-10 flex w-72 shrink-0 items-center gap-1.5 border-r border-b border-border px-2 py-1.5 text-left"
                  >
                    <span className="text-xs text-muted">{aspOpen ? "▾" : "▸"}</span>
                    <span className={`truncate text-xs font-bold uppercase tracking-wide ${tone.text}`}>
                      Aspiración {asp.number} · {asp.archetype}
                    </span>
                  </button>
                  <div className="relative shrink-0 border-b border-border" style={{ width: timelineWidth, height: 32 }} />
                </div>

                {aspOpen &&
                  asp.metas.map((meta) => (
                    <div key={meta.id}>
                      <div className="flex">
                        <div
                          className="sticky left-0 z-10 w-72 shrink-0 truncate border-r border-b border-border bg-card px-3 py-1 text-[11px] font-medium text-foreground"
                          title={meta.title}
                        >
                          {meta.title}
                        </div>
                        <div className="relative shrink-0 border-b border-border" style={{ width: timelineWidth, height: 24 }} />
                      </div>

                      {meta.proyectos.map((p) => {
                        const range = proyectoRange(p);
                        return (
                          <div key={p.id}>
                            <div className="flex">
                              <div
                                className="sticky left-0 z-10 flex w-72 shrink-0 items-center gap-1 truncate border-r border-b border-border bg-card py-1 pl-6 pr-2 text-xs text-foreground"
                                title={p.nombre}
                              >
                                <span>{p.promoted ? "🚀" : "💡"}</span>
                                <span className="truncate">{p.nombre}</span>
                              </div>
                              <div className="relative shrink-0 border-b border-border" style={{ width: timelineWidth, height: 28 }}>
                                {range && (
                                  <div
                                    className={`absolute top-1.5 h-4 rounded ${tone.bg}`}
                                    style={barStyle(range[0], range[1])}
                                    title={`${p.nombre}\n${isoDate(range[0])} → ${isoDate(range[1])}\n${
                                      p.promoted ? formatMoney(p.budget) : "Aún sin costear"
                                    }`}
                                  />
                                )}
                              </div>
                            </div>
                            {p.actividades.map((act) => {
                              const s = toDate(act.startDate);
                              const e = toDate(act.endDate);
                              return (
                                <div key={act.id} className="flex">
                                  <div
                                    className="sticky left-0 z-10 w-72 shrink-0 truncate border-r border-b border-border bg-card py-1 pl-10 pr-2 text-[11px] text-muted"
                                    title={act.name}
                                  >
                                    {act.name}
                                  </div>
                                  <div className="relative shrink-0 border-b border-border" style={{ width: timelineWidth, height: 22 }}>
                                    {s && e && (
                                      <div
                                        className={`absolute top-1 h-3 rounded-sm border ${tone.border} ${tone.bgSoft}`}
                                        style={barStyle(s, e)}
                                        title={`${act.name}\n${isoDate(s)} → ${isoDate(e)}\n${formatMoney(act.budget)}`}
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
