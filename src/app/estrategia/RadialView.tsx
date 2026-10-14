"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/budget";
import { aspHex } from "./strategyTree";
import type { ActividadNode, AspiracionNode, MetaNode, ProyectoEstrategicoNode, StrategyTree } from "./strategyTree";

interface Wedge {
  key: string;
  depth: 1 | 2 | 3 | 4;
  a0: number;
  a1: number;
  color: string;
  label: string;
  breadcrumb: string;
  budget: number | null;
}

function partition<T>(nodes: T[], start: number, end: number, weight: (n: T) => number): { node: T; a0: number; a1: number }[] {
  const total = nodes.reduce((s, n) => s + weight(n), 0) || 1;
  const span = end - start;
  let cursor = start;
  return nodes.map((n) => {
    const w = weight(n);
    const a0 = cursor;
    const a1 = cursor + (w / total) * span;
    cursor = a1;
    return { node: n, a0, a1 };
  });
}

const wAct = (_a: ActividadNode) => 1;
const wProy = (p: ProyectoEstrategicoNode) => Math.max(1, p.actividades.length);
const wMeta = (m: MetaNode) => Math.max(1, m.proyectos.reduce((s, p) => s + wProy(p), 0));
const wAsp = (a: AspiracionNode) => Math.max(1, a.metas.reduce((s, m) => s + wMeta(m), 0));

function buildWedges(tree: StrategyTree): Wedge[] {
  const wedges: Wedge[] = [];
  const aspParts = partition(tree.aspiraciones, 0, 360, wAsp);
  for (const { node: asp, a0: aspA0, a1: aspA1 } of aspParts) {
    const color = aspHex(asp.number);
    wedges.push({
      key: `asp-${asp.id}`,
      depth: 1,
      a0: aspA0,
      a1: aspA1,
      color,
      label: `Asp. ${asp.number}`,
      breadcrumb: `Aspiración ${asp.number} · ${asp.archetype} — ${asp.name}`,
      budget: asp.budget,
    });
    const metaParts = partition(asp.metas, aspA0, aspA1, wMeta);
    for (const { node: meta, a0: metaA0, a1: metaA1 } of metaParts) {
      wedges.push({
        key: `meta-${meta.id}`,
        depth: 2,
        a0: metaA0,
        a1: metaA1,
        color,
        label: meta.title,
        breadcrumb: `Aspiración ${asp.number} › ${meta.title}`,
        budget: meta.budget,
      });
      const proyParts = partition(meta.proyectos, metaA0, metaA1, wProy);
      for (const { node: proy, a0: pA0, a1: pA1 } of proyParts) {
        wedges.push({
          key: `proy-${proy.id}`,
          depth: 3,
          a0: pA0,
          a1: pA1,
          color,
          label: proy.nombre,
          breadcrumb: `Aspiración ${asp.number} › ${meta.title} › ${proy.nombre}`,
          budget: proy.promoted ? proy.budget : null,
        });
        const actParts = partition(proy.actividades, pA0, pA1, wAct);
        for (const { node: act, a0: acA0, a1: acA1 } of actParts) {
          wedges.push({
            key: `act-${act.id}`,
            depth: 4,
            a0: acA0,
            a1: acA1,
            color,
            label: act.name,
            breadcrumb: `Aspiración ${asp.number} › ${meta.title} › ${proy.nombre} › ${act.name}`,
            budget: act.budget,
          });
        }
      }
    }
  }
  return wedges;
}

const RING: Record<1 | 2 | 3 | 4, [number, number]> = {
  1: [38, 92],
  2: [92, 142],
  3: [142, 188],
  4: [188, 230],
};
const OPACITY: Record<1 | 2 | 3 | 4, number> = { 1: 1, 2: 0.82, 3: 0.64, 4: 0.46 };

function arcPath(cx: number, cy: number, rInner: number, rOuter: number, a0Deg: number, a1Deg: number): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x = (r: number, a: number) => cx + r * Math.cos(toRad(a));
  const y = (r: number, a: number) => cy + r * Math.sin(toRad(a));
  const largeArc = a1Deg - a0Deg > 180 ? 1 : 0;
  return [
    `M ${x(rOuter, a0Deg)} ${y(rOuter, a0Deg)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x(rOuter, a1Deg)} ${y(rOuter, a1Deg)}`,
    `L ${x(rInner, a1Deg)} ${y(rInner, a1Deg)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x(rInner, a0Deg)} ${y(rInner, a0Deg)}`,
    "Z",
  ].join(" ");
}

export default function RadialView({ tree }: { tree: StrategyTree }) {
  const [selected, setSelected] = useState<Wedge | null>(null);
  const wedges = buildWedges(tree);
  const cx = 240;
  const cy = 240;

  if (tree.aspiraciones.length === 0) {
    return <p className="text-sm text-muted">Aún no hay datos para mostrar en la visión radial.</p>;
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Del centro hacia afuera: propósito, aspiraciones, metas, proyectos estratégicos y actividades — el tamaño de
        cada sector es proporcional a cuántas actividades cuelgan de él. Haz clic en un sector para ver el detalle.
      </p>
      <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center">
        <svg viewBox="0 0 480 480" className="w-full max-w-[480px]">
          {wedges.map((w) => {
            const [rInner, rOuter] = RING[w.depth];
            const pad = Math.min(0.5, (w.a1 - w.a0) * 0.08);
            const isSelected = selected?.key === w.key;
            return (
              <path
                key={w.key}
                d={arcPath(cx, cy, rInner, rOuter, w.a0 + pad, w.a1 - pad)}
                fill={w.color}
                fillOpacity={OPACITY[w.depth]}
                stroke={isSelected ? "var(--foreground)" : "var(--card)"}
                strokeWidth={isSelected ? 2 : 1}
                className="cursor-pointer transition-[stroke-width] duration-150"
                onClick={() => setSelected(w)}
              >
                <title>
                  {w.label}
                  {w.budget !== null ? ` — ${formatMoney(w.budget)}` : ""}
                </title>
              </path>
            );
          })}
          <circle cx={cx} cy={cy} r={36} fill="var(--brand)" fillOpacity={0.18} stroke="var(--brand-dark)" strokeWidth={1.5} className="cursor-pointer" onClick={() => setSelected({ key: "proposito", depth: 1, a0: 0, a1: 0, color: "var(--brand-dark)", label: "Propósito superior", breadcrumb: tree.proposito, budget: tree.totalBudget })} />
          <text x={cx} y={cy - 4} textAnchor="middle" className="fill-brand-dark text-[11px] font-bold">
            Propósito
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" className="fill-muted text-[9px]">
            superior
          </text>
        </svg>

        <div className="w-full max-w-sm shrink-0 space-y-3">
          <div className="min-h-24 rounded-lg border border-border bg-card p-3">
            {selected ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Detalle</p>
                <p className="mt-1 text-sm font-medium text-foreground">{selected.breadcrumb}</p>
                {selected.budget !== null && (
                  <p className="mt-1 text-sm font-semibold tabular-nums text-brand-dark">{formatMoney(selected.budget)}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">Haz clic en el centro o en cualquier sector para ver su detalle aquí.</p>
            )}
          </div>
          <div className="space-y-1.5 text-xs text-muted">
            <p className="font-semibold uppercase tracking-wide">Anillos</p>
            <p>1 · Aspiraciones &nbsp; 2 · Metas &nbsp; 3 · Proyectos estratégicos &nbsp; 4 · Actividades</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tree.aspiraciones.map((a) => (
              <span key={a.id} className="flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-[11px] text-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: aspHex(a.number) }} />
                Asp. {a.number} · {a.archetype}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
