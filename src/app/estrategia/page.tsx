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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchAspirations().then((rows) => {
      setAspirations(rows);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoaded(true);
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

      <div role="tablist" aria-label="Visuales de la estrategia general" className="mb-5 flex flex-wrap gap-1.5 border-b border-border pb-4">
        {VIEWS.map((v, i) => {
          const active = v.key === view;
          return (
            <button
              key={v.key}
              id={`tab-${v.key}`}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={`panel-${v.key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setView(v.key)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const dir = e.key === "ArrowRight" ? 1 : -1;
                const next = VIEWS[(i + dir + VIEWS.length) % VIEWS.length];
                setView(next.key);
                document.getElementById(`tab-${next.key}`)?.focus();
              }}
              title={v.description}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 ${
                active ? "bg-brand text-dark shadow-sm" : "bg-black/5 text-foreground hover:bg-black/10"
              }`}
            >
              <span aria-hidden>{v.icon}</span>
              {v.label}
            </button>
          );
        })}
      </div>

      {!loaded ? (
        <p className="text-sm text-muted">Cargando la estrategia…</p>
      ) : (
        VIEWS.map((v) => (
          <div key={v.key} role="tabpanel" id={`panel-${v.key}`} aria-labelledby={`tab-${v.key}`} hidden={view !== v.key}>
            {v.key === "organigrama" && <OrgChartView tree={tree} />}
            {v.key === "cascada" && <CascadeMatrixView tree={tree} />}
            {v.key === "impacto" && <ImpactMapView tree={tree} />}
            {v.key === "radial" && <RadialView tree={tree} />}
            {v.key === "gantt" && <RoadmapGanttView tree={tree} />}
          </div>
        ))
      )}
    </div>
  );
}
