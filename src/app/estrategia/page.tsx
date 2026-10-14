"use client";

import { useEffect, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchAspirations, fetchGoals } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { Aspiration, GoalRow, PlanActionRow, PlanActivityRow, BudgetItemRow } from "@/lib/types";
import { ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import { fetchPlanActions, fetchPlanActivities, fetchBudgetItems } from "@/lib/budget";
import { buildStrategyTree, type TableroProject } from "./strategyTree";
import OrgChartView from "./OrgChartView";
import CascadeMatrixView from "./CascadeMatrixView";
import ImpactMapView from "./ImpactMapView";
import RadialView from "./RadialView";
import RoadmapGanttView from "./RoadmapGanttView";

// Propósito superior ratificado en la S3 (Direccionamiento) — ver output "Propósito 'Tejemos
// conexiones...' ratificado como marco del plan" y la Ruta de Planeación Estratégica. No tiene
// campo propio en la base de datos (es un enunciado fijo, no algo que el equipo edite en vivo),
// así que queda como constante aquí, igual que otros enunciados fijos del módulo.
const PROPOSITO = "Tejemos conexiones para incidir en el cuidado del ser humano y la naturaleza";

// Mismas fuentes de datos que /metas (metas vigentes + nuevas ganadoras de la Subasta, actividad
// 18) y el tablero de proyectos estratégicos (actividad 31, "De objetivo a proyecto estratégico",
// ya separado por aspiración). Cada proyecto lleva un `meta_id` (ver TableroProyectos.tsx) que
// dice a qué meta responde — el plan de acción se anida como hijo de esa meta, no como rama
// aparte. El id de la meta lleva el mismo prefijo que usa TableroProyectos para armar el
// selector ("goal:"/"cand:"), porque viene de dos tablas con formatos de id distintos.
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

type ViewKey = "organigrama" | "cascada" | "impacto" | "radial" | "gantt";

const VIEWS: { key: ViewKey; label: string; icon: string; description: string }[] = [
  { key: "organigrama", label: "Organigrama", icon: "🗂️", description: "Jerarquía clásica, de arriba hacia abajo." },
  { key: "cascada", label: "Matriz cascada", icon: "🪜", description: "Tabla detallada con las celdas fusionadas por nivel." },
  { key: "impacto", label: "Mapa de impacto", icon: "🎯", description: "Lectura izquierda-derecha: actor → por qué → cómo → qué." },
  { key: "radial", label: "Visión radial", icon: "☀️", description: "Vista circular proporcional al tamaño de cada rama." },
  { key: "gantt", label: "Roadmap Gantt", icon: "📅", description: "Línea de tiempo consolidada con fechas reales." },
];

export default function EstrategiaGeneralPage() {
  const participant = useRequireParticipant();
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [candidates, setCandidates] = useState<MetaCandidate[]>([]);
  const [votes, setVotes] = useState<MetaVote[]>([]);
  const [projectsByAsp, setProjectsByAsp] = useState<Record<number, TableroProject[]>>({});
  const [planActions, setPlanActions] = useState<PlanActionRow[]>([]);
  const [planActivities, setPlanActivities] = useState<PlanActivityRow[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItemRow[]>([]);
  const [view, setView] = useState<ViewKey>("organigrama");

  useEffect(() => {
    fetchAspirations().then(setAspirations);
    fetchGoals().then(setGoals);
    (async () => {
      const { data } = await supabase.from("submissions").select("content").eq("activity_id", METAS_SUBASTA_ACTIVITY_ID);
      const rows = (data as { content: { candidates?: MetaCandidate[]; votes?: MetaVote[] } }[] | null) ?? [];
      setCandidates(rows.flatMap((r) => r.content?.candidates ?? []));
      setVotes(rows.flatMap((r) => r.content?.votes ?? []));
    })();
    (async () => {
      const { data } = await supabase.from("submissions").select("aspiration_id,content").eq("activity_id", PROYECTOS_ACTIVITY_ID);
      const rows = (data as { aspiration_id: number | null; content: { projects?: TableroProject[] } }[] | null) ?? [];
      const map: Record<number, TableroProject[]> = {};
      for (const r of rows) {
        if (r.aspiration_id === null) continue;
        map[r.aspiration_id] = (r.content?.projects ?? []).filter((p) => p.nombre?.trim());
      }
      setProjectsByAsp(map);
    })();
    fetchPlanActions().then(setPlanActions);
    fetchPlanActivities().then(setPlanActivities);
    fetchBudgetItems().then(setBudgetItems);
  }, []);

  if (!participant) return null;

  const pointsByCandidate: Record<string, number> = {};
  for (const v of votes) pointsByCandidate[v.candidate_id] = (pointsByCandidate[v.candidate_id] ?? 0) + v.points;
  const winningCandidates = candidates.filter((c) => (pointsByCandidate[c.id] ?? 0) > 0);

  const tree = buildStrategyTree({
    proposito: PROPOSITO,
    aspirations,
    archetypeLabel: ARCHETYPE_LABEL,
    goalsVigentes: goals.filter((g) => !g.is_new),
    metasNuevas: winningCandidates,
    projectsByAsp,
    planActions,
    planActivities,
    budgetItems,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-xl font-bold text-dark">Estrategia general</h1>
      <p className="mb-5 text-sm text-muted">
        Del propósito superior hasta la actividad de menor nivel, con las mismas conexiones reales del sistema — elige
        la visual que mejor responda a lo que necesitas ver.
      </p>

      <div className="mb-5 flex flex-wrap gap-1.5 border-b border-border pb-4">
        {VIEWS.map((v) => {
          const active = v.key === view;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              title={v.description}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                active ? "bg-brand text-dark shadow-sm" : "bg-black/5 text-foreground hover:bg-black/10"
              }`}
            >
              <span>{v.icon}</span>
              {v.label}
            </button>
          );
        })}
      </div>

      {view === "organigrama" && <OrgChartView tree={tree} />}
      {view === "cascada" && <CascadeMatrixView tree={tree} />}
      {view === "impacto" && <ImpactMapView tree={tree} />}
      {view === "radial" && <RadialView tree={tree} />}
      {view === "gantt" && <RoadmapGanttView tree={tree} />}
    </div>
  );
}
