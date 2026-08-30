import { ROUND_PALETTE_SOFT, autoBg } from "@/components/activities/shared";

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
  },
};

export default function RadarChartView({
  axes,
  winnerByAxis,
  voteTotal,
  size = BASE_SIZE,
  activeAxisKey = null,
  variant = "light",
}: {
  axes: Axis[];
  winnerByAxis: Record<string, Signal | undefined>;
  voteTotal: Record<string, number>;
  size?: number;
  activeAxisKey?: string | string[] | null;
  variant?: "light" | "dark";
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
        {vertices.map((v) => {
          if (!v.winner) return null;
          const live = activeAxisKeys.includes(v.axis.key);
          return (
            <g key={v.axis.key}>
              {live && <circle cx={v.x} cy={v.y} r={size > BASE_SIZE ? 11 : 8} fill={t.vertexActiveGlow} className="animate-pulse" />}
              <circle cx={v.x} cy={v.y} r={size > BASE_SIZE ? 5 : 3.5} style={{ fill: t.vertex }} />
            </g>
          );
        })}
      </svg>
      {axes.map((a, i) => {
        const p = point(axisAngle(i), 1.32);
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
      {vertices.map((v, i) => {
        if (!v.winner) return null;
        // La tarjeta se desplaza hacia afuera sobre el mismo eje del ganador (no siempre "hacia arriba"),
        // para que dos ejes con votos bajos (cerca del centro) no terminen con sus tarjetas superpuestas.
        const winner = v.winner;
        const radiusFrac = RING_FRACTIONS[winner.ring];
        // Se limita a 0.68 para dejar margen amplio frente a la etiqueta del eje (a 1.32),
        // sin importar el tamaño del radar, y así el texto de la dimensión nunca queda tapado.
        const calloutFrac = Math.min(radiusFrac + 0.2, 0.68);
        const basePoint = point(axisAngle(i), calloutFrac);
        // Un desplazamiento tangencial (perpendicular al eje), alternado por índice,
        // separa aún más las tarjetas de ejes adyacentes cuyo ganador cayó en el mismo anillo.
        const angleRad = (axisAngle(i) * Math.PI) / 180;
        const tangentShift = (i % 2 === 0 ? 1 : -1) * (size > BASE_SIZE ? 32 : 14);
        const calloutPoint = {
          x: basePoint.x + -Math.sin(angleRad) * tangentShift,
          y: basePoint.y + Math.cos(angleRad) * tangentShift,
        };
        return (
          <div
            key={v.axis.key}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-lg text-center leading-tight shadow-lg ${
              size > BASE_SIZE ? "w-36 text-xs p-2" : "w-24 text-[9px] p-1"
            } ${variant === "dark" ? "text-dark" : ""} ${autoBg(winner.round - 1, ROUND_PALETTE_SOFT)} backdrop-blur-sm`}
            style={{ left: calloutPoint.x, top: calloutPoint.y }}
          >
            {winner.text}
            <div className="mt-0.5 font-semibold text-brand-dark">{voteTotal[winner.id] ?? 0} pts</div>
          </div>
        );
      })}
    </div>
  );
}
