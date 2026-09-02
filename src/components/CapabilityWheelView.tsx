import { axisColor } from "@/components/RadarChartView";

interface Item {
  id: string;
  label: string;
  score: number;
  note?: string;
}

const BASE_SIZE = 340;

const THEME = {
  light: {
    grid: "rgba(18, 60, 73, 0.14)",
    polygonFill: "rgba(8, 112, 98, 0.14)",
    polygonStroke: "rgba(8, 112, 98, 0.6)",
    caption: "var(--muted)",
  },
  dark: {
    grid: "rgba(255, 255, 255, 0.14)",
    polygonFill: "rgba(128, 198, 18, 0.16)",
    polygonStroke: "rgba(128, 198, 18, 0.65)",
    caption: "rgba(255, 255, 255, 0.5)",
  },
};

export default function CapabilityWheelView({
  items,
  scaleMax,
  size = BASE_SIZE,
  variant = "light",
}: {
  items: Item[];
  scaleMax: number;
  size?: number;
  variant?: "light" | "dark";
}) {
  const t = THEME[variant];
  const n = items.length;
  const center = size / 2;
  const maxR = size / 2 - (size > BASE_SIZE ? 40 : 30);

  function axisAngle(i: number) {
    return -90 + (360 / Math.max(n, 1)) * i;
  }
  function point(angleDeg: number, radiusFrac: number) {
    const rad = (angleDeg * Math.PI) / 180;
    const r = radiusFrac * maxR;
    return { x: center + r * Math.cos(rad), y: center + r * Math.sin(rad) };
  }

  if (n === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-center text-sm" style={{ color: t.caption }}>
        Aún no hay capacidades registradas.
      </div>
    );
  }

  const vertices = items.map((it, i) => ({ ...point(axisAngle(i), scaleMax > 0 ? it.score / scaleMax : 0), item: it }));
  const polygonPoints = vertices.map((v) => `${v.x},${v.y}`).join(" ");
  const ringLevels = Array.from({ length: scaleMax }, (_, i) => i + 1);
  const badgeSize = size > BASE_SIZE ? 26 : 20;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 overflow-visible">
        {ringLevels.map((lvl) => (
          <circle key={lvl} cx={center} cy={center} r={(lvl / scaleMax) * maxR} fill="none" stroke={t.grid} strokeWidth={1} />
        ))}
        {items.map((it, i) => {
          const p = point(axisAngle(i), 1);
          return <line key={it.id} x1={center} y1={center} x2={p.x} y2={p.y} stroke={t.grid} strokeWidth={1} />;
        })}
        <polygon points={polygonPoints} style={{ fill: t.polygonFill, stroke: t.polygonStroke }} strokeWidth={2} strokeLinejoin="round" />
        {vertices.map((v, i) => (
          <circle
            key={items[i].id}
            cx={v.x}
            cy={v.y}
            r={size > BASE_SIZE ? 6 : 4.5}
            fill={axisColor(i)}
            stroke={variant === "dark" ? "#0b1f18" : "#fff"}
            strokeWidth={2}
          />
        ))}
      </svg>
      {/* Insignia numerada en la punta de cada radio: identifica el eje sin escribir la
          etiqueta completa sobre el gráfico (los nombres de capacidad son texto libre y
          pueden ser largos). El nombre completo se lee en la lista al lado del tablero. */}
      {items.map((it, i) => {
        const p = point(axisAngle(i), 1);
        return (
          <div
            key={it.id}
            className="absolute flex shrink-0 items-center justify-center rounded-full font-bold shadow"
            style={{
              left: p.x,
              top: p.y,
              width: badgeSize,
              height: badgeSize,
              fontSize: size > BASE_SIZE ? 12 : 10,
              backgroundColor: axisColor(i),
              color: "#fff",
              transform: "translate(-50%, -50%)",
            }}
          >
            {i + 1}
          </div>
        );
      })}
    </div>
  );
}
