"use client";

import { useState } from "react";
import type { StrategyTree } from "./strategyTree";
import OrgChartView from "./OrgChartView";
import CascadeMatrixView from "./CascadeMatrixView";
import ImpactMapView from "./ImpactMapView";
import RadialView from "./RadialView";
import RoadmapGanttView from "./RoadmapGanttView";

type ViewKey = "organigrama" | "cascada" | "impacto" | "radial" | "gantt";

const VIEWS: { key: ViewKey; label: string; icon: string; description: string }[] = [
  { key: "organigrama", label: "Organigrama", icon: "🗂️", description: "Jerarquía clásica, de arriba hacia abajo." },
  { key: "cascada", label: "Matriz cascada", icon: "🪜", description: "Tabla detallada con las celdas fusionadas por nivel." },
  { key: "impacto", label: "Mapa de impacto", icon: "🎯", description: "Lectura izquierda-derecha: actor → por qué → cómo → qué." },
  { key: "radial", label: "Visión radial", icon: "☀️", description: "Vista circular proporcional al tamaño de cada rama." },
  { key: "gantt", label: "Roadmap Gantt", icon: "📅", description: "Línea de tiempo consolidada con fechas reales." },
];

// Las 5 visuales de "Estrategia general" (propósito → aspiración → meta → proyecto estratégico →
// actividad), empaquetadas para reutilizarse en cualquier tablero que ya tenga un StrategyTree —
// por ejemplo /estrategia y el tablero de presupuesto proyectable.
export default function StrategyViews({ tree, loaded }: { tree: StrategyTree; loaded: boolean }) {
  const [view, setView] = useState<ViewKey>("organigrama");

  return (
    <div>
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
