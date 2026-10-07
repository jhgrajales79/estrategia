export default function QuadrantPoint({ x, y, range, size = 160 }: { x: number; y: number; range: number; size?: number }) {
  // x,y en rango [-range, range]; (0,0) es el centro del plano.
  const pad = Math.max(12, size * 0.075);
  const cx = size / 2 + (x / range) * (size / 2 - pad);
  const cy = size / 2 - (y / range) * (size / 2 - pad);
  const fontSize = Math.max(9, Math.round(size * 0.056));
  const labelInset = Math.max(4, size * 0.025);
  const dotRadius = Math.max(6, size * 0.0375);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-md bg-black/[0.02]">
      <line x1={size / 2} y1={0} x2={size / 2} y2={size} stroke="currentColor" className="text-border" strokeWidth={1} />
      <line x1={0} y1={size / 2} x2={size} y2={size / 2} stroke="currentColor" className="text-border" strokeWidth={1} />
      <text x={size - labelInset} y={fontSize + 3} fontSize={fontSize} textAnchor="end" className="fill-muted font-semibold">
        Agresiva
      </text>
      <text x={labelInset} y={fontSize + 3} fontSize={fontSize} className="fill-muted font-semibold">
        Conservadora
      </text>
      <text x={labelInset} y={size - labelInset} fontSize={fontSize} className="fill-muted font-semibold">
        Defensiva
      </text>
      <text x={size - labelInset} y={size - labelInset} fontSize={fontSize} textAnchor="end" className="fill-muted font-semibold">
        Competitiva
      </text>
      <circle cx={cx} cy={cy} r={dotRadius} className="fill-brand" />
    </svg>
  );
}
