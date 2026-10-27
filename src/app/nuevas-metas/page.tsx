"use client";

import { useEffect, useMemo, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchAspirations } from "@/lib/data";
import type { Aspiration } from "@/lib/types";
import { ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import { PROPOSITO } from "../estrategia/useStrategyTree";
import OrgChartView from "../estrategia/OrgChartView";
import CascadaNuevasMetas from "./CascadaNuevasMetas";
import ImpactoNuevasMetas from "./ImpactoNuevasMetas";
import RadialNuevasMetas from "./RadialNuevasMetas";
import GanttNuevasMetas from "./GanttNuevasMetas";
import type { MetaTag, StrategyTree } from "../estrategia/strategyTree";
import { BADGE_TIPOS, useNuevaMetaBadges, useNuevasMetas, type NuevaMeta, type NuevaMetaBadge } from "@/lib/nuevasMetas";

type ViewKey = "organigrama" | "cascada" | "impacto" | "radial" | "gantt";

// Las mismas 5 visuales de "Estrategia general", aquí con metas → badges → hijos (+ recursos).
const VIEWS: { key: ViewKey; label: string; icon: string; description: string }[] = [
  { key: "organigrama", label: "Organigrama", icon: "🗂️", description: "Jerarquía clásica, de izquierda a derecha." },
  { key: "cascada", label: "Matriz cascada", icon: "🪜", description: "Tabla detallada con las celdas fusionadas por nivel." },
  { key: "impacto", label: "Mapa de impacto", icon: "🎯", description: "Lectura izquierda-derecha: actor → por qué → cómo → con qué." },
  { key: "radial", label: "Visión radial", icon: "☀️", description: "Vista circular proporcional al tamaño de cada rama." },
  { key: "gantt", label: "Roadmap Gantt", icon: "📅", description: "Línea de tiempo con las fechas de cada meta." },
];

// Badges raíz de un tipo para una meta, cada uno con sus hijos.
function badgeTags(badges: NuevaMetaBadge[], metaKey: string, t: (typeof BADGE_TIPOS)[number]): MetaTag[] {
  return badges
    .filter((b) => b.meta_key === metaKey && b.tipo === t.tipo && b.parent_id === null)
    .map((b) => ({
      id: b.id,
      label: `${t.icon} ${b.label}`,
      subtitle: t.label,
      className: t.chip,
      hex: t.hex,
      children: badges.filter((h) => h.parent_id === b.id).map((h) => ({ id: h.id, label: `↳ ${h.label}`, alert: h.alerta })),
    }));
}

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
        tags: BADGE_TIPOS.filter((t) => t.tipo !== "recurso").flatMap((t) => badgeTags(badges, m.key, t)),
        recursos: BADGE_TIPOS.filter((t) => t.tipo === "recurso").flatMap((t) => badgeTags(badges, m.key, t)),
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
  const [view, setView] = useState<ViewKey>("organigrama");
  const tree = useMemo(() => buildTree(aspirations, metas, badges), [aspirations, metas, badges]);
  const fechas = useMemo(
    () => Object.fromEntries(metas.map((m) => [`nueva-${m.key}`, { inicio: m.fecha_inicio, fin: m.fecha_fin }])),
    [metas],
  );

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
      <div role="tablist" aria-label="Visuales de las nuevas metas" className="mb-5 flex flex-wrap gap-1.5 border-b border-border pb-4">
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
                const next = VIEWS[(i + (e.key === "ArrowRight" ? 1 : -1) + VIEWS.length) % VIEWS.length];
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

      {!loaded || !metasLoaded ? (
        <p className="text-sm text-muted">Cargando la estrategia…</p>
      ) : (
        VIEWS.map((v) => (
          <div key={v.key} role="tabpanel" id={`panel-${v.key}`} aria-labelledby={`tab-${v.key}`} hidden={view !== v.key}>
            {v.key === "organigrama" && (
              <OrgChartView
                tree={tree}
                columnLabels={["Propósito", "Aspiraciones", "Metas", "Badges", "Hijos"]}
                expandAll
                intro="Del propósito superior a las aspiraciones, sus nuevas metas, sus badges (🎯 foco estratégico, 🔀 alternativa) con sus hijos, y a la derecha los 🧰 recursos necesarios que abarcan todos los badges de cada meta — en rojo los que marcó el facilitador. Haz clic en cualquier nodo para contraerlo o expandirlo."
              />
            )}
            {v.key === "cascada" && <CascadaNuevasMetas tree={tree} />}
            {v.key === "impacto" && <ImpactoNuevasMetas tree={tree} />}
            {v.key === "radial" && <RadialNuevasMetas tree={tree} />}
            {v.key === "gantt" && <GanttNuevasMetas tree={tree} fechas={fechas} />}
          </div>
        ))
      )}
    </div>
  );
}
