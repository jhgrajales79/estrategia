"use client";

import { Fragment, useEffect, useState } from "react";
import { formatMoney } from "@/lib/budget";
import { aspClasses } from "@/lib/aspirationStyle";
import type { AspiracionNode, MetaNode, ProyectoEstrategicoNode, StrategyTree } from "./strategyTree";

type Tone = ReturnType<typeof aspClasses>;

interface OrgNode {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  tone?: Tone;
  children?: OrgNode[];
}

function proyectoToOrg(p: ProyectoEstrategicoNode, tone: Tone): OrgNode {
  return {
    id: `proy-${p.id}`,
    title: `${p.promoted ? "🚀" : "💡"} ${p.nombre}`,
    subtitle: [p.responsable ? `Responsable: ${p.responsable}` : null, p.promoted ? formatMoney(p.budget) : "Aún sin costear"]
      .filter(Boolean)
      .join(" · "),
    tone,
    children: p.actividades.length > 0 ? p.actividades.map((act) => ({ id: `activ-${act.id}`, title: `🗓️ ${act.name}`, subtitle: formatMoney(act.budget), tone })) : undefined,
  };
}

function metaToOrg(m: MetaNode, tone: Tone): OrgNode {
  return {
    id: `meta-${m.id}`,
    title: m.title,
    badge: m.isNew ? "NUEVA" : m.isUnassigned ? String(m.proyectos.length) : undefined,
    tone,
    children: m.proyectos.length > 0 ? m.proyectos.map((p) => proyectoToOrg(p, tone)) : undefined,
  };
}

function aspToOrg(a: AspiracionNode): OrgNode {
  const tone = aspClasses(a.number);
  return {
    id: `asp-${a.id}`,
    title: `Aspiración ${a.number} · ${a.archetype}`,
    subtitle: a.name,
    tone,
    children: a.metas.map((m) => metaToOrg(m, tone)),
  };
}

// Recorre el árbol completo recolectando todos los ids — para el botón "Expandir todo".
function allIds(node: OrgNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(allIds)];
}

// --- Motor de layout: cada profundidad es una COLUMNA real de ancho fijo (grid, no flex), así
// que un nodo de "Metas" siempre cae exactamente bajo el encabezado "Metas" sin importar qué
// ramas estén expandidas o contraídas a su alrededor — nada de desalineación por título largo o
// corto. La posición vertical de cada nodo se calcula asignando una fila por cada hoja visible
// (de arriba hacia abajo, en el orden del árbol) y haciendo que cada nodo abarque (rowSpan) la
// suma de filas de sus hijos visibles — así un padre siempre queda centrado frente a su rango de
// hijos, igual que un organigrama dibujado a mano.
interface Placed {
  node: OrgNode;
  depth: number;
  rowStart: number;
  rowSpan: number;
  isFirst: boolean;
  isLast: boolean;
}

function isOpenNode(node: OrgNode, expanded: Set<string>): boolean {
  return Boolean(node.children && node.children.length > 0 && expanded.has(node.id));
}

function layoutTree(root: OrgNode, expanded: Set<string>): { placed: Placed[]; totalRows: number; maxDepth: number } {
  const placed: Placed[] = [];
  let cursor = 0;
  let maxDepth = 0;

  function visit(node: OrgNode, depth: number, isFirst: boolean, isLast: boolean): number {
    maxDepth = Math.max(maxDepth, depth);
    if (!isOpenNode(node, expanded)) {
      const rowStart = cursor;
      cursor += 1;
      placed.push({ node, depth, rowStart, rowSpan: 1, isFirst, isLast });
      return 1;
    }
    const rowStart = cursor;
    const children = node.children!;
    let span = 0;
    children.forEach((child, i) => {
      span += visit(child, depth + 1, i === 0, i === children.length - 1);
    });
    placed.push({ node, depth, rowStart, rowSpan: span, isFirst, isLast });
    return span;
  }

  visit(root, 0, true, true);
  return { placed, totalRows: cursor, maxDepth };
}

const COLUMN_LABELS = ["Propósito", "Aspiraciones", "Metas", "Acciones", "Actividades"];
const NODE_COL_WIDTH: Record<number, number> = { 0: 210, 1: 230, 2: 220, 3: 210, 4: 200 };
const CONNECTOR_WIDTH = 40;
const HEADER_ROWS = 1;

const GRID_TEMPLATE_COLUMNS = [0, 1, 2, 3, 4]
  .map((d) => `${NODE_COL_WIDTH[d]}px`)
  .join(` ${CONNECTOR_WIDTH}px `);

// Tamaño de card y grosor tipográfico decrecen con la profundidad — para que el peso visual siga
// la jerarquía (aspiración pesa más que una actividad hoja) en vez de verse todo igual de grande.
const CARD_PAD: Record<number, string> = { 0: "px-3.5 py-3", 1: "px-3 py-2.5", 2: "px-3 py-2", 3: "px-2.5 py-2", 4: "px-2.5 py-1.5" };
const TITLE_SIZE: Record<number, string> = { 0: "text-sm", 1: "text-sm", 2: "text-[13px]", 3: "text-[13px]", 4: "text-xs" };

// Nota: el ancho del conector (after:w-[40px]) debe ir literal — Tailwind no puede generar una
// clase arbitraria interpolada en runtime a partir de CONNECTOR_WIDTH, solo lee el texto fuente.
function connectorClasses(isFirst: boolean, isLast: boolean): string {
  const base =
    "relative before:absolute before:left-0 before:w-0 before:border-l-2 before:border-border after:absolute after:left-0 after:top-1/2 after:h-0 after:w-[40px] after:border-t-2 after:border-border";
  if (isFirst && isLast) return `${base} before:hidden`;
  if (isFirst) return `${base} before:top-1/2 before:bottom-0`;
  if (isLast) return `${base} before:top-0 before:bottom-1/2`;
  return `${base} before:top-0 before:bottom-0`;
}

export default function OrgChartView({ tree, intro }: { tree: StrategyTree; intro?: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["proposito"]));

  useEffect(() => {
    if (tree.aspiraciones.length === 0) return;
    setExpanded((prev) => new Set([...prev, ...tree.aspiraciones.map((a) => `asp-${a.id}`)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.aspiraciones.length]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const root: OrgNode = {
    id: "proposito",
    title: "Propósito superior",
    subtitle: tree.proposito,
    children: tree.aspiraciones.map(aspToOrg),
  };

  const { placed, totalRows, maxDepth } = layoutTree(root, expanded);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {intro ??
            "Del propósito superior a las aspiraciones, sus metas, las acciones y sus actividades (con su presupuesto) — haz clic en cualquier nodo para contraerlo o expandirlo. Las columnas aparecen a medida que expandes cada nivel."}
        </p>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded(new Set(allIds(root)))}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-foreground outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-brand-dark"
          >
            Expandir todo
          </button>
          <button
            type="button"
            onClick={() => setExpanded(new Set(["proposito", ...tree.aspiraciones.map((a) => `asp-${a.id}`)]))}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-foreground outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-brand-dark"
          >
            Contraer todo
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div
          className="grid min-w-max"
          style={{ gridTemplateColumns: GRID_TEMPLATE_COLUMNS, gridTemplateRows: `auto repeat(${totalRows}, minmax(0, auto))` }}
        >
          {COLUMN_LABELS.slice(0, maxDepth + 1).map((label, d) => (
            <div
              key={label}
              style={{ gridColumn: d * 2 + 1, gridRow: 1 }}
              className="sticky top-0 z-20 mb-2 border-b-2 border-brand/40 bg-background pb-2 text-xs font-bold uppercase tracking-wide text-brand-dark"
            >
              {label}
            </div>
          ))}

          {placed.map((p) => {
            const isRoot = p.node.id === root.id;
            return (
              <Fragment key={p.node.id}>
                {!isRoot && (
                  <div
                    style={{ gridColumn: p.depth * 2, gridRow: `${p.rowStart + HEADER_ROWS + 1} / span ${p.rowSpan}` }}
                    className={connectorClasses(p.isFirst, p.isLast)}
                    aria-hidden
                  />
                )}
                <div
                  style={{ gridColumn: p.depth * 2 + 1, gridRow: `${p.rowStart + HEADER_ROWS + 1} / span ${p.rowSpan}` }}
                  className="flex items-center py-1.5"
                >
                  <NodeCard node={p.node} depth={p.depth} isRoot={isRoot} isOpen={expanded.has(p.node.id)} onToggle={toggle} />
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NodeCard({
  node,
  depth,
  isRoot,
  isOpen,
  onToggle,
}: {
  node: OrgNode;
  depth: number;
  isRoot: boolean;
  isOpen: boolean;
  onToggle: (id: string) => void;
}) {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const tone = node.tone;

  return (
    <button
      type="button"
      onClick={() => hasChildren && onToggle(node.id)}
      aria-expanded={hasChildren ? isOpen : undefined}
      className={`relative z-10 flex w-full flex-col items-start gap-0.5 rounded-lg border ${CARD_PAD[depth] ?? "px-2.5 py-1.5"} text-left shadow-sm outline-none transition-transform focus-visible:ring-2 focus-visible:ring-brand-dark ${
        hasChildren ? "cursor-pointer hover:scale-[1.03] hover:shadow-md" : "cursor-default"
      } ${
        isRoot
          ? "border-brand bg-brand/10"
          : tone
            ? `${tone.border} ${isOpen ? tone.bgSoft : "bg-card"}`
            : "border-border bg-card"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className={`${TITLE_SIZE[depth] ?? "text-xs"} font-semibold ${isRoot ? "text-brand-dark" : tone ? tone.text : "text-foreground"}`}>
          {node.title}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {node.badge && (
            <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-bold text-foreground">{node.badge}</span>
          )}
          {hasChildren && <span className="text-xs text-muted">{isOpen ? "▾" : "▸"}</span>}
        </span>
      </div>
      {node.subtitle && <span className="whitespace-normal break-words text-[11px] text-muted">{node.subtitle}</span>}
    </button>
  );
}
