"use client";

import { formatMoney } from "@/lib/budget";
import { aspClasses } from "@/lib/aspirationStyle";
import PropositoBanner from "./PropositoBanner";
import type { ActividadNode, AspiracionNode, MetaNode, ProyectoEstrategicoNode, StrategyTree } from "./strategyTree";

interface CascadeRow {
  asp: AspiracionNode;
  meta: MetaNode | null;
  proyecto: ProyectoEstrategicoNode | null;
  actividad: ActividadNode | null;
}

function buildRows(tree: StrategyTree): CascadeRow[] {
  const rows: CascadeRow[] = [];
  for (const asp of tree.aspiraciones) {
    if (asp.metas.length === 0) {
      rows.push({ asp, meta: null, proyecto: null, actividad: null });
      continue;
    }
    for (const meta of asp.metas) {
      if (meta.proyectos.length === 0) {
        rows.push({ asp, meta, proyecto: null, actividad: null });
        continue;
      }
      for (const proyecto of meta.proyectos) {
        if (proyecto.actividades.length === 0) {
          rows.push({ asp, meta, proyecto, actividad: null });
          continue;
        }
        for (const actividad of proyecto.actividades) rows.push({ asp, meta, proyecto, actividad });
      }
    }
  }
  return rows;
}

function dateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  return `${start ?? "?"} → ${end ?? "?"}`;
}

export default function CascadeMatrixView({ tree }: { tree: StrategyTree }) {
  const rows = buildRows(tree);
  const aspCount: Record<number, number> = {};
  const metaCount: Record<string, number> = {};
  const proyCount: Record<string, number> = {};
  for (const r of rows) {
    aspCount[r.asp.id] = (aspCount[r.asp.id] ?? 0) + 1;
    if (r.meta) metaCount[r.meta.id] = (metaCount[r.meta.id] ?? 0) + 1;
    if (r.proyecto) proyCount[r.proyecto.id] = (proyCount[r.proyecto.id] ?? 0) + 1;
  }
  const seenAsp = new Set<number>();
  const seenMeta = new Set<string>();
  const seenProy = new Set<string>();

  if (rows.length === 0) {
    return (
      <div>
        <PropositoBanner text={tree.proposito} />
        <p className="text-sm text-muted">Aún no hay datos para mostrar en la matriz cascada.</p>
      </div>
    );
  }

  return (
    <div>
      <PropositoBanner text={tree.proposito} />
      <p className="mb-4 text-sm text-muted">
        Cada fila es una actividad del plan de acción; las celdas de la izquierda se fusionan hacia abajo para mostrar
        de qué aspiración, meta y proyecto estratégico se desprende, de arriba hacia abajo.
      </p>
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-border">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="bg-black/[0.03] text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="sticky top-0 z-10 border-b border-border bg-card px-3 py-2">Aspiración</th>
              <th className="sticky top-0 z-10 border-b border-border bg-card px-3 py-2">Meta</th>
              <th className="sticky top-0 z-10 border-b border-border bg-card px-3 py-2">Proyecto estratégico</th>
              <th className="sticky top-0 z-10 border-b border-border bg-card px-3 py-2">Actividad</th>
              <th className="sticky top-0 z-10 border-b border-border bg-card px-3 py-2 text-right">Presupuesto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const tone = aspClasses(r.asp.number);
              const showAsp = !seenAsp.has(r.asp.id);
              if (showAsp) seenAsp.add(r.asp.id);
              const showMeta = r.meta ? !seenMeta.has(r.meta.id) : true;
              if (r.meta && showMeta) seenMeta.add(r.meta.id);
              const showProy = r.proyecto ? !seenProy.has(r.proyecto.id) : true;
              if (r.proyecto && showProy) seenProy.add(r.proyecto.id);
              const activDates = r.actividad ? dateRange(r.actividad.startDate, r.actividad.endDate) : null;

              return (
                <tr key={i} className="align-top hover:bg-black/[0.02]">
                  {showAsp && (
                    <td rowSpan={aspCount[r.asp.id]} className={`border-b border-r border-border px-3 py-2 ${tone.bgSoft}`}>
                      <p className={`text-xs font-bold uppercase tracking-wide ${tone.text}`}>Aspiración {r.asp.number}</p>
                      <p className="text-xs text-foreground">{r.asp.name}</p>
                    </td>
                  )}
                  {r.meta ? (
                    showMeta && (
                      <td rowSpan={metaCount[r.meta.id]} className="border-b border-r border-border px-3 py-2">
                        <p className="font-medium text-foreground">{r.meta.title}</p>
                        {r.meta.isNew && (
                          <span className="mt-1 inline-block rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                            NUEVA
                          </span>
                        )}
                        {r.meta.isUnassigned && <p className="text-[11px] italic text-muted">Sin meta asignada</p>}
                      </td>
                    )
                  ) : (
                    <td className="border-b border-r border-border px-3 py-2 text-xs italic text-muted">Sin metas</td>
                  )}
                  {r.proyecto ? (
                    showProy && (
                      <td rowSpan={proyCount[r.proyecto.id]} className="border-b border-r border-border px-3 py-2">
                        <p className="font-medium text-foreground">
                          {r.proyecto.promoted ? "🚀" : "💡"} {r.proyecto.nombre}
                        </p>
                        {r.proyecto.responsable && <p className="text-[11px] text-muted">Responsable: {r.proyecto.responsable}</p>}
                        {!r.proyecto.promoted && <p className="text-[11px] italic text-amber-700">Aún sin costear</p>}
                      </td>
                    )
                  ) : (
                    <td className="border-b border-r border-border px-3 py-2 text-xs italic text-muted">Sin proyectos</td>
                  )}
                  {r.actividad ? (
                    <td className="border-b border-r border-border px-3 py-2">
                      <p className="text-foreground">{r.actividad.name}</p>
                      {activDates && <p className="text-[11px] tabular-nums text-muted">{activDates}</p>}
                    </td>
                  ) : (
                    <td className="border-b border-r border-border px-3 py-2 text-xs italic text-muted">Sin actividades</td>
                  )}
                  <td className="border-b border-border px-3 py-2 text-right tabular-nums text-foreground">
                    {r.actividad ? formatMoney(r.actividad.budget) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-black/[0.03] font-semibold">
              <td colSpan={4} className="px-3 py-2 text-right text-xs uppercase tracking-wide text-muted">
                Total plan de acción
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-foreground">{formatMoney(tree.totalBudget)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
