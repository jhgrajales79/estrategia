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
  activeAxisKey?: string | null;
}) {
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
            style={{ fill: "rgba(47, 158, 79, 0.12)", stroke: "rgba(47, 158, 79, 0.5)" }}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        )}
        {vertices.map(
          (v) =>
            v.winner && (
              <circle key={v.axis.key} cx={v.x} cy={v.y} r={size > BASE_SIZE ? 5 : 3.5} style={{ fill: "rgba(47, 158, 79, 0.85)" }} />
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
            } ${activeAxisKey === a.key ? "font-bold text-brand-dark" : "text-muted"}`}
            style={{ left: p.x, top: p.y }}
          >
            {a.label}
          </div>
        );
      })}
      {vertices.map(
        (v) =>
          v.winner && (
            <div
              key={v.axis.key}
              className={`absolute -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-sm text-center leading-tight shadow ${
                size > BASE_SIZE ? "w-32 text-[11px] p-1.5" : "w-24 text-[9px] p-1"
              } ${autoBg(v.winner.round - 1, ROUND_PALETTE_SOFT)} backdrop-blur-sm`}
              style={{ left: v.x, top: v.y }}
            >
              {v.winner.text}
              <div className="mt-0.5 font-semibold text-brand-dark">{voteTotal[v.winner.id] ?? 0} pts</div>
            </div>
          )
      )}
    </div>
  );
}
