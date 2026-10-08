"use client";

import { PostIt } from "./shared";

interface CausalLink {
  from: string;
  to: string;
  cuestionamiento: string;
  ajuste: string;
}

// Retoma 3 de las relaciones causa-efecto trazadas en "El paredón estratégico" (ver
// EjemploParedon.tsx) para mostrar cómo un subgrupo DISTINTO al autor de cada relación la
// cuestiona ("¿por qué esto lleva a aquello?") y cómo queda el ajuste acordado — el mismo
// par de campos que trae esta actividad (cuestionamiento / ajuste).
const LINKS: CausalLink[] = [
  {
    from: "Crear un copiloto de IA que documente el know-how de cada consultor (Socya Mind)",
    to: "Ampliar cobertura en territorios complejos apoyados en el copiloto de conocimiento",
    cuestionamiento:
      "¿Por qué el copiloto de IA lleva directo a ampliar cobertura? ¿No hace falta primero que los consultores nuevos aprendan a usarlo antes de que eso se traduzca en más territorio atendido?",
    ajuste:
      "Se acota el objetivo de Procesos a 'crear y capacitar en el uso del copiloto', y se agrega un indicador intermedio (% de consultores activos en la plataforma) antes de medir el avance en cobertura territorial.",
  },
  {
    from: "Estandarizar la metodología de intervención territorial",
    to: "Fortalecer alianzas con comunidades y aliados estratégicos",
    cuestionamiento:
      "¿La estandarización de la metodología no podría rigidizar la relación con las comunidades en vez de fortalecerla? Cada territorio tiene una dinámica distinta.",
    ajuste:
      "Se ajusta la relación: la estandarización debe dejar un margen explícito de adaptación local, y el objetivo de Territorios pasa a 'fortalecer alianzas respetando la autonomía territorial'.",
  },
  {
    from: "Fortalecer alianzas con comunidades y aliados estratégicos",
    to: "Diversificar ingresos licenciando la metodología a otras fundaciones (Socya Ventures)",
    cuestionamiento:
      "¿Por qué la licencia de la metodología (Socya Ventures) depende de las alianzas territoriales y no al revés? Parecen dos frentes independientes.",
    ajuste:
      "Se valida la relación: sin resultados respaldados por aliados en territorio, ninguna fundación externa licenciaría la metodología. Se mantiene el orden causal, pero se agrega como condición previa un caso de éxito documentado.",
  },
];

// Modal flotante (mismo patrón que EjemploQSPM / EjemploParedon / EjemploAdaptacionPerspectivas):
// muestra cómo debería quedar "Validación cruzada de causalidad" terminada.
export default function EjemploValidacionCausalidad({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ejemplo · cómo debería quedar este ejercicio</p>
            <h2 className="text-xl font-bold text-foreground">La causalidad del paredón, puesta a prueba</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Un subgrupo distinto al autor de cada relación la cuestiona ("¿por qué esto lleva a aquello?") y, si hace
              falta, se acuerda un ajuste al mapa — las 3 relaciones de ejemplo salen del paredón ya construido.
            </p>
          </div>
          <button
            className="shrink-0 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5"
            onClick={onClose}
          >
            ✕ Cerrar
          </button>
        </div>

        <div className="space-y-4">
          {LINKS.map((link, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-3 flex flex-col items-center gap-1.5 sm:flex-row sm:items-stretch sm:justify-center">
                <PostIt index={i * 2} className="w-56">
                  <p className="text-foreground">{link.from}</p>
                </PostIt>
                <span className="self-center px-2 text-lg text-muted" aria-hidden>
                  →
                </span>
                <PostIt index={i * 2 + 1} className="w-56">
                  <p className="text-foreground">{link.to}</p>
                </PostIt>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-background p-2.5">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">¿Por qué esto lleva a aquello?</p>
                  <p className="text-sm text-foreground">{link.cuestionamiento}</p>
                </div>
                <div className="rounded-md border border-dashed border-brand/40 bg-brand/5 p-2.5">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-brand-dark">Ajuste acordado</p>
                  <p className="text-sm text-foreground">{link.ajuste}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 max-w-4xl text-xs leading-relaxed text-muted">
          <b className="text-foreground">Nota metodológica:</b> lo importante no es tumbar relaciones, es ponerlas a
          prueba — la mayoría se validan con un ajuste pequeño (un indicador intermedio, una condición previa), y solo
          algunas cambian de verdad el mapa. Quien cuestiona una relación debe ser distinto a quien la propuso en el
          paredón.
        </p>
      </div>
    </div>
  );
}
