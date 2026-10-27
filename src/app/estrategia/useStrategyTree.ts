"use client";

import { useEffect, useState } from "react";
import { fetchAspirations, fetchGoals } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { Aspiration, GoalRow, PlanActionRow, PlanActivityRow, BudgetItemRow } from "@/lib/types";
import { ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import { fetchPlanActions, fetchPlanActivities, fetchBudgetItems } from "@/lib/budget";
import { buildStrategyTree, type StrategyTree, type TableroProject } from "./strategyTree";

// Propósito superior ratificado en la S3 (Direccionamiento) — ver output "Propósito 'Tejemos
// conexiones...' ratificado como marco del plan" y la Ruta de Planeación Estratégica. No tiene
// campo propio en la base de datos (es un enunciado fijo, no algo que el equipo edite en vivo),
// así que queda como constante aquí, igual que otros enunciados fijos del módulo.
export const PROPOSITO = "Tejemos conexiones para incidir en el cuidado del ser humano y la naturaleza";

// Mismas fuentes de datos que /metas (metas vigentes + nuevas ganadoras de la Subasta, actividad
// 18, fija en toda la app — ver TableroProyectos.tsx/metas/page.tsx) y el tablero de proyectos
// estratégicos ("De objetivo a proyecto estratégico" en S6, actividad 31 por defecto, pero
// configurable vía `proyectosActivityId` para que un tablero ligado a una actividad concreta use
// el `actionsFrom` real de esa actividad en vez de asumir siempre 31).
const METAS_SUBASTA_ACTIVITY_ID = 18;
const DEFAULT_PROYECTOS_ACTIVITY_ID = 31;

interface MetaCandidate {
  id: string;
  text: string;
  aspiration_id?: number | null;
}
interface MetaVote {
  candidate_id: string;
  points: number;
}

// Arma el mismo StrategyTree (propósito → aspiración → meta → proyecto estratégico → actividad)
// que consumen las 5 visuales, con los datos reales en vivo — para que /estrategia y cualquier
// otro tablero que quiera mostrar las mismas visuales no dupliquen esta lógica de carga/enlace.
export function useStrategyTree(proyectosActivityId: number = DEFAULT_PROYECTOS_ACTIVITY_ID): { tree: StrategyTree; loaded: boolean } {
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [candidates, setCandidates] = useState<MetaCandidate[]>([]);
  const [votes, setVotes] = useState<MetaVote[]>([]);
  const [projectsByAsp, setProjectsByAsp] = useState<Record<number, TableroProject[]>>({});
  const [planActions, setPlanActions] = useState<PlanActionRow[]>([]);
  const [planActivities, setPlanActivities] = useState<PlanActivityRow[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItemRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadMetasSubasta() {
      const { data } = await supabase.from("submissions").select("content").eq("activity_id", METAS_SUBASTA_ACTIVITY_ID);
      const rows = (data as { content: { candidates?: MetaCandidate[]; votes?: MetaVote[] } }[] | null) ?? [];
      setCandidates(rows.flatMap((r) => r.content?.candidates ?? []));
      setVotes(rows.flatMap((r) => r.content?.votes ?? []));
    }
    async function loadProyectos() {
      const { data } = await supabase.from("submissions").select("aspiration_id,content").eq("activity_id", proyectosActivityId);
      const rows = (data as { aspiration_id: number | null; content: { projects?: TableroProject[] } }[] | null) ?? [];
      const map: Record<number, TableroProject[]> = {};
      for (const r of rows) {
        if (r.aspiration_id === null) continue;
        map[r.aspiration_id] = (r.content?.projects ?? []).filter((p) => p.nombre?.trim());
      }
      setProjectsByAsp(map);
    }

    fetchAspirations().then((rows) => {
      setAspirations(rows);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoaded(true);
    });
    fetchGoals().then(setGoals);
    loadMetasSubasta();
    loadProyectos();
    fetchPlanActions().then(setPlanActions);
    fetchPlanActivities().then(setPlanActivities);
    fetchBudgetItems().then(setBudgetItems);

    // En vivo: cualquier cambio en metas, el plan de acción costeado o el tablero de proyectos
    // del taller S6 recalcula el árbol — las 5 visuales nunca quedan mostrando datos viejos.
    const channel = supabase
      .channel(`strategy-tree-${proyectosActivityId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, () => fetchGoals().then(setGoals))
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_actions" }, () => fetchPlanActions().then(setPlanActions))
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_activities" }, () => fetchPlanActivities().then(setPlanActivities))
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_items" }, () => fetchBudgetItems().then(setBudgetItems))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${METAS_SUBASTA_ACTIVITY_ID}` },
        loadMetasSubasta,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${proyectosActivityId}` },
        loadProyectos,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [proyectosActivityId]);

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

  return { tree, loaded };
}
