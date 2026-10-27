"use client";

import { aspClasses } from "@/lib/aspirationStyle";
import PropositoBanner from "../estrategia/PropositoBanner";
import { aspHex } from "../estrategia/strategyTree";
import type { MetaNode, StrategyTree } from "../estrategia/strategyTree";
import { HijoChip, TagChip } from "./chips";

const MONTH_LABEL = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

// Roadmap Gantt de las nuevas metas: una barra por meta con las fechas que el facilitador define en
// SINT (`fechas`, por id de meta del árbol), y debajo sus badges, hijos y recursos.
export default function GanttNuevasMetas({
  tree,
  fechas,
}: {
  tree: StrategyTree;
  fechas: Record<string, { inicio: string | null; fin: string | null }>;
}) {
  const ranges: Record<string, [Date, Date]> = {};
  for (const asp of tree.aspiraciones) {
    for (const m of asp.metas) {
      const start = toDate(fechas[m.id]?.inicio);
      const end = toDate(fechas[m.id]?.fin);
      if (start || end) ranges[m.id] = [start ?? end!, end ?? start!];
    }
  }
  const all = Object.values(ranges).flat();

  if (all.length === 0) {
    return (
      <div>
        <PropositoBanner text={tree.proposito} />
        <p className="text-sm text-muted">
          Aún no hay fechas en las nuevas metas para mostrar un roadmap — el facilitador las define en la pestaña SINT
          de Nuestro trabajo (inicio y fin de cada meta).
        </p>
      </div>
    );
  }

  const minT = Math.min(...all.map((d) => d.getTime()));
  const maxT = Math.max(...all.map((d) => d.getTime()));
  const first = new Date(new Date(minT).getFullYear(), new Date(minT).getMonth(), 1);
  const lastMonth = new Date(new Date(maxT).getFullYear(), new Date(maxT).getMonth() + 1, 1);
  const months: Date[] = [];
  for (let d = new Date(first); d < lastMonth; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d);
  const span = lastMonth.getTime() - first.getTime();
  const pct = (d: Date) => ((d.getTime() - first.getTime()) / span) * 100;
  const monthWidth = 64;
  const timelineWidth = months.length * monthWidth;

  function metaRow(meta: MetaNode, color: string) {
    const range = ranges[meta.id];
    const badges = [...(meta.tags ?? []), ...(meta.recursos ?? [])];
    return (
      <div key={meta.id} className="flex border-b border-border">
        <div className="sticky left-0 z-10 w-72 shrink-0 border-r border-border bg-card px-3 py-2">
          <p className="text-xs font-semibold text-foreground">{meta.title}</p>
          {badges.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {badges.map((t) => (
                <span key={t.id} className="flex flex-wrap items-center gap-0.5">
                  <TagChip tag={t} />
                  {(t.children ?? []).map((c) => (
                    <HijoChip key={c.id} hijo={c} />
                  ))}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="relative shrink-0" style={{ width: timelineWidth }}>
          {range ? (
            <div
              className="absolute top-1/2 h-5 -translate-y-1/2 rounded-md shadow-sm"
              style={{
                left: `${pct(range[0])}%`,
                width: `max(${pct(range[1]) - pct(range[0])}%, 6px)`,
                background: color,
              }}
              title={`${meta.title}: ${range[0].toISOString().slice(0, 10)} → ${range[1].toISOString().slice(0, 10)}`}
            />
          ) : (
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] italic text-muted">Sin fechas</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PropositoBanner text={tree.proposito} />
      <p className="mb-4 text-sm text-muted">
        Línea de tiempo de las nuevas metas con las fechas definidas en SINT; a la izquierda, sus badges e hijos (en
        rojo los marcados por el facilitador).
      </p>
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-border">
        <div className="min-w-max">
          <div className="sticky top-0 z-20 flex border-b border-border bg-card">
            <div className="sticky left-0 z-10 w-72 shrink-0 border-r border-border bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Meta
            </div>
            {months.map((m) => (
              <div key={m.toISOString()} className="shrink-0 border-r border-border/60 py-2 text-center text-[11px] text-muted" style={{ width: monthWidth }}>
                {MONTH_LABEL[m.getMonth()]} {String(m.getFullYear()).slice(2)}
              </div>
            ))}
          </div>
          {tree.aspiraciones.map((asp) => {
            const tone = aspClasses(asp.number);
            return (
              <div key={asp.id}>
                <div className={`sticky left-0 border-b border-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${tone.text} ${tone.bgSoft}`}>
                  Aspiración {asp.number} · {asp.archetype} — <span className="normal-case">{asp.name}</span>
                </div>
                {asp.metas.map((m) => metaRow(m, aspHex(asp.number)))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
