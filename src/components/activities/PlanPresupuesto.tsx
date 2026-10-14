"use client";

import { isPresenter } from "@/lib/presenter";
import GanttPlaneacion from "./GanttPlaneacion";
import { ActivityComponentProps, PresenterHint } from "./shared";

// Todo el CRUD de "Plan de acción y tablero acumulado anual" (proyecto estratégico, actividad,
// concepto de costo) vive dentro de GanttPlaneacion — un solo lugar de trabajo (el árbol del
// Gantt) en vez de un formulario "General" aparte más el cronograma. Ver GanttPlaneacion.tsx.
export default function PlanPresupuesto({ activity, aspirations, participant }: ActivityComponentProps) {
  const presenter = isPresenter(participant);
  return (
    <div className="space-y-3">
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PresenterHint />
          {Boolean(activity.config.boardRoute) && (
            <button
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 transition-colors"
              title="Ver el tablero financiero consolidado en una pestaña nueva"
              onClick={() => window.open(`/${activity.config.boardRoute}/${activity.id}`, "_blank", "noopener,noreferrer")}
            >
              ⛶ Ver tablero
            </button>
          )}
        </div>
      )}
      <GanttPlaneacion activity={activity} aspirations={aspirations} presenter={presenter} />
    </div>
  );
}
