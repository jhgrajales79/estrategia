"use client";

import { useState } from "react";
import { aspHex } from "../estrategia/strategyTree";
import { arcPath } from "../estrategia/RadialView";
import { BADGE_TIPOS } from "@/lib/nuevasMetas";
import type { AspiracionNode, MetaNode, MetaTag, StrategyTree } from "../estrategia/strategyTree";

type Depth = 1 | 2 | 3 | 4;

interface Wedge {
  key: string;
  depth: Depth;
  a0: number;
  a1: number;
  color: string;
  label: string;
  breadcrumb: string;
}

const RED = "#dc2626";

function partition<T>(nodes: T[], start: number, end: number, weight: (n: T) => number): { node: T; a0: number; a1: number }[] {
  const total = nodes.reduce((s, n) => s + weight(n), 0) || 1;
  const span = end - start;
  let cursor = start;
  return nodes.map((n) => {
    const a0 = cursor;
    const a1 = cursor + (weight(n) / total) * span;
    cursor = a1;
    return { node: n, a0, a1 };
  });
}

// Todos los badges de la meta, recursos incluidos (en la radial cada uno es un sector del anillo 3).
const metaTags = (m: MetaNode): MetaTag[] => [...(m.tags ?? []), ...(m.recursos ?? [])];
const wTag = (t: MetaTag) => Math.max(1, t.children?.length ?? 0);
const wMeta = (m: MetaNode) => Math.max(1, metaTags(m).reduce((s, t) => s + wTag(t), 0));
const wAsp = (a: AspiracionNode) => Math.max(1, a.metas.reduce((s, m) => s + wMeta(m), 0));

function buildWedges(tree: StrategyTree): Wedge[] {
  const wedges: Wedge[] = [];
  for (const { node: asp, a0, a1 } of partition(tree.aspiraciones, 0, 360, wAsp)) {
    const color = aspHex(asp.number);
    const aspCrumb = `Aspiración ${asp.number} · ${asp.archetype}`;
    wedges.push({ key: `asp-${asp.id}`, depth: 1, a0, a1, color, label: `Asp. ${asp.number}`, breadcrumb: `${aspCrumb} — ${asp.name}` });
    for (const { node: meta, a0: m0, a1: m1 } of partition(asp.metas, a0, a1, wMeta)) {
      const metaCrumb = `Aspiración ${asp.number} › ${meta.title}`;
      wedges.push({ key: `meta-${meta.id}`, depth: 2, a0: m0, a1: m1, color, label: meta.title, breadcrumb: metaCrumb });
      for (const { node: tag, a0: t0, a1: t1 } of partition(metaTags(meta), m0, m1, wTag)) {
        const tagCrumb = `${metaCrumb} › ${tag.subtitle ? `${tag.subtitle}: ` : ""}${tag.label}`;
        wedges.push({ key: `tag-${tag.id}`, depth: 3, a0: t0, a1: t1, color: tag.hex ?? color, label: tag.label, breadcrumb: tagCrumb });
        for (const { node: hijo, a0: h0, a1: h1 } of partition(tag.children ?? [], t0, t1, () => 1)) {
          wedges.push({
            key: `hijo-${hijo.id}`,
            depth: 4,
            a0: h0,
            a1: h1,
            color: hijo.alert ? RED : tag.hex ?? color,
            label: hijo.label,
            breadcrumb: `${tagCrumb} › ${hijo.label}${hijo.alert ? " (marcado en rojo)" : ""}`,
          });
        }
      }
    }
  }
  return wedges;
}

const RING: Record<Depth, [number, number]> = { 1: [38, 92], 2: [92, 142], 3: [142, 188], 4: [188, 230] };
const OPACITY: Record<Depth, number> = { 1: 1, 2: 0.82, 3: 0.7, 4: 0.5 };

// Visión radial de las nuevas metas: del centro hacia afuera propósito, aspiraciones, metas, badges
// (con el color de su tipo, recursos incluidos) e hijos (en rojo los marcados).
export default function RadialNuevasMetas({ tree }: { tree: StrategyTree }) {
  const [selected, setSelected] = useState<Wedge | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const wedges = buildWedges(tree);
  const cx = 240;
  const cy = 240;

  if (tree.aspiraciones.length === 0) {
    return <p className="text-sm text-muted">Aún no hay datos para mostrar en la visión radial.</p>;
  }

  const propositoWedge: Wedge = { key: "proposito", depth: 1, a0: 0, a1: 0, color: "var(--brand-dark)", label: "Propósito superior", breadcrumb: tree.proposito };

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Del centro hacia afuera: propósito, aspiraciones, metas, badges e hijos — el tamaño de cada sector es
        proporcional a cuántos hijos cuelgan de él. Haz clic (o usa Tab + Enter) en un sector para ver el detalle.
      </p>
      <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center">
        <svg viewBox="0 0 480 480" className="w-full max-w-[480px]" role="img" aria-label="Visión radial de las nuevas metas, desde el propósito superior hasta los hijos de cada badge">
          {wedges.map((w) => {
            const [rInner, rOuter] = RING[w.depth];
            const pad = Math.min(0.5, (w.a1 - w.a0) * 0.08);
            const isHovered = hovered === w.key;
            return (
              <path
                key={w.key}
                d={arcPath(cx, cy, rInner, rOuter, w.a0 + pad, w.a1 - pad)}
                fill={w.color}
                fillOpacity={w.color === RED ? 1 : isHovered ? Math.min(1, OPACITY[w.depth] + 0.15) : OPACITY[w.depth]}
                stroke={selected?.key === w.key ? "var(--foreground)" : "var(--card)"}
                strokeWidth={selected?.key === w.key ? 2.5 : 1}
                tabIndex={0}
                role="button"
                aria-label={w.breadcrumb}
                className="cursor-pointer outline-none transition-[fill-opacity,stroke-width] duration-150 focus-visible:[stroke-width:3]"
                onClick={() => setSelected(w)}
                onMouseEnter={() => setHovered(w.key)}
                onMouseLeave={() => setHovered((k) => (k === w.key ? null : k))}
                onFocus={() => setHovered(w.key)}
                onBlur={() => setHovered((k) => (k === w.key ? null : k))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(w);
                  }
                }}
              >
                <title>{w.label}</title>
              </path>
            );
          })}
          <circle
            cx={cx}
            cy={cy}
            r={36}
            fill="var(--brand)"
            fillOpacity={hovered === "proposito" ? 0.3 : 0.18}
            stroke="var(--brand-dark)"
            strokeWidth={selected?.key === "proposito" ? 2.5 : 1.5}
            tabIndex={0}
            role="button"
            aria-label={`Propósito superior — ${tree.proposito}`}
            className="cursor-pointer outline-none focus-visible:[stroke-width:3]"
            onClick={() => setSelected(propositoWedge)}
            onMouseEnter={() => setHovered("proposito")}
            onMouseLeave={() => setHovered((k) => (k === "proposito" ? null : k))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelected(propositoWedge);
              }
            }}
          >
            <title>Propósito superior — {tree.proposito}</title>
          </circle>
          <text x={cx} y={cy - 4} textAnchor="middle" className="pointer-events-none fill-brand-dark text-[11px] font-bold">
            Propósito
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" className="pointer-events-none fill-muted text-[9px]">
            superior
          </text>
        </svg>

        <div className="w-full max-w-sm shrink-0 space-y-3">
          <div className="min-h-24 rounded-lg border border-border bg-card p-3">
            {selected ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Detalle</p>
                <p className="mt-1 text-sm font-medium text-foreground">{selected.breadcrumb}</p>
              </>
            ) : (
              <p className="text-sm text-muted">Haz clic en el centro o en cualquier sector para ver su detalle aquí.</p>
            )}
          </div>
          <div className="space-y-1.5 text-xs text-muted">
            <p className="font-semibold uppercase tracking-wide">Anillos</p>
            <p>1 · Aspiraciones &nbsp; 2 · Metas &nbsp; 3 · Badges &nbsp; 4 · Hijos</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-foreground">
            {tree.aspiraciones.map((a) => (
              <span key={a.id} className="flex items-center gap-1.5 rounded-full border border-border px-2 py-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: aspHex(a.number) }} />
                Asp. {a.number} · {a.archetype}
              </span>
            ))}
            {BADGE_TIPOS.map((t) => (
              <span key={t.tipo} className="flex items-center gap-1.5 rounded-full border border-border px-2 py-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.hex }} />
                {t.icon} {t.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5 rounded-full border border-border px-2 py-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: RED }} />
              Hijo marcado en rojo
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
