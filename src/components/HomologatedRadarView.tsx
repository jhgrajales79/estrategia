interface Axis {
  key: string;
  label: string;
}
interface Signal {
  axis: string;
  ring: number;
}

const BASE_SIZE = 320;
const RING_FRACTIONS = [0.35, 0.68, 1];
// Un color fijo por anillo (no por eje): el mismo criterio de "color fijo y reconocible" que
// axisColor() en RadarChartView, pero aquí identifica el horizonte temporal, no el eje.
const RING_COLORS = ["#087062", "#ff8300", "#00a0df"];

const THEME = {
  light: { grid: "rgba(18, 60, 73, 0.14)", label: "var(--muted)" },
  dark: { grid: "rgba(255, 255, 255, 0.14)", label: "rgba(255, 255, 255, 0.55)" },
};

export default function HomologatedRadarView({
  axes,
  rings,
  signals,
  size = BASE_SIZE,
  variant = "light",
}: {
  axes: Axis[];
  rings: string[];
  signals: Signal[];
  size?: number;
  variant?: "light" | "dark";
}) {
  const t = THEME[variant];
  const center = size / 2;
  const maxR = size / 2 - (size > BASE_SIZE ? 64 : 48);

  function axisAngle(i: number) {
    return -90 + (360 / Math.max(axes.length, 1)) * i;
  }
  function point(angleDeg: number, radiusFrac: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: center + radiusFrac * maxR * Math.cos(rad), y: center + radiusFrac * maxR * Math.sin(rad) };
  }

  function hasSignal(axisKey: string, ring: number) {
    return signals.some((s) => s.axis === axisKey && s.ring === ring);
  }

  const hasAny = signals.length > 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0 overflow-visible">
          {RING_FRACTIONS.map((f, i) => (
            <circle key={i} cx={center} cy={center} r={f * maxR} fill="none" stroke={t.grid} strokeWidth={1} />
          ))}
          {axes.map((a, i) => {
            const p = point(axisAngle(i), 1);
            return <line key={a.key} x1={center} y1={center} x2={p.x} y2={p.y} stroke={t.grid} strokeWidth={1} />;
          })}
          {rings.map((_, ringIdx) => {
            const filled = axes.map((a) => hasSignal(a.key, ringIdx));
            if (!filled.some(Boolean)) return null;
            const pts = axes.map((a, i) => point(axisAngle(i), filled[i] ? RING_FRACTIONS[ringIdx] : 0));
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
                {pts.map(
                  (p, i) =>
                    filled[i] && (
                      <circle key={axes[i].key} cx={p.x} cy={p.y} r={size > BASE_SIZE ? 5.5 : 4} fill={RING_COLORS[ringIdx]} stroke="#fff" strokeWidth={1.5} />
                    )
                )}
              </g>
            );
          })}
        </svg>
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
            Sin datos homologados todavía
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-3 text-xs" style={{ color: t.label }}>
        {rings.map((r, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: RING_COLORS[i] }} />
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}
