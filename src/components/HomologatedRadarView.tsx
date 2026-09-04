interface Axis {
  key: string;
  label: string;
}
interface Signal {
  id: string;
  axis: string;
  ring: number;
  text: string;
  score: number;
}

const BASE_SIZE = 320;
const RING_FRACTIONS = [0.35, 0.68, 1];
// Un color fijo por anillo (no por eje): el mismo criterio de "color fijo y reconocible" que
// axisColor() en RadarChartView, pero aquí identifica el horizonte temporal, no el eje.
const RING_COLORS = ["#087062", "#ff8300", "#00a0df"];

const THEME = {
  light: { grid: "rgba(18, 60, 73, 0.14)", label: "var(--muted)", card: "#fff", cardText: "var(--foreground)" },
  dark: { grid: "rgba(255, 255, 255, 0.14)", label: "rgba(255, 255, 255, 0.55)", card: "rgba(255,255,255,0.03)", cardText: "#fff" },
};

export default function HomologatedRadarView({
  axes,
  rings,
  signals,
  size = BASE_SIZE,
  variant = "light",
  ringFilter = null,
}: {
  axes: Axis[];
  rings: string[];
  signals: Signal[];
  size?: number;
  variant?: "light" | "dark";
  // null/undefined = radar general (los 3 anillos superpuestos). Un número = radar de un solo
  // anillo (ese horizonte en solitario), mismo criterio visual, sin mezclar con los otros.
  ringFilter?: number | null;
}) {
  const t = THEME[variant];
  const center = size / 2;
  const maxR = size / 2 - (size > BASE_SIZE ? 64 : 48);
  const ringIndices = ringFilter === null ? rings.map((_, i) => i) : [ringFilter];

  function axisAngle(i: number) {
    return -90 + (360 / Math.max(axes.length, 1)) * i;
  }
  function point(angleDeg: number, radiusFrac: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: center + radiusFrac * maxR * Math.cos(rad), y: center + radiusFrac * maxR * Math.sin(rad) };
  }

  // Solo se marcan puntos con calificación mayor a 0: por cada eje, dentro de cada anillo, se
  // toma el tema con más votos (si hay varios) como el que se ubica en el radar.
  function winner(axisKey: string, ring: number): Signal | undefined {
    let best: Signal | undefined;
    for (const s of signals) {
      if (s.axis !== axisKey || s.ring !== ring || s.score <= 0) continue;
      if (!best || s.score > best.score) best = s;
    }
    return best;
  }

  const plotted = ringIndices.flatMap((ringIdx) =>
    axes.map((a) => winner(a.key, ringIdx)).filter((w): w is Signal => Boolean(w))
  );
  const hasAny = plotted.length > 0;
  const maxScore = Math.max(1, ...plotted.map((s) => s.score));
  // La posición (radio) marca el anillo (horizonte temporal); el tamaño del punto y su
  // insignia de puntos marcan la calificación, para que dos ejes con votos distintos en el
  // mismo anillo no se vean idénticos.
  function dotRadius(score: number) {
    const base = size > BASE_SIZE ? 4.5 : 3.5;
    const extra = size > BASE_SIZE ? 6 : 4.5;
    return base + (score / maxScore) * extra;
  }

  return (
    <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0 overflow-visible">
          {RING_FRACTIONS.map((f, i) => (
            <circle key={i} cx={center} cy={center} r={f * maxR} fill="none" stroke={t.grid} strokeWidth={1} />
          ))}
          {axes.map((a, i) => {
            const p = point(axisAngle(i), 1);
            return <line key={a.key} x1={center} y1={center} x2={p.x} y2={p.y} stroke={t.grid} strokeWidth={1} />;
          })}
          {ringIndices.map((ringIdx) => {
            const winners = axes.map((a) => winner(a.key, ringIdx));
            if (!winners.some(Boolean)) return null;
            const pts = axes.map((a, i) => point(axisAngle(i), winners[i] ? RING_FRACTIONS[ringIdx] : 0));
            const poly = pts.map((p) => `${p.x},${p.y}`).join(" ");
            return (
              <g key={ringIdx}>
                <polygon
                  points={poly}
                  fill={RING_COLORS[ringIdx]}
                  fillOpacity={0.14}
                  stroke={RING_COLORS[ringIdx]}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                {pts.map((p, i) => {
                  const w = winners[i];
                  if (!w) return null;
                  return <circle key={axes[i].key} cx={p.x} cy={p.y} r={dotRadius(w.score)} fill={RING_COLORS[ringIdx]} stroke="#fff" strokeWidth={1.5} />;
                })}
              </g>
            );
          })}
        </svg>
        {ringIndices.map((ringIdx) =>
          axes.map((a, i) => {
            const w = winner(a.key, ringIdx);
            if (!w) return null;
            const p = point(axisAngle(i), RING_FRACTIONS[ringIdx]);
            const badgeOffset = dotRadius(w.score) + (size > BASE_SIZE ? 12 : 9);
            return (
              <div
                key={w.id}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full text-center font-bold text-white shadow ${
                  size > BASE_SIZE ? "px-1.5 py-0.5 text-[10px]" : "px-1 py-0.5 text-[9px]"
                }`}
                style={{ left: p.x, top: p.y - badgeOffset, backgroundColor: RING_COLORS[ringIdx] }}
              >
                {w.score}
              </div>
            );
          })
        )}
        {axes.map((a, i) => {
          const p = point(axisAngle(i), 1.26);
          return (
            <div
              key={a.key}
              className={`absolute -translate-x-1/2 -translate-y-1/2 text-center leading-tight ${size > BASE_SIZE ? "w-32 text-xs" : "w-24 text-[10px]"}`}
              style={{ left: p.x, top: p.y, color: t.label }}
            >
              {a.label}
            </div>
          );
        })}
        {!hasAny && (
          <div className="absolute inset-0 flex items-center justify-center text-center text-xs" style={{ color: t.label }}>
            Sin calificaciones todavía
          </div>
        )}
      </div>

      {/* Solo el punto va sobre el radar; el texto de cada tema se lee en la lista al lado,
          para que nada se solape sobre el gráfico. */}
      {hasAny && (
        <div className="w-full max-w-xs shrink-0 space-y-1.5">
          {ringIndices.map((ringIdx) =>
            axes.map((a) => {
              const w = winner(a.key, ringIdx);
              if (!w) return null;
              return (
                <div
                  key={w.id}
                  className="flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs"
                  style={{ borderColor: t.grid, backgroundColor: t.card }}
                >
                  <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: RING_COLORS[ringIdx] }} />
                  <div className="min-w-0 flex-1" style={{ color: t.cardText }}>
                    <p className="font-semibold">
                      {a.label}
                      {ringFilter === null && <span className="font-normal opacity-70"> · {rings[ringIdx]}</span>}
                    </p>
                    <p className="opacity-90">
                      {w.text} <span className="font-semibold">· {w.score} pts</span>
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
