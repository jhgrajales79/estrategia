import { RING_COLORS, HOMOLOG_THEME } from "@/components/HomologatedRadarView";
import type { HomologSignal } from "@/components/HomologatedRadarView";

// Vista alterna a la del radar: en vez de un vértice por eje, se filtra a UN eje y se
// comparan sus 3 anillos (Ya nos afecta / Este año / Horizonte) como barras — un radar de un
// solo eje no tiene forma geométrica; tres barras sí comunican bien esa comparación.
export default function AxisRingsView({
  axisLabel,
  rings,
  signals,
  variant = "light",
}: {
  axisLabel: string;
  rings: string[];
  signals: HomologSignal[];
  variant?: "light" | "dark";
}) {
  const t = HOMOLOG_THEME[variant];
  const totals = rings.map((_, i) => signals.filter((s) => s.ring === i).reduce((a, s) => a + s.score, 0));
  const max = Math.max(1, ...totals);
  const hasAny = totals.some((v) => v > 0);

  return (
    <div className="w-full max-w-xl space-y-5">
      <div>
        <p className="mb-2 text-center text-sm font-semibold" style={{ color: t.cardText }}>
          {axisLabel}
        </p>
        <div className="space-y-2.5">
          {rings.map((r, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-36 shrink-0 text-xs font-medium" style={{ color: t.label }}>
                {r}
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: t.grid }}>
                <div
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(totals[i] / max) * 100}%`, backgroundColor: RING_COLORS[i] }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-bold" style={{ color: t.cardText }}>
                {totals[i]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {!hasAny && (
        <p className="text-center text-xs" style={{ color: t.label }}>
          Sin calificaciones todavía en este eje.
        </p>
      )}

      {hasAny && (
        <div className="space-y-3">
          {rings.map((r, i) => {
            const inRing = signals.filter((s) => s.ring === i && s.score > 0).sort((a, b) => b.score - a.score);
            if (inRing.length === 0) return null;
            return (
              <div key={i}>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: t.label }}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: RING_COLORS[i] }} />
                  {r}
                </p>
                <ul className="space-y-1">
                  {inRing.map((s) => (
                    <li key={s.id} className="text-sm" style={{ color: t.cardText }}>
                      {s.text} <span className="font-semibold">· {s.score} pts</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
