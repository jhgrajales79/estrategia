import type { PlanActionRow, PlanActivityRow, BudgetItemRow } from "@/lib/types";

// Modelo único que alimenta las 5 visuales de "Estrategia general" — se arma una sola vez a
// partir de los datos reales (metas, tablero de proyectos S6, plan de acción costeado) y cada
// visual simplemente lo recorre a su manera, sin repetir la lógica de enlace entre tablas.
//
// Un proyecto del taller (TableroProyectos, activity 31) y su "Proyecto estratégico" costeado
// (plan_actions, una vez promovido) son la MISMA cosa en dos momentos — no dos niveles distintos.
// Antes de promoverlo solo existe la idea (promoted=false, sin actividades ni presupuesto);
// después, el nombre/responsable/fechas que mandan son los de plan_actions (pueden haberse
// editado ahí). Fusionarlos en un solo nivel evita el nivel duplicado que mostraba el mismo
// nombre dos veces en el árbol.

export interface TableroProject {
  id: string;
  nombre?: string;
  alcance?: string;
  responsable?: string;
  meta_id?: string;
}

export interface ActividadNode {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  budget: number;
}

export interface ProyectoEstrategicoNode {
  id: string;
  nombre: string;
  responsable: string | null;
  startDate: string | null;
  endDate: string | null;
  // false = todavía es solo la idea del taller S6, aún no se ha costeado en el plan de acción.
  promoted: boolean;
  budget: number;
  actividades: ActividadNode[];
}

export interface MetaNode {
  id: string;
  title: string;
  isNew: boolean;
  isUnassigned?: boolean;
  budget: number;
  proyectos: ProyectoEstrategicoNode[];
}

export interface AspiracionNode {
  id: number;
  number: number;
  name: string;
  archetype: string;
  budget: number;
  metas: MetaNode[];
}

export interface StrategyTree {
  proposito: string;
  totalBudget: number;
  aspiraciones: AspiracionNode[];
}

export function aspHex(number: number | null | undefined): string {
  // Mismo cruce 2↔3 que aspClasses (lib/aspirationStyle.ts): el color sigue al arquetipo de
  // marca, no al número de aspiración.
  switch (number) {
    case 1:
      return "var(--asp-1)";
    case 2:
      return "var(--asp-3)";
    case 3:
      return "var(--asp-2)";
    default:
      return "var(--muted)";
  }
}

export function buildStrategyTree(input: {
  proposito: string;
  aspirations: { id: number; number: number; name: string }[];
  archetypeLabel: Record<number, string>;
  goalsVigentes: { id: number; aspiration_id: number; description: string }[];
  metasNuevas: { id: string; text: string; aspiration_id?: number | null }[];
  projectsByAsp: Record<number, TableroProject[]>;
  planActions: PlanActionRow[];
  planActivities: PlanActivityRow[];
  budgetItems: BudgetItemRow[];
}): StrategyTree {
  const actionsByProject: Record<string, PlanActionRow[]> = {};
  for (const action of input.planActions) {
    if (!action.source_project_id) continue;
    (actionsByProject[action.source_project_id] ??= []).push(action);
  }
  const activitiesByAction: Record<number, PlanActivityRow[]> = {};
  for (const act of input.planActivities) (activitiesByAction[act.action_id] ??= []).push(act);
  const budgetByActivity: Record<number, number> = {};
  for (const item of input.budgetItems) {
    budgetByActivity[item.plan_activity_id] = (budgetByActivity[item.plan_activity_id] ?? 0) + item.approved;
  }

  function buildActividad(act: PlanActivityRow): ActividadNode {
    return { id: act.id, name: act.name, startDate: act.start_date, endDate: act.end_date, budget: budgetByActivity[act.id] ?? 0 };
  }

  function buildProyecto(p: TableroProject): ProyectoEstrategicoNode {
    const action = actionsByProject[p.id]?.[0];
    const actividades = action ? (activitiesByAction[action.id] ?? []).map(buildActividad) : [];
    return {
      id: action ? `accion-${action.id}` : `proy-${p.id}`,
      nombre: action?.name ?? p.nombre ?? "Proyecto sin nombre",
      responsable: action?.owner ?? p.responsable ?? null,
      startDate: action?.start_date ?? null,
      endDate: action?.end_date ?? null,
      promoted: Boolean(action),
      budget: actividades.reduce((s, a) => s + a.budget, 0),
      actividades,
    };
  }

  const aspiraciones: AspiracionNode[] = input.aspirations.map((a) => {
    const proyectos = input.projectsByAsp[a.id] ?? [];
    const vigentes = input.goalsVigentes.filter((g) => g.aspiration_id === a.id);
    const nuevas = input.metasNuevas.filter((c) => c.aspiration_id === a.id);

    const metas: MetaNode[] = [
      ...vigentes.map((g) => {
        const metaId = `goal:${g.id}`;
        const proyectosDeMeta = proyectos.filter((p) => p.meta_id === metaId).map(buildProyecto);
        return {
          id: metaId,
          title: g.description,
          isNew: false,
          budget: proyectosDeMeta.reduce((s, p) => s + p.budget, 0),
          proyectos: proyectosDeMeta,
        };
      }),
      ...nuevas.map((c) => {
        const metaId = `cand:${c.id}`;
        const proyectosDeMeta = proyectos.filter((p) => p.meta_id === metaId).map(buildProyecto);
        return {
          id: metaId,
          title: c.text,
          isNew: true,
          budget: proyectosDeMeta.reduce((s, p) => s + p.budget, 0),
          proyectos: proyectosDeMeta,
        };
      }),
    ];

    // Proyectos sin meta asignada (o cuya meta ya no existe) — se muestran aparte para no
    // perderlos, nunca se descartan en silencio.
    const metaIds = new Set(metas.map((m) => m.id));
    const sinMetaProyectos = proyectos.filter((p) => !p.meta_id || !metaIds.has(p.meta_id)).map(buildProyecto);
    if (sinMetaProyectos.length > 0) {
      metas.push({
        id: `asp-${a.id}-sin-meta`,
        title: "Plan de acción sin meta asignada",
        isNew: false,
        isUnassigned: true,
        budget: sinMetaProyectos.reduce((s, p) => s + p.budget, 0),
        proyectos: sinMetaProyectos,
      });
    }

    return {
      id: a.id,
      number: a.number,
      name: a.name,
      archetype: input.archetypeLabel[a.number] ?? "",
      budget: metas.reduce((s, m) => s + m.budget, 0),
      metas,
    };
  });

  return { proposito: input.proposito, totalBudget: aspiraciones.reduce((s, a) => s + a.budget, 0), aspiraciones };
}

// Vista "ajustada" del mismo árbol: solo lo que ya bajó al plan de acción costeado (proyectos
// promovidos a plan_actions) y las metas/aspiraciones que los contienen. Frente a la vista
// "pensada" (todo lo que salió del taller, tenga o no acciones), permite comparar lo planteado
// con lo que de verdad quedó en ejecución. Los presupuestos no cambian: un proyecto sin promover
// no tiene actividades ni presupuesto, así que quitarlo no altera ningún total.
export function ajustarStrategyTree(tree: StrategyTree): StrategyTree {
  const aspiraciones = tree.aspiraciones
    .map((a) => {
      const metas = a.metas
        .map((m) => ({ ...m, proyectos: m.proyectos.filter((p) => p.promoted) }))
        .filter((m) => m.proyectos.length > 0)
        .map((m) => ({ ...m, budget: m.proyectos.reduce((s, p) => s + p.budget, 0) }));
      return { ...a, metas, budget: metas.reduce((s, m) => s + m.budget, 0) };
    })
    .filter((a) => a.metas.length > 0);
  return { ...tree, aspiraciones, totalBudget: aspiraciones.reduce((s, a) => s + a.budget, 0) };
}
