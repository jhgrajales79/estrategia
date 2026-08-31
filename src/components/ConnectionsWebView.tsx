import { initials } from "@/components/activities/shared";

interface Thread {
  id: string;
  author: string;
  text: string;
}

export default function ConnectionsWebView({ threads, large = false }: { threads: Thread[]; large?: boolean }) {
  const size = large ? 420 : 280;
  const center = size / 2;
  const radius = size / 2 - (large ? 60 : 44);

  function point(i: number) {
    const angle = -90 + (360 / Math.max(threads.length, 1)) * i;
    const rad = (angle * Math.PI) / 180;
    return { x: center + radius * Math.cos(rad), y: center + radius * Math.sin(rad) };
  }

  if (threads.length === 0) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-1 text-center text-sm text-muted">
        <span className="text-2xl">🧶</span>
        Aún nadie ha lanzado su hilo.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0 overflow-visible">
          {threads.map((t, i) => {
            if (i === 0) return null;
            const a = point(i - 1);
            const b = point(i);
            return <line key={t.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--brand-dark)" strokeWidth={1.5} opacity={0.55} />;
          })}
          {threads.length > 2 &&
            (() => {
              const a = point(threads.length - 1);
              const b = point(0);
              return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--brand-dark)" strokeWidth={1.5} opacity={0.3} strokeDasharray="4 3" />;
            })()}
        </svg>
        {threads.map((t, i) => {
          const p = point(i);
          return (
            <div
              key={t.id}
              className="absolute flex items-center justify-center rounded-full bg-brand-dark font-bold text-white shadow ring-2 ring-card"
              style={{
                left: p.x,
                top: p.y,
                width: large ? 44 : 40,
                height: large ? 44 : 40,
                fontSize: large ? 13 : 11,
                transform: "translate(-50%, -50%)",
              }}
              title={`${t.author}: "${t.text}"`}
            >
              {initials(t.author)}
            </div>
          );
        })}
      </div>

      {/* Lista legible: la telaraña se ve bonita, pero el texto de cada hilo debe poder
          leerse sin depender de un hover (no funciona en proyección ni en táctil). */}
      <ul className={`mx-auto max-w-lg space-y-1.5 ${large ? "text-base" : "text-sm"}`}>
        {threads.map((t) => (
          <li key={t.id} className="flex gap-2">
            <span className="shrink-0 font-semibold text-brand-dark">{t.author}:</span>
            <span className="text-foreground">&ldquo;{t.text}&rdquo;</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
