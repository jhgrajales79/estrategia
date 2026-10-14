"use client";

import { useEffect, useState } from "react";
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

export default function OrgChartView({ tree }: { tree: StrategyTree }) {
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

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Del propósito superior a las aspiraciones, sus metas, los proyectos estratégicos y sus actividades (con su
          presupuesto) — haz clic en cualquier nodo para contraerlo o expandirlo.
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
        <ul className="flex min-w-max items-center py-2">
          <OrgNodeItem node={root} expanded={expanded} onToggle={toggle} depth={0} isRoot />
        </ul>
      </div>
    </div>
  );
}

// Tamaño de card y grosor tipográfico decrecen con la profundidad — para que el peso visual siga
// la jerarquía (aspiración pesa más que una actividad hoja) en vez de verse todo igual de grande.
const CARD_WIDTH: Record<number, string> = { 0: "max-w-[220px]", 1: "max-w-[230px]", 2: "max-w-[220px]", 3: "max-w-[210px]", 4: "max-w-[200px]" };
const CARD_PAD: Record<number, string> = { 0: "px-3.5 py-3", 1: "px-3 py-2.5", 2: "px-3 py-2", 3: "px-2.5 py-2", 4: "px-2.5 py-1.5" };
const TITLE_SIZE: Record<number, string> = { 0: "text-sm", 1: "text-sm", 2: "text-[13px]", 3: "text-[13px]", 4: "text-xs" };

function OrgNodeItem({
  node,
  expanded,
  onToggle,
  isRoot,
  depth,
}: {
  node: OrgNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  isRoot?: boolean;
  depth: number;
}) {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isOpen = expanded.has(node.id);
  const tone = node.tone;

  return (
    <li
      className={
        isRoot
          ? "flex items-center"
          : "relative flex items-center py-2 pl-7 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0 before:border-l-2 before:border-border after:absolute after:left-0 after:top-1/2 after:h-0 after:w-7 after:border-t-2 after:border-border first:before:top-1/2 last:before:bottom-1/2 only:before:hidden"
      }
    >
      <button
        type="button"
        onClick={() => hasChildren && onToggle(node.id)}
        aria-expanded={hasChildren ? isOpen : undefined}
        className={`relative z-10 inline-flex ${CARD_WIDTH[depth] ?? "max-w-[200px]"} flex-col items-start gap-0.5 rounded-lg border ${CARD_PAD[depth] ?? "px-2.5 py-1.5"} text-left shadow-sm outline-none transition-transform focus-visible:ring-2 focus-visible:ring-brand-dark ${
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

      {hasChildren && isOpen && (
        <>
          <span className="h-px w-7 shrink-0 bg-border" aria-hidden />
          <ul className="flex flex-col">
            {node.children!.map((child) => (
              <OrgNodeItem key={child.id} node={child} expanded={expanded} onToggle={onToggle} depth={depth + 1} />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}
