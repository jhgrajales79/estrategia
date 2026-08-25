"use client";

import { useState } from "react";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";
import type { StoredParticipant } from "@/lib/participant";
import { ACTIVITY_COMPONENTS } from "@/components/activities";
import { effectiveAspirationId } from "@/lib/useSubmission";

export default function ActivityCard({
  activity,
  session,
  aspirations,
  participant,
  defaultOpen,
}: {
  activity: ActivityRow;
  session: SessionRow;
  aspirations: Aspiration[];
  participant: StoredParticipant;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const Component = ACTIVITY_COMPONENTS[activity.activity_type];
  const aspirationId = effectiveAspirationId(activity, participant);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <p className="text-sm font-semibold text-foreground">{activity.title}</p>
          {activity.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{activity.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {activity.time_minutes && (
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-muted">{activity.time_minutes} min</span>
          )}
          <span className="text-muted">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-4">
          {activity.description && <p className="mb-2 text-sm text-muted">{activity.description}</p>}
          {activity.materials && (
            <p className="mb-4 text-xs text-muted">
              <span className="font-medium">Materiales: </span>
              {activity.materials}
            </p>
          )}
          <Component activity={activity} session={session} aspirationId={aspirationId} aspirations={aspirations} participant={participant} />
        </div>
      )}
    </div>
  );
}
