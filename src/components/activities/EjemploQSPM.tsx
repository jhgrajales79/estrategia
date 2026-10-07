"use client";

import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import type { Aspiration } from "@/lib/types";

interface Factor {
  factor: string;
  origin: "EFI" | "EFE";
  peso: number;
  as: number;
}
interface EjemploCard {
  aspNumber: number;
  statement: string;
  title: string;
  thesis: string;
  tagline: string;
  factors: Factor[];
}

const EJEMPLOS: EjemploCard[] = [
  {
    aspNumber: 1,
    statement: "Cuidamos a nuestra Gente Socya desde el ser y el hacer, creciendo en comunidad.",
    title: "Socya Nómada",
    thesis:
      'Pasaporte de talento itinerante: cada colaborador diseña su propia ruta de rotación entre territorios —financiada con los mismos recursos de cooperación que hoy se gestionan por separado— y acumula "millas de carrera" canjeables por maestrías, sabáticos o participación simbólica en la Fundación.',
    tagline: "La rotación territorial deja de ser una amenaza y se convierte en el beneficio más codiciado de la organización.",
    factors: [
      { factor: "Atracción y retención de talentos", origin: "EFI", peso: 0.4, as: 4 },
      { factor: "Subsidio/crédito para cualificación", origin: "EFI", peso: 0.15, as: 4 },
      { factor: "Gestión de recursos internacionales", origin: "EFE", peso: 0.2, as: 3 },
      { factor: "Fuga de talento y pérdida de know-how", origin: "EFE", peso: 0.25, as: 4 },
    ],
  },
  {
    aspNumber: 2,
    statement: "Diseñamos soluciones que impulsan el desarrollo sostenible en los territorios.",
    title: "Socya Mind",
    thesis:
      "Un gemelo digital entrenado con el know-how disperso de cada consultor —antes de que se vaya— que actúa como copiloto de IA: diseña soluciones de economía circular, estima presupuestos de proyecto y conserva la memoria institucional aunque la persona abandone la Fundación.",
    tagline: "El conocimiento deja de irse por la puerta cuando alguien renuncia: queda encapsulado en un copiloto que todo el equipo consulta.",
    factors: [
      { factor: "Transformación digital de procesos", origin: "EFI", peso: 0.09, as: 4 },
      { factor: 'Valor agregado vía "Valor Socya"', origin: "EFI", peso: 0.09, as: 3 },
      { factor: "Gestión del conocimiento y know-how", origin: "EFE", peso: 0.15, as: 4 },
      { factor: "IA para optimización de procesos", origin: "EFE", peso: 0.1, as: 4 },
    ],
  },
  {
    aspNumber: 3,
    statement: "Aseguramos la autosostenibilidad de la Fundación.",
    title: "Socya Ventures",
    thesis:
      "Empaquetar y licenciar el modelo propio de intervención territorial —ya probado en campo y con buena referenciación— como un producto licenciable para otras fundaciones y empresas de la región, generando ingresos recurrentes que no dependen de operar directamente en territorios inseguros.",
    tagline: "La operación deja de ser el único negocio: el conocimiento que ya tenemos se convierte en el segundo.",
    factors: [
      { factor: "Calidad que permite recompra/referencia", origin: "EFI", peso: 0.3, as: 4 },
      { factor: "Modelos propios registrables y vendibles", origin: "EFE", peso: 0.3, as: 4 },
      { factor: "Diversificación de ingresos", origin: "EFE", peso: 0.2, as: 4 },
      { factor: "Seguridad en territorios / sobrecostos", origin: "EFE", peso: 0.4, as: 3 },
    ],
  },
];

function gaugePoint(value: number) {
  const angle = 180 - 45 * value; // 0 -> 180° (izquierda), 4 -> 0° (derecha)
  const rad = (angle * Math.PI) / 180;
  const x = 100 + 80 * Math.cos(rad);
  const y = 100 - 80 * Math.sin(rad);
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

function Gauge({ value, colorVar }: { value: number; colorVar: string }) {
  const p = gaugePoint(value);
  return (
    <svg viewBox="0 0 200 112" className="w-32 shrink-0 overflow-visible" role="img" aria-label={`Índice ${value.toFixed(2)} sobre 4`}>
      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--border)" strokeWidth="13" strokeLinecap="round" />
      <path d={`M 20 100 A 80 80 0 0 1 ${p.x} ${p.y}`} fill="none" stroke={colorVar} strokeWidth="13" strokeLinecap="round" />
      <circle cx={p.x} cy={p.y} r="5.5" fill="var(--card)" stroke={colorVar} strokeWidth="3" />
      <g fontFamily="var(--font-geist-mono)" fontSize="10" fill="var(--muted)">
        <text x="4" y="108">0</text>
        <text x="100" y="12" textAnchor="middle">2</text>
        <text x="196" y="108" textAnchor="end">4</text>
      </g>
    </svg>
  );
}

// Modal flotante dentro de la propia actividad (nunca una pestaña nueva): muestra, con la misma
// línea gráfica del sistema (tarjetas, colores por aspiración, tipografía), cómo debería verse la
// Priorización QSPM terminada — una estrategia deliberadamente ambiciosa por aspiración, construida
// sobre factores EFI/EFE reales y calculada igual que la tabla real (peso × calificación).
export default function EjemploQSPM({ aspirations, onClose }: { aspirations: Aspiration[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ejemplo · cómo debería quedar este ejercicio</p>
            <h2 className="text-xl font-bold text-foreground">Tres estrategias ganadoras</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Una estrategia deliberadamente ambiciosa por aspiración, construida sobre los factores EFI/EFE reales ya
              calificados, priorizada con el mismo cálculo de la tabla: <b className="text-foreground">peso × calificación</b>.
            </p>
          </div>
          <button className="shrink-0 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5" onClick={onClose}>
            ✕ Cerrar
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {EJEMPLOS.map((card) => {
            const cls = aspClasses(card.aspNumber);
            const total = card.factors.reduce((a, f) => a + f.peso * f.as, 0);
            const pesoSum = card.factors.reduce((a, f) => a + f.peso, 0);
            const index = total / pesoSum;
            const asp = aspirations.find((a) => a.number === card.aspNumber);
            const accentVar = `var(--color-${cls.bg.replace("bg-", "")})`;
            return (
              <div key={card.aspNumber} className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
                <div className={`h-1.5 ${cls.bg}`} />
                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold text-dark ${cls.bg}`}>
                      Aspiración {card.aspNumber} · {ARCHETYPE_LABEL[card.aspNumber]}
                    </span>
                  </div>
                  <p className={`mb-3 border-l-2 pl-2 text-xs italic text-muted ${cls.border}`}>
                    &ldquo;{asp?.name ?? card.statement}&rdquo;
                  </p>
                  <h3 className={`mb-2 text-xl font-extrabold ${cls.text}`}>{card.title}</h3>
                  <p className="mb-2 text-sm leading-relaxed text-foreground">{card.thesis}</p>
                  <p className="mb-4 text-xs italic text-muted">{card.tagline}</p>

                  <div className="mb-4 flex items-center gap-3 rounded-md bg-black/[0.02] p-3">
                    <Gauge value={index} colorVar={accentVar} />
                    <div>
                      <p className="font-mono text-2xl font-extrabold text-foreground">
                        {index.toFixed(2)}
                        <span className="text-sm font-normal text-muted">/4.00</span>
                      </p>
                      <p className="text-[11px] text-muted">índice de atractivo ponderado</p>
                      <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${cls.bgSoft} ${cls.text}`}>
                        🏆 Prioridad #1 de la aspiración
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-black/[0.03] text-muted">
                        <tr>
                          <th className="p-1.5 text-left font-medium">Factor</th>
                          <th className="p-1.5 text-right font-medium">Peso</th>
                          <th className="p-1.5 text-right font-medium">AS</th>
                          <th className="p-1.5 text-right font-medium">Aporte</th>
                        </tr>
                      </thead>
                      <tbody>
                        {card.factors.map((f) => (
                          <tr key={f.factor} className="border-t border-border">
                            <td className="p-1.5">
                              <span className="mr-1 rounded bg-black/5 px-1 py-0.5 text-[9px] font-bold text-muted">{f.origin}</span>
                              {f.factor}
                            </td>
                            <td className="p-1.5 text-right tabular-nums">{f.peso.toFixed(2)}</td>
                            <td className="p-1.5 text-right tabular-nums">{f.as}</td>
                            <td className="p-1.5 text-right tabular-nums">{(f.peso * f.as).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border bg-black/[0.03] font-semibold">
                          <td className="p-1.5">Σ pesos = {pesoSum.toFixed(2)}</td>
                          <td />
                          <td />
                          <td className="p-1.5 text-right tabular-nums">{total.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 max-w-4xl text-xs leading-relaxed text-muted">
          <b className="text-foreground">Nota metodológica:</b> los factores, pesos y calificaciones provienen de las
          Matrices EFI/EFE reales ya diligenciadas por cada equipo. La redacción de las estrategias y su calificación de
          atractivo son hipótesis deliberadamente ambiciosas para ilustrar el resultado final — no son la decisión
          oficial del equipo.
        </p>
      </div>
    </div>
  );
}
