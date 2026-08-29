"use client";

import { useState } from "react";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";
import type { StoredParticipant } from "@/lib/participant";
import { ACTIVITY_COMPONENTS } from "@/components/activities";
import { effectiveAspirationId } from "@/lib/useSubmission";
import { resetActivityData } from "@/lib/data";
import { logActivity } from "@/lib/feed";
import { ToggleSwitch, LockBadge } from "@/components/activities/shared";
import InsumosPanel from "@/components/results/InsumosPanel";
import ActivityTimer from "@/components/ActivityTimer";

export default function ActivityCard({
  activity,
  session,
  aspirations,
  participant,
  presenter = false,
  onToggleEnabled,
}: {
  activity: ActivityRow;
  session: SessionRow;
  aspirations: Aspiration[];
  participant: StoredParticipant;
  presenter?: boolean;
  onToggleEnabled?: (activity: ActivityRow, next: boolean) => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const Component = ACTIVITY_COMPONENTS[activity.activity_type];
  const aspirationId = effectiveAspirationId(activity, participant);
  const locked = !activity.is_enabled && !presenter;
  const inputsFrom = (activity.config.inputsFrom as number[]) ?? [];

  async function handleReset() {
    setResetting(true);
    try {
      await resetActivityData(activity.id);
      setResetNonce((n) => n + 1);
      await logActivity({
        session_id: session.id,
        participant_id: participant.id,
        activity_id: activity.id,
        event_type: "actividad_reiniciada",
        summary: `${participant.name} reinició la información de "${activity.title}"`,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{activity.title}</p>
          {activity.description && <p className="mt-0.5 text-xs text-muted">{activity.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {activity.time_minutes ? (
            <ActivityTimer activity={activity} totalSeconds={activity.time_minutes * 60} presenter={presenter} />
          ) : null}
          {presenter && onToggleEnabled && (
            <ToggleSwitch checked={activity.is_enabled} onChange={(next) => onToggleEnabled(activity, next)} />
          )}
        </div>
      </div>
      {locked ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <LockBadge text="Aún no habilitada" />
          <p className="text-sm text-muted">El facilitador debe habilitar esta actividad para que puedas participar.</p>
        </div>
      ) : (
        <div className="px-4 py-4">
          {activity.materials && (
            <p className="mb-4 text-xs text-muted">
              <span className="font-medium">Materiales: </span>
              {activity.materials}
            </p>
          )}
          {inputsFrom.length > 0 && <InsumosPanel sourceIds={inputsFrom} aspirations={aspirations} />}
          {presenter && (
            <div className="mb-4">
              {!confirmReset ? (
                <button
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                  onClick={() => setConfirmReset(true)}
                >
                  🗑 Reiniciar datos de esta actividad
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-300 bg-red-50 p-2.5 text-xs text-red-800">
                  <span>
                    ¿Seguro? Se borrará lo registrado por todos los equipos en &ldquo;{activity.title}&rdquo;. No se puede deshacer.
                  </span>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <button
                      className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-black/5"
                      onClick={() => setConfirmReset(false)}
                      disabled={resetting}
                    >
                      Cancelar
                    </button>
                    <button
                      className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      onClick={handleReset}
                      disabled={resetting}
                    >
                      {resetting ? "Reiniciando…" : "Sí, reiniciar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <Component
            key={resetNonce}
            activity={activity}
            session={session}
            aspirationId={aspirationId}
            aspirations={aspirations}
            participant={participant}
          />
        </div>
      )}
    </div>
  );
}
