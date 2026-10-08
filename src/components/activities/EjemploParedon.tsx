"use client";

import { aspClasses } from "@/lib/aspirationStyle";
import { PostIt } from "./shared";

interface CardExample {
  text: string;
  leadsTo?: string;
}
interface PerspectiveExample {
  key: string;
  label: string;
  aspNumber: number | null;
  cards: CardExample[];
}

// Mismo orden que usa MapaEstrategico.tsx: de abajo hacia arriba, Gente es la base y
// Autosostenibilidad la cúspide — acá se recorre ya invertido (cúspide primero) para que el
// JSX renderice en ese mismo orden visual sin duplicar la lógica de reversa del componente real.
const PERSPECTIVES: PerspectiveExample[] = [
  {
    key: "autosostenibilidad",
    label: "Autosostenibilidad y uso de recursos",
    aspNumber: 3,
    cards: [
      { text: "Diversificar ingresos licenciando la metodología a otras fundaciones (Socya Ventures)" },
      { text: "Reducir costos de operación en territorios de difícil acceso" },
    ],
  },
  {
    key: "territorios",
    label: "Territorios y comunidades",
    aspNumber: 2,
    cards: [
      { text: "Ampliar cobertura en territorios complejos apoyados en el copiloto de conocimiento", leadsTo: "Reducir costos de operación en territorios de difícil acceso" },
      { text: "Fortalecer alianzas con comunidades y aliados estratégicos", leadsTo: "Diversificar ingresos licenciando la metodología a otras fundaciones (Socya Ventures)" },
    ],
  },
  {
    key: "procesos",
    label: "Procesos internos",
    aspNumber: null,
    cards: [
      { text: "Crear un copiloto de IA que documente el know-how de cada consultor (Socya Mind)", leadsTo: "Ampliar cobertura en territorios complejos apoyados en el copiloto de conocimiento" },
      { text: "Estandarizar la metodología de intervención territorial", leadsTo: "Fortalecer alianzas con comunidades y aliados estratégicos" },
    ],
  },
  {
    key: "gente",
    label: "Gente y cultura Socya",
    aspNumber: 1,
    cards: [
      { text: "Lanzar el pasaporte de talento itinerante entre territorios (Socya Nómada)", leadsTo: "Crear un copiloto de IA que documente el know-how de cada consultor (Socya Mind)" },
      { text: "Medir clima laboral y riesgo psicosocial de forma sistemática", leadsTo: "Estandarizar la metodología de intervención territorial" },
    ],
  },
];

// Modal flotante (mismo patrón que EjemploQSPM / EjemploAdaptacionPerspectivas): muestra cómo
// debería quedar "El paredón estratégico" terminado — 2 objetivos por perspectiva, con sus
// relaciones causa-efecto de abajo hacia arriba ya trazadas, retomando las 3 estrategias de
// ejemplo (Socya Nómada, Socya Mind, Socya Ventures) usadas en el resto del módulo.
export default function EjemploParedon({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ejemplo · cómo debería quedar este ejercicio</p>
            <h2 className="text-xl font-bold text-foreground">El paredón terminado</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Dos objetivos por perspectiva, con sus relaciones causa-efecto trazadas de abajo hacia arriba — cada flecha
              muestra qué objetivo de la perspectiva de arriba depende del de abajo.
            </p>
          </div>
          <button className="shrink-0 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5" onClick={onClose}>
            ✕ Cerrar
          </button>
        </div>

        <div className="space-y-2">
          {PERSPECTIVES.map((p, i) => {
            const cls = aspClasses(p.aspNumber);
            return (
              <div key={p.key}>
                {i > 0 && (
                  <div className="flex justify-center py-1 text-muted" aria-hidden>
                    ↑
                  </div>
                )}
                <div className="rounded-lg border border-border bg-card p-3">
                  <h4 className={`mb-2 text-sm font-semibold ${p.aspNumber ? cls.text : "text-foreground"}`}>{p.label}</h4>
                  <div className="flex flex-wrap gap-3">
                    {p.cards.map((c, idx) => (
                      <PostIt key={idx} bgClass={p.aspNumber ? cls.bgSoft : undefined} index={idx} className="w-56">
                        <p className="text-foreground">{c.text}</p>
                        {c.leadsTo && <p className="mt-1.5 text-[11px] italic text-muted">↑ lleva a: {c.leadsTo.slice(0, 48)}…</p>}
                      </PostIt>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 max-w-4xl text-xs leading-relaxed text-muted">
          <b className="text-foreground">Nota metodológica:</b> los objetivos de ejemplo retoman las 3 estrategias ya
          desarrolladas en el módulo (Socya Nómada, Socya Mind, Socya Ventures) para ilustrar cómo una sola estrategia se
          puede desdoblar en objetivos conectados a lo largo de varias perspectivas — no son los objetivos oficiales del
          equipo, que deben salir de las estrategias realmente ratificadas en el Cierre.
        </p>
      </div>
    </div>
  );
}
