"use client";

import { useEffect, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchAspirations, fetchGoals } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { Aspiration, GoalRow } from "@/lib/types";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";

// Propósito superior ratificado en la S3 (Direccionamiento) — ver output "Propósito 'Tejemos
// conexiones...' ratificado como marco del plan" y la Ruta de Planeación Estratégica. No tiene
// campo propio en la base de datos (es un enunciado fijo, no algo que el equipo edite en vivo),
// así que queda como constante aquí, igual que otros enunciados fijos del módulo.
const PROPOSITO = "Tejemos conexiones para incidir en el cuidado del ser humano y la naturaleza";

// Mismas fuentes de datos que /metas (metas vigentes + nuevas ganadoras de la Subasta, actividad
// 18) y el tablero de proyectos estratégicos (actividad 31, "De objetivo a proyecto estratégico",
// ya separado por aspiración). No existe hoy un vínculo de datos entre una meta puntual y el
// proyecto que la implementa, así que "Metas" y "Plan de acción" se muestran como dos ramas
// hermanas bajo cada aspiración, no una anidada dentro de la otra.
const METAS_SUBASTA_ACTIVITY_ID = 18;
const PROYECTOS_ACTIVITY_ID = 31;

interface MetaCandidate {
  id: string;
  text: string;
  aspiration_id?: number | null;
}
interface MetaVote {
  candidate_id: string;
  points: number;
}
interface Project {
  id: string;
  nombre?: string;
  alcance?: string;
  responsable?: string;
}

interface OrgNode {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  tone?: { border: string; bg: string; bgSoft: string; text: string };
  children?: OrgNode[];
}

export default function EstrategiaGeneralPage() {
  const participant = useRequireParticipant();
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [candidates, setCandidates] = useState<MetaCandidate[]>([]);
  const [votes, setVotes] = useState<MetaVote[]>([]);
  const [projectsByAsp, setProjectsByAsp] = useState<Record<number, Project[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["proposito"]));

  useEffect(() => {
    fetchAspirations().then((rows) => {
      setAspirations(rows);
      // Al cargar, el propósito y las 3 aspiraciones arrancan expandidos — las ramas de
      // metas/plan de acción arrancan contraídas para no saturar la primera vista.
      setExpanded((prev) => new Set([...prev, ...rows.map((a) => `asp-${a.id}`)]));
    });
    fetchGoals().then(setGoals);
    (async () => {
      const { data } = await supabase.from("submissions").select("content").eq("activity_id", METAS_SUBASTA_ACTIVITY_ID);
      const rows = (data as { content: { candidates?: MetaCandidate[]; votes?: MetaVote[] } }[] | null) ?? [];
      setCandidates(rows.flatMap((r) => r.content?.candidates ?? []));
      setVotes(rows.flatMap((r) => r.content?.votes ?? []));
    })();
    (async () => {
      const { data } = await supabase.from("submissions").select("aspiration_id,content").eq("activity_id", PROYECTOS_ACTIVITY_ID);
      const rows = (data as { aspiration_id: number | null; content: { projects?: Project[] } }[] | null) ?? [];
      const map: Record<number, Project[]> = {};
      for (const r of rows) {
        if (r.aspiration_id === null) continue;
        map[r.aspiration_id] = (r.content?.projects ?? []).filter((p) => p.nombre?.trim());
      }
      setProjectsByAsp(map);
    })();
  }, []);

  if (!participant) return null;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pointsByCandidate: Record<string, number> = {};
  for (const v of votes) pointsByCandidate[v.candidate_id] = (pointsByCandidate[v.candidate_id] ?? 0) + v.points;
  const winningCandidates = candidates.filter((c) => (pointsByCandidate[c.id] ?? 0) > 0);

  const tree: OrgNode = {
    id: "proposito",
    title: "Propósito superior",
    subtitle: PROPOSITO,
    children: aspirations.map((a) => {
      const cls = aspClasses(a.number);
      const vigentes = goals.filter((g) => g.aspiration_id === a.id && !g.is_new);
      const nuevas = winningCandidates.filter((c) => c.aspiration_id === a.id);
      const proyectos = projectsByAsp[a.id] ?? [];
      return {
        id: `asp-${a.id}`,
        title: `Aspiración ${a.number} · ${ARCHETYPE_LABEL[a.number]}`,
        subtitle: a.name,
        tone: cls,
        children: [
          {
            id: `asp-${a.id}-metas`,
            title: "🎯 Metas y acciones",
            badge: String(vigentes.length + nuevas.length),
            tone: cls,
            children: [
              ...vigentes.map((g) => ({ id: `meta-${g.id}`, title: g.description, tone: cls })),
              ...nuevas.map((c) => ({ id: `meta-cand-${c.id}`, title: c.text, badge: "NUEVA", tone: cls })),
            ],
          },
          {
            id: `asp-${a.id}-plan`,
            title: "🚀 Plan de acción",
            badge: String(proyectos.length),
            tone: cls,
            children: proyectos.map((p) => ({
              id: `proy-${p.id}`,
              title: p.nombre ?? "",
              subtitle: p.responsable ? `Responsable: ${p.responsable}` : undefined,
              tone: cls,
            })),
          },
        ],
      };
    }),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
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

      <h1 className="text-xl font-bold text-dark">Estrategia general</h1>
      <p className="mb-6 text-sm text-muted">
        Del propósito superior a las aspiraciones, sus metas y el plan de acción — haz clic en cualquier nodo para
        contraerlo o expandirlo.
      </p>

      <div className="overflow-x-auto pb-6">
        <ul className="ec-tree min-w-max">
          <OrgNodeItem node={tree} expanded={expanded} onToggle={toggle} isRoot />
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
