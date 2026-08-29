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

export default function RadarChartView({
  axes,
  winnerByAxis,
  voteTotal,
  size = BASE_SIZE,
  activeAxisKey = null,
}: {
  axes: Axis[];
  winnerByAxis: Record<string, Signal | undefined>;
  voteTotal: Record<string, number>;
  size?: number;
  activeAxisKey?: string | string[] | null;
}) {
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
        {RING_FRACTIONS.map((f, i) => (
          <circle key={i} cx={center} cy={center} r={f * (size / 2 - 64)} fill="none" stroke="currentColor" className="text-border" strokeWidth={1} />
        ))}
        {axes.map((a, i) => {
          const p = point(axisAngle(i), 1);
          return <line key={a.key} x1={center} y1={center} x2={p.x} y2={p.y} stroke="currentColor" className="text-border" strokeWidth={1} />;
        })}
        {hasAny && (
          <polygon
            points={polygonPoints}
            style={{ fill: "rgba(8, 112, 98, 0.12)", stroke: "rgba(8, 112, 98, 0.55)" }}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        )}
        {vertices.map(
          (v) =>
            v.winner && (
              <circle key={v.axis.key} cx={v.x} cy={v.y} r={size > BASE_SIZE ? 5 : 3.5} style={{ fill: "rgba(8, 112, 98, 0.9)" }} />
            )
        )}
      </svg>
      {axes.map((a, i) => {
        const p = point(axisAngle(i), 1.15);
        return (
          <div
            key={a.key}
            className={`absolute -translate-x-1/2 -translate-y-1/2 text-center leading-tight ${
              size > BASE_SIZE ? "w-32 text-sm" : "w-24 text-[11px]"
            } ${activeAxisKeys.includes(a.key) ? "font-bold text-brand-dark" : "text-muted"}`}
            style={{ left: p.x, top: p.y }}
          >
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
        // Se limita a 0.85 para dejar margen frente a la etiqueta del eje (a 1.15),
        // sin importar el tamaño del radar, y así casi nunca chocan entre sí.
        const calloutFrac = Math.min(radiusFrac + 0.28, 0.85);
        const basePoint = point(axisAngle(i), calloutFrac);
        // Un desplazamiento tangencial (perpendicular al eje), alternado por índice,
        // separa aún más las tarjetas de ejes adyacentes cuyo ganador cayó en el mismo anillo.
        const angleRad = (axisAngle(i) * Math.PI) / 180;
        const tangentShift = (i % 2 === 0 ? 1 : -1) * (size > BASE_SIZE ? 20 : 12);
        const calloutPoint = {
          x: basePoint.x + -Math.sin(angleRad) * tangentShift,
          y: basePoint.y + Math.cos(angleRad) * tangentShift,
        };
        return (
          <div
            key={v.axis.key}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-sm text-center leading-tight shadow ${
              size > BASE_SIZE ? "w-32 text-[11px] p-1.5" : "w-24 text-[9px] p-1"
            } ${autoBg(winner.round - 1, ROUND_PALETTE_SOFT)} backdrop-blur-sm`}
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
