"use client";

import { aspClasses } from "@/lib/aspirationStyle";

interface Level {
  classic: string;
  socya: string;
  aspNumber: number | null;
}

// De abajo hacia arriba: la misma lectura causa-efecto que usa después "El paredón estratégico"
// (Gente → Procesos → Territorios → Autosostenibilidad). "Procesos internos" no se asigna a
// ninguna aspiración — es la única perspectiva que conserva su nombre clásico tal cual.
const LEVELS: Level[] = [
  { classic: "Financiera", socya: "Autosostenibilidad y uso de recursos", aspNumber: 3 },
  { classic: "Clientes", socya: "Territorios y comunidades", aspNumber: 2 },
  { classic: "Procesos internos", socya: "Procesos internos", aspNumber: null },
  { classic: "Aprendizaje y crecimiento", socya: "Gente y cultura Socya", aspNumber: 1 },
];

// Diagrama estático de apoyo para presentar la traducción del Balanced Scorecard clásico al
// modelo Socya — apoyo visual para que el facilitador no dependa solo de explicarlo de palabra.
export default function BscSocyaDiagram() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        Balanced Scorecard clásico → Modelo Socya
      </p>
      <div className="flex flex-col gap-0">
        {LEVELS.map((level, i) => {
          const cls = aspClasses(level.aspNumber);
          return (
            <div key={level.classic}>
              {i > 0 && (
                <div className="flex justify-center py-1 text-muted" aria-hidden>
                  ↑
                </div>
              )}
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <div className="rounded-md border border-dashed border-border bg-black/[0.02] px-3 py-2 text-sm text-muted sm:w-56 sm:shrink-0">
                  {level.classic}
                </div>
                <div className="hidden text-muted sm:block" aria-hidden>
                  →
                </div>
                <div className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold ${cls.border} ${cls.bgSoft} ${cls.text}`}>
                  {level.socya}
                  {level.aspNumber && <span className="ml-1.5 font-normal opacity-70">· Aspiración {level.aspNumber}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
