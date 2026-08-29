import Link from "next/link";
import type { SessionRow } from "@/lib/types";
import { ToggleSwitch, LockBadge } from "@/components/activities/shared";

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
  presenter = false,
  onToggleEnabled,
  twoColumn = false,
}: {
  sessions: SessionRow[];
  progress?: Record<number, number>;
  presenter?: boolean;
  onToggleEnabled?: (session: SessionRow, next: boolean) => void;
  twoColumn?: boolean;
}) {
  return (
    <ol className={twoColumn ? "grid gap-2 xl:grid-cols-2" : "space-y-2"}>
      {sessions.map((s) => {
        const pct = progress?.[s.id];
        const locked = !s.is_enabled && !presenter;
        const body = (
          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                s.is_enabled ? "bg-brand/10 text-brand-dark" : "bg-black/5 text-muted"
              }`}
            >
              {s.code}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{s.name}</p>
              <p className="text-xs text-muted">
                {s.week_label} · {s.duration_label}
              </p>
            </div>
          </div>
        );
        const tail = (
          <div className="flex shrink-0 items-center gap-3 pl-12 sm:pl-0">
            <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-black/10">
              {pct !== undefined && s.is_enabled && <div className="h-full bg-brand" style={{ width: `${pct}%` }} />}
            </div>
            <div className="w-28 shrink-0">
              {locked ? (
                <LockBadge text="No habilitada" />
              ) : (
                <span className={`inline-flex w-full justify-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[s.status]}`}>
                  {STATUS_LABEL[s.status]}
                </span>
              )}
            </div>
          </div>
        );
        return (
          <li
            key={s.id}
            className={`flex flex-col gap-2 rounded-lg border border-border bg-card p-3 transition-colors sm:flex-row sm:items-center sm:justify-between ${
              locked ? "opacity-60" : ""
            }`}
          >
            {locked ? body : (
              <Link href={`/sesiones/${s.code}`} className="contents hover:[&_p]:text-brand-dark">
                {body}
              </Link>
            )}
            <div className="flex shrink-0 items-center gap-3">
              {tail}
              {presenter && onToggleEnabled && (
                <ToggleSwitch checked={s.is_enabled} onChange={(next) => onToggleEnabled(s, next)} />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
