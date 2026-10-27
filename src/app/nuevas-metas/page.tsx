"use client";

import { useEffect, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchAspirations } from "@/lib/data";
import type { Aspiration } from "@/lib/types";
import { ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import { PROPOSITO } from "../estrategia/useStrategyTree";
import OrgChartView from "../estrategia/OrgChartView";
import type { StrategyTree } from "../estrategia/strategyTree";
import { BADGE_TIPOS, useNuevaMetaBadges, useNuevasMetas, type NuevaMeta, type NuevaMetaBadge } from "@/lib/nuevasMetas";

// Propósito → aspiraciones → nuevas metas, sin proyectos ni presupuesto: reutiliza el organigrama
// de "Estrategia general" con un StrategyTree recortado a esos tres niveles. Cada meta lleva sus
// badges SINT (foco estratégico, alternativa, tipo de recurso), agrupados por tipo.
function buildTree(aspirations: Aspiration[], nuevasMetas: NuevaMeta[], badges: NuevaMetaBadge[]): StrategyTree {
  return {
    proposito: PROPOSITO,
    totalBudget: 0,
    aspiraciones: aspirations.map((a) => ({
      id: a.id,
      number: a.number,
      name: a.name,
      archetype: ARCHETYPE_LABEL[a.number] ?? "",
      budget: 0,
      metas: nuevasMetas.filter((m) => m.aspiracion === a.number).map((m) => ({
        id: `nueva-${m.key}`,
        title: m.texto,
        isNew: false,
        tags: BADGE_TIPOS.flatMap((t) =>
          badges
            .filter((b) => b.meta_key === m.key && b.tipo === t.tipo && b.parent_id === null)
            .map((b) => ({
              id: b.id,
              label: `${t.icon} ${b.label}`,
              subtitle: t.label,
              className: t.chip,
              children: badges.filter((h) => h.parent_id === b.id).map((h) => ({ id: h.id, label: `↳ ${h.label}`, alert: h.alerta })),
            })),
        ),
        budget: 0,
        proyectos: [],
      })),
    })),
  };
}

export default function NuevasMetasPage() {
  const participant = useRequireParticipant();
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [loaded, setLoaded] = useState(false);
  const badges = useNuevaMetaBadges();
  const { metas, loaded: metasLoaded } = useNuevasMetas();

  useEffect(() => {
    fetchAspirations().then((rows) => {
      setAspirations(rows);
      setLoaded(true);
    });
  }, []);

  if (!participant) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-xl font-bold text-dark">Nuevas metas</h1>
      <p className="mb-5 text-sm text-muted">
        El propósito superior, las aspiraciones y las nuevas metas que se enlazan con cada una.
      </p>
      {!loaded || !metasLoaded ? <p className="text-sm text-muted">Cargando la estrategia…</p> : (
        <OrgChartView
          tree={buildTree(aspirations, metas, badges)}
          columnLabels={["Propósito", "Aspiraciones", "Metas", "Badges", "Hijos"]}
          expandAll
          intro="Del propósito superior a las aspiraciones, sus nuevas metas, sus badges (🎯 foco estratégico, 🔀 alternativa, 🧰 tipo de recurso) y los hijos de cada badge — en rojo los que marcó el facilitador. Haz clic en cualquier nodo para contraerlo o expandirlo."
        />
      )}
    </div>
  );
}
