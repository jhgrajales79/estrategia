interface Bar {
  label: string;
  value: number;
  colorClass?: string;
}

export default function BarChart({ bars, unit = "" }: { bars: Bar[]; unit?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="space-y-1.5">
      {bars.map((b, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-32 shrink-0 truncate text-muted" title={b.label}>
            {b.label}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-black/5">
            <div
              className={`h-full rounded ${b.colorClass ?? "bg-brand"}`}
              style={{ width: `${(b.value / max) * 100}%`, transition: "width 300ms ease" }}
            />
          </div>
          <span className="w-12 shrink-0 text-right font-medium text-foreground">
            {b.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}
