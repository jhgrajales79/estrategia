export type IEGroup = "crecer" | "mantener" | "cosechar";

// Clasificación estándar de la Matriz Interna-Externa: el eje EFI (fuerte 3-4 / promedio 2-3 /
// débil 1-2) define la columna, el eje EFE (alto 3-4 / promedio 2-3 / bajo 1-2) la fila. Las 9
// celdas resultantes se agrupan en 3 estrategias (ver tabla GROUP_BY_CELL más abajo).
const GROUP_BY_CELL: Record<string, IEGroup> = {
  "strong,high": "crecer",
  "avg,high": "crecer",
  "weak,high": "mantener",
  "strong,avg": "crecer",
  "avg,avg": "mantener",
  "weak,avg": "cosechar",
  "strong,low": "mantener",
  "avg,low": "cosechar",
  "weak,low": "cosechar",
};

export function ieCategory(total: number, kind: "efi" | "efe"): "strong" | "avg" | "weak" | "high" | "low" {
  if (kind === "efi") return total >= 3 ? "strong" : total >= 2 ? "avg" : "weak";
  return total >= 3 ? "high" : total >= 2 ? "avg" : "low";
}

export function ieGroup(efiTotal: number, efeTotal: number): IEGroup {
  const col = ieCategory(efiTotal, "efi");
  const row = ieCategory(efeTotal, "efe");
  return GROUP_BY_CELL[`${col},${row}`];
}

const GROUP_FILL: Record<IEGroup, string> = {
  crecer: "fill-brand/15",
  mantener: "fill-amber-400/20",
  cosechar: "fill-red-400/15",
};

interface Point {
  x: number; // total EFI, 1-4
  y: number; // total EFE, 1-4
  colorClass: string; // ej. "fill-blue-500"
  label: string;
}

export default function IEMatrixGrid({ points, size = 360 }: { points: Point[]; size?: number }) {
  const cell = size / 3;
  const cols: Array<"strong" | "avg" | "weak"> = ["strong", "avg", "weak"];
  const rows: Array<"high" | "avg" | "low"> = ["high", "avg", "low"];
  const fontSize = Math.max(10, Math.round(size * 0.03));

  function toPixel(total: number, axis: "x" | "y") {
    const t = (total - 1) / 3; // 0 (débil/bajo) .. 1 (fuerte/alto)
    return size * (1 - t);
  }

  return (
    <svg width={size} height={size + 28} viewBox={`0 0 ${size} ${size + 28}`} className="rounded-md bg-black/[0.02]">
      {rows.map((r, ri) =>
        cols.map((c, ci) => (
          <rect
            key={`${c}-${r}`}
            x={ci * cell}
            y={ri * cell}
            width={cell}
            height={cell}
            className={GROUP_FILL[GROUP_BY_CELL[`${c},${r}`]]}
            stroke="currentColor"
            strokeOpacity={0.15}
          />
        ))
      )}
      <line x1={0} y1={0} x2={0} y2={size} stroke="currentColor" className="text-border" strokeWidth={1} />
      <line x1={size} y1={0} x2={size} y2={size} stroke="currentColor" className="text-border" strokeWidth={1} />
      <line x1={0} y1={0} x2={size} y2={0} stroke="currentColor" className="text-border" strokeWidth={1} />
      <line x1={0} y1={size} x2={size} y2={size} stroke="currentColor" className="text-border" strokeWidth={1} />

      <text x={size / 2} y={size + 18} fontSize={fontSize} textAnchor="middle" className="fill-muted font-semibold">
        EFI (fuerte ← → débil)
      </text>
      <text x={-size / 2} y={12} fontSize={fontSize} textAnchor="middle" className="fill-muted font-semibold" transform="rotate(-90)">
        EFE (alto ← → bajo)
      </text>

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={toPixel(p.x, "x")} cy={toPixel(p.y, "y")} r={Math.max(7, size * 0.022)} className={p.colorClass} stroke="white" strokeWidth={2} />
          <text
            x={toPixel(p.x, "x")}
            y={toPixel(p.y, "y") - Math.max(7, size * 0.022) - 4}
            fontSize={fontSize}
            textAnchor="middle"
            className="fill-foreground font-semibold"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
