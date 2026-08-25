export default function QuadrantPoint({ x, y, range }: { x: number; y: number; range: number }) {
  // x,y en rango [-range, range]; (0,0) es el centro del plano.
  const size = 160;
  const cx = size / 2 + (x / range) * (size / 2 - 12);
  const cy = size / 2 - (y / range) * (size / 2 - 12);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-md bg-black/[0.02]">
      <line x1={size / 2} y1={0} x2={size / 2} y2={size} stroke="currentColor" className="text-border" strokeWidth={1} />
      <line x1={0} y1={size / 2} x2={size} y2={size / 2} stroke="currentColor" className="text-border" strokeWidth={1} />
      <text x={size - 4} y={12} fontSize={9} textAnchor="end" className="fill-muted">
        Agresiva
      </text>
      <text x={4} y={12} fontSize={9} className="fill-muted">
        Conservadora
      </text>
      <text x={4} y={size - 4} fontSize={9} className="fill-muted">
        Defensiva
      </text>
      <text x={size - 4} y={size - 4} fontSize={9} textAnchor="end" className="fill-muted">
        Competitiva
      </text>
      <circle cx={cx} cy={cy} r={6} className="fill-brand" />
    </svg>
  );
}
