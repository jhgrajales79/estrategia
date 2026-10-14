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
      <style>{`
        .ec-tree, .ec-tree ul { display: flex; list-style: none; margin: 0; padding: 0; }
        .ec-tree { justify-content: center; }
        .ec-tree ul { padding-top: 28px; }
        .ec-tree li {
          position: relative;
          flex: 1;
          text-align: center;
          padding: 28px 10px 0 10px;
          min-width: 180px;
        }
        .ec-tree li::before, .ec-tree li::after {
          content: "";
          position: absolute;
          top: 0;
          right: 50%;
          border-top: 2px solid var(--ec-line, #d1d5db);
          width: 50%;
          height: 28px;
        }
        .ec-tree li::after { right: auto; left: 50%; border-left: 2px solid var(--ec-line, #d1d5db); }
        .ec-tree li:only-child::before, .ec-tree li:only-child::after { display: none; }
        .ec-tree li:only-child { padding-top: 0; }
        .ec-tree li:first-child::before { border: 0 none; }
        .ec-tree li:last-child::after { border: 0 none; }
        .ec-tree li:first-child::after { border-radius: 6px 0 0 0; }
        .ec-tree li:last-child::before { border-radius: 0 6px 0 0; }
        .ec-tree > li { padding-top: 0; }
        .ec-tree > li::before, .ec-tree > li::after { display: none; }
        .ec-tree ul::before {
          content: "";
          position: absolute;
          top: 0;
          left: 50%;
          border-left: 2px solid var(--ec-line, #d1d5db);
          width: 0;
          height: 28px;
        }
      `}</style>

      <p className="mb-4 text-sm text-muted">
        Del propósito superior a las aspiraciones, sus metas, los proyectos estratégicos y sus actividades (con su
        presupuesto) — haz clic en cualquier nodo para contraerlo o expandirlo.
      </p>

      <div className="overflow-x-auto pb-6">
        <ul className="ec-tree min-w-max">
          <OrgNodeItem node={root} expanded={expanded} onToggle={toggle} isRoot />
        </ul>
      </div>
    </div>
  );
}

function OrgNodeItem({
  node,
  expanded,
  onToggle,
  isRoot,
}: {
  node: OrgNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  isRoot?: boolean;
}) {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isOpen = expanded.has(node.id);
  const tone = node.tone;
  return (
    <li>
      <button
        type="button"
        onClick={() => hasChildren && onToggle(node.id)}
        className={`inline-flex max-w-[260px] flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left shadow-sm transition-transform ${
          hasChildren ? "cursor-pointer hover:scale-[1.02]" : "cursor-default"
        } ${
          isRoot
            ? "border-brand bg-brand/10"
            : tone
              ? `${tone.border} ${isOpen ? tone.bgSoft : "bg-card"}`
              : "border-border bg-card"
        }`}
      >
        <div className="flex w-full items-center justify-between gap-2">
          <span className={`text-sm font-semibold ${isRoot ? "text-brand-dark" : tone ? tone.text : "text-foreground"}`}>
            {node.title}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {node.badge && (
              <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-bold text-foreground">{node.badge}</span>
            )}
            {hasChildren && <span className="text-xs text-muted">{isOpen ? "▾" : "▸"}</span>}
          </span>
        </div>
        {node.subtitle && <span className="whitespace-normal break-words text-xs text-muted">{node.subtitle}</span>}
      </button>
      {hasChildren && isOpen && (
        <ul>
          {node.children!.map((child) => (
            <OrgNodeItem key={child.id} node={child} expanded={expanded} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  );
}
