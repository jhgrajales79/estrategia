"use client";

import { aspClasses } from "@/lib/aspirationStyle";
import BscSocyaDiagram from "./BscSocyaDiagram";

interface Example {
  label: string;
  aspNumber: number | null;
  question: string;
  note: string;
}

const EXAMPLES: Example[] = [
  {
    label: "Gente y cultura Socya",
    aspNumber: 1,
    question: "¿Qué capacidades, cultura y bienestar del equipo sostienen la operación?",
    note: "Aquí viven los objetivos de talento, clima laboral y formación: medir clima/riesgo psicosocial de forma sistemática, fortalecer los procesos de autoformación y resolver la atracción y retención de talento — nuestra mayor debilidad según el EFI (peso 0.40).",
  },
  {
    label: "Procesos internos",
    aspNumber: null,
    question: "¿Qué procesos debemos fortalecer para ejecutar con calidad?",
    note: "Aquí viven objetivos de estandarización y gestión del conocimiento: documentar y blindar el know-how disperso en cada consultor, e incorporar herramientas de transformación digital para optimizar la operación territorial.",
  },
  {
    label: "Territorios y comunidades",
    aspNumber: 2,
    question: "¿Qué valor entregamos a las comunidades y territorios donde trabajamos?",
    note: "Aquí viven objetivos de cobertura y alianzas: desarrollar capacidades para operar en territorios complejos, aprovechar oportunidades de economía circular y fortalecer la inteligencia de contexto frente a la competencia.",
  },
  {
    label: "Autosostenibilidad y uso de recursos",
    aspNumber: 3,
    question: "¿Cómo garantizamos la sostenibilidad financiera de la Fundación?",
    note: "Aquí viven objetivos de diversificación de ingresos y eficiencia: licenciar la metodología propia como producto, reducir la dependencia operativa del territorio y aprovechar el respaldo patrimonial y la buena referenciación ya ganada.",
  },
];

// Modal flotante (igual patrón que EjemploQSPM): muestra cómo debería quedar cada una de las 4
// notas de "Adaptación de perspectivas al modelo Socya" — la pregunta guía de cada perspectiva y
// un ejemplo de nota grounded en los factores EFI/EFE reales ya diligenciados por el equipo.
export default function EjemploAdaptacionPerspectivas({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ejemplo · cómo debería quedar este ejercicio</p>
            <h2 className="text-xl font-bold text-foreground">Las 4 notas de la adaptación</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Cada nota responde una <b className="text-foreground">pregunta guía</b> y señala qué tipo de objetivos vivirán ahí —
              los objetivos concretos se construyen después, en &quot;El paredón estratégico&quot;, a partir de las estrategias ya
              ratificadas en el Cierre.
            </p>
          </div>
          <button className="shrink-0 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5" onClick={onClose}>
            ✕ Cerrar
          </button>
        </div>

        <div className="mb-5">
          <BscSocyaDiagram />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {EXAMPLES.map((ex) => {
            const cls = aspClasses(ex.aspNumber);
            return (
              <div key={ex.label} className="overflow-hidden rounded-lg border border-border bg-card">
                <div className={`h-1.5 ${cls.bg}`} />
                <div className="p-4">
                  <p className={`mb-1 text-sm font-extrabold ${cls.text}`}>{ex.label}</p>
                  <p className="mb-2 text-xs italic text-muted">{ex.question}</p>
                  <p className="text-sm leading-relaxed text-foreground">{ex.note}</p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 max-w-4xl text-xs leading-relaxed text-muted">
          <b className="text-foreground">Nota metodológica:</b> estos ejemplos se apoyan en los factores EFI/EFE reales ya
          calificados por el equipo. Las notas que escriban no necesitan datos ni cifras — basta con dejar clara la pregunta
          guía y el tipo de objetivos esperado en cada perspectiva.
        </p>
      </div>
    </div>
  );
}
