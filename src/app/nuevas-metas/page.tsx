"use client";

import { useEffect, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchAspirations } from "@/lib/data";
import type { Aspiration } from "@/lib/types";
import { ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import { PROPOSITO } from "../estrategia/useStrategyTree";
import OrgChartView from "../estrategia/OrgChartView";
import type { StrategyTree } from "../estrategia/strategyTree";

// Nuevas metas acordadas para cada aspiración — enunciados fijos (no salen de la Subasta ni de la
// tabla goals), enlazados por el NÚMERO de la aspiración, no por su id en la base de datos.
const NUEVAS_METAS: { aspiracion: number; texto: string }[] = [
  { aspiracion: 2, texto: "Líneas de servicio" },
  { aspiracion: 2, texto: "Capacidades y tendencias" },
  { aspiracion: 2, texto: "Anticipación tendencias / oportunidades" },
  { aspiracion: 1, texto: "Gestión del conocimiento" },
  { aspiracion: 2, texto: "IA / tecnología al servicio de SOCYA" },
  { aspiracion: 3, texto: "Optimización organizacional → Competitividad (eficiencia operativa) ERP" },
  { aspiracion: 1, texto: "Retención talento Vs Rotación" },
  { aspiracion: 2, texto: "Coworking" },
  { aspiracion: 3, texto: "Posicionamiento de marca" },
  { aspiracion: 3, texto: "Sostenibilidad financiera" },
];

// Propósito → aspiraciones → nuevas metas, sin proyectos ni presupuesto: reutiliza el organigrama
// de "Estrategia general" con un StrategyTree recortado a esos tres niveles.
function buildTree(aspirations: Aspiration[]): StrategyTree {
  return {
    proposito: PROPOSITO,
    totalBudget: 0,
    aspiraciones: aspirations.map((a) => ({
      id: a.id,
      number: a.number,
      name: a.name,
      archetype: ARCHETYPE_LABEL[a.number] ?? "",
      budget: 0,
      metas: NUEVAS_METAS.filter((m) => m.aspiracion === a.number).map((m, i) => ({
        id: `nueva-${a.number}-${i}`,
        title: m.texto,
        isNew: false,
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
      {!loaded ? <p className="text-sm text-muted">Cargando la estrategia…</p> : (
        <OrgChartView
          tree={buildTree(aspirations)}
          intro="Del propósito superior a las aspiraciones y sus nuevas metas — haz clic en cualquier nodo para contraerlo o expandirlo."
        />
      )}
    </div>
  );
}
