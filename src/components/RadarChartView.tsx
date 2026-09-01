interface Axis {
  key: string;
  label: string;
}
interface Signal {
  id: string;
  axis: string;
  ring: number;
  round: number;
  text: string;
  author: string;
  aspiration_id: number | null;
}

const BASE_SIZE = 340;
const RING_FRACTIONS = [0.35, 0.68, 1];

const THEME = {
  light: {
    grid: "rgba(18, 60, 73, 0.14)",
    ringFill: "rgba(18, 60, 73, 0.025)",
    label: "var(--muted)",
    labelActive: "var(--brand-dark)",
    polygonFill: "rgba(8, 112, 98, 0.14)",
    polygonStroke: "rgba(8, 112, 98, 0.6)",
    vertex: "rgba(8, 112, 98, 0.95)",
    vertexActiveGlow: "rgba(8, 112, 98, 0.35)",
    caption: "var(--muted)",
  },
  dark: {
    grid: "rgba(255, 255, 255, 0.14)",
    ringFill: "rgba(255, 255, 255, 0.025)",
    label: "rgba(255, 255, 255, 0.55)",
    labelActive: "#a8e05c",
    polygonFill: "rgba(128, 198, 18, 0.16)",
    polygonStroke: "rgba(128, 198, 18, 0.65)",
    vertex: "#a8e05c",
    vertexActiveGlow: "rgba(168, 224, 92, 0.45)",
    caption: "rgba(255, 255, 255, 0.5)",
  },
};

const TARGET_COLOR = "#f3c400";

// Un color fijo y distinguible por eje (no depende del tema): se usa tanto en el punto
// del radar como en la tarjeta lateral correspondiente, para que se identifiquen a simple vista.
const AXIS_COLORS = ["#c2410c", "#0f766e", "#2563eb", "#a16207", "#7e22ce", "#be185d", "#4d7c0f"];
export function axisColor(index: number) {
  return AXIS_COLORS[index % AXIS_COLORS.length];
}

export default function RadarChartView({
  axes,
  winnerByAxis,
  voteTotal,
  size = BASE_SIZE,
  activeAxisKey = null,
  variant = "light",
  legend = false,
}: {
  axes: Axis[];
  winnerByAxis: Record<string, Signal | undefined>;
  voteTotal: Record<string, number>;
  size?: number;
  activeAxisKey?: string | string[] | null;
  variant?: "light" | "dark";
  legend?: boolean;
}) {
  const t = THEME[variant];
  const activeAxisKeys = Array.isArray(activeAxisKey) ? activeAxisKey : activeAxisKey ? [activeAxisKey] : [];
  function axisAngle(i: number) {
    return -90 + (360 / axes.length) * i;
  }
  function point(angleDeg: number, radiusFrac: number) {
    const center = size / 2;
    const maxR = size / 2 - 64;
    const rad = (angleDeg * Math.PI) / 180;
    const r = radiusFrac * maxR;
    return { x: center + r * Math.cos(rad), y: center + r * Math.sin(rad) };
  }

  const center = size / 2;
  const maxR = size / 2 - 64;
  const vertices = axes.map((a, i) => {
    const winner = winnerByAxis[a.key];
    const radiusFrac = winner ? RING_FRACTIONS[winner.ring] : 0;
    return { axis: a, winner, ...point(axisAngle(i), radiusFrac) };
  });
  const hasAny = vertices.some((v) => v.winner);
  const polygonPoints = vertices.map((v) => `${v.x},${v.y}`).join(" ");

  return (
    <div className="flex shrink-0 flex-col items-center">
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 overflow-visible">
        {RING_FRACTIONS.map((f, i) => {
          const rOuter = f * maxR;
          const rInner = i === 0 ? 0 : RING_FRACTIONS[i - 1] * maxR;
          return (
            <circle
              key={`band-${i}`}
              cx={center}
              cy={center}
              r={(rOuter + rInner) / 2}
              fill="none"
              stroke={t.ringFill}
              strokeWidth={rOuter - rInner}
            />
          );
        })}
        {RING_FRACTIONS.map((f, i) => (
          <circle key={i} cx={center} cy={center} r={f * maxR} fill="none" stroke={t.grid} strokeWidth={1} />
        ))}
        {axes.map((a, i) => {
          const p = point(axisAngle(i), 1);
          const live = activeAxisKeys.includes(a.key);
          return (
            <line
              key={a.key}
              x1={center}
              y1={center}
              x2={p.x}
              y2={p.y}
              stroke={live ? t.labelActive : t.grid}
              strokeOpacity={live ? 0.5 : 1}
              strokeWidth={live ? 1.5 : 1}
            />
          );
        })}
        {hasAny && (
          <polygon points={polygonPoints} style={{ fill: t.polygonFill, stroke: t.polygonStroke }} strokeWidth={2} strokeLinejoin="round" />
        )}
        {vertices.map((v, i) => {
          if (!v.winner) return null;
          const live = activeAxisKeys.includes(v.axis.key);
          return (
            <g key={v.axis.key}>
              {live && <circle cx={v.x} cy={v.y} r={size > BASE_SIZE ? 12 : 9} fill={t.vertexActiveGlow} className="animate-pulse" />}
              <circle
                cx={v.x}
                cy={v.y}
                r={size > BASE_SIZE ? 7 : 5}
                fill={axisColor(i)}
                stroke={variant === "dark" ? "#0b1f18" : "#fff"}
                strokeWidth={2}
              />
            </g>
          );
        })}
        {/* Objetivo de la estrategia: mientras más cerca del centro, mayor el impacto;
            lo más alejado del centro pasa a monitoreo durante la ejecución. */}
        <circle cx={center} cy={center} r={size > BASE_SIZE ? 10 : 7} fill={TARGET_COLOR} fillOpacity={0.18} className="animate-pulse" />
        <circle cx={center} cy={center} r={size > BASE_SIZE ? 6 : 4.5} fill="none" stroke={TARGET_COLOR} strokeWidth={1.5} />
        <circle cx={center} cy={center} r={size > BASE_SIZE ? 2.2 : 1.8} fill={TARGET_COLOR} />
      </svg>
      {axes.map((a, i) => {
        const p = point(axisAngle(i), 1.24);
        const live = activeAxisKeys.includes(a.key);
        return (
          <div
            key={a.key}
            className={`absolute -translate-x-1/2 -translate-y-1/2 text-center leading-tight ${
              size > BASE_SIZE ? "w-40 text-sm" : "w-24 text-[11px]"
            } ${live ? "font-bold" : "font-normal"}`}
            style={{ left: p.x, top: p.y, color: live ? t.labelActive : t.label }}
          >
            {live && <span className="mr-1">●</span>}
            {a.label}
          </div>
        );
      })}
      {/* Solo el punto y sus votos van sobre el radar; el texto de cada señal se lee
          en la lista que acompaña el radar, para que nada se solape sobre el gráfico. */}
      {vertices.map((v, i) => {
        if (!v.winner) return null;
        const pts = voteTotal[v.winner.id] ?? 0;
        const badgeOffset = size > BASE_SIZE ? 22 : 16;
        return (
          <div
            key={v.axis.key}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full text-center font-bold shadow ${
              size > BASE_SIZE ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[9px]"
            }`}
            style={{
              left: v.x,
              top: v.y - badgeOffset,
              backgroundColor: axisColor(i),
              color: "#fff",
            }}
          >
            {pts}
          </div>
        );
      })}
    </div>
    {legend && (
      <p className="mt-3 max-w-xs text-center text-[11px] leading-snug" style={{ color: t.caption }}>
        <span style={{ color: TARGET_COLOR }}>🎯</span> Objetivo estratégico: mientras más cerca del centro, mayor el
        impacto. Lo más alejado pasa a monitoreo durante la ejecución.
      </p>
    )}
    </div>
  );
}
