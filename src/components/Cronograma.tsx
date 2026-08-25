import Link from "next/link";
import type { SessionRow } from "@/lib/types";

const STATUS_LABEL: Record<SessionRow["status"], string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
};
const STATUS_CLASS: Record<SessionRow["status"], string> = {
  pendiente: "bg-black/5 text-muted",
  en_curso: "bg-amber-100 text-amber-800",
  completada: "bg-brand/15 text-brand-dark",
};

export default function Cronograma({
  sessions,
  progress,
}: {
  sessions: SessionRow[];
  progress?: Record<number, number>;
}) {
  return (
    <ol className="space-y-2">
      {sessions.map((s) => {
        const pct = progress?.[s.id];
        return (
          <li key={s.id}>
            <Link
              href={`/sesiones/${s.code}`}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 transition-colors hover:border-brand sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand-dark">
                  {s.code}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.name}</p>
                  <p className="text-xs text-muted">
                    {s.week_label} · {s.duration_label}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 pl-12 sm:pl-0">
                {pct !== undefined && (
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-black/10">
                    <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                )}
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[s.status]}`}>
                  {STATUS_LABEL[s.status]}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
