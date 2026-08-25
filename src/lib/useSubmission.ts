"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import type { ActivityRow, SessionRow } from "./types";
import type { StoredParticipant } from "./participant";
import { logActivity } from "./feed";

export function effectiveAspirationId(
  activity: ActivityRow,
  participant: StoredParticipant | null
): number | null {
  const perAspiration = Boolean(activity.config?.perAspiration);
  if (!perAspiration) return null;
  return participant?.aspiration_id ?? null;
}

interface UseSubmissionResult<T> {
  content: T;
  setContent: (next: T) => void;
  saving: boolean;
  updatedAt: string | null;
  save: (next?: T, opts?: { eventType?: string; summary?: string }) => Promise<void>;
  loaded: boolean;
}

export function useSubmission<T extends Record<string, unknown>>(
  activity: ActivityRow,
  session: SessionRow | null,
  aspirationId: number | null,
  participant: StoredParticipant | null,
  emptyContent: T
): UseSubmissionResult<T> {
  const [content, setContentState] = useState<T>(emptyContent);
  const [rowId, setRowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    let query = supabase.from("submissions").select("*").eq("activity_id", activity.id);
    query = aspirationId === null ? query.is("aspiration_id", null) : query.eq("aspiration_id", aspirationId);
    const { data } = await query.maybeSingle();
    if (data) {
      setRowId(data.id);
      setContentState({ ...emptyContent, ...(data.content as T) });
      setUpdatedAt(data.updated_at);
    } else {
      setRowId(null);
      setContentState(emptyContent);
      setUpdatedAt(null);
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.id, aspirationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`submission-${activity.id}-${aspirationId ?? "plenaria"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "submissions",
          filter: `activity_id=eq.${activity.id}`,
        },
        (payload) => {
          const row = payload.new as { id: string; aspiration_id: number | null; content: T; updated_at: string } | null;
          if (!row) return;
          const rowAsp = row.aspiration_id ?? null;
          if (rowAsp !== aspirationId) return;
          setRowId(row.id);
          setContentState({ ...emptyContent, ...row.content });
          setUpdatedAt(row.updated_at);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.id, aspirationId]);

  const persist = useCallback(
    async (next: T, opts?: { eventType?: string; summary?: string }) => {
      setSaving(true);
      const payload = {
        activity_id: activity.id,
        aspiration_id: aspirationId,
        content: next,
        updated_by: participant?.id ?? null,
        updated_at: new Date().toISOString(),
      };
      if (rowId) {
        const { error } = await supabase.from("submissions").update(payload).eq("id", rowId);
        if (error) console.error(error);
      } else {
        const { data, error } = await supabase.from("submissions").insert(payload).select("id").single();
        if (error) console.error(error);
        if (data) setRowId(data.id);
      }
      setUpdatedAt(payload.updated_at);
      setSaving(false);
      if (opts?.summary) {
        await logActivity({
          session_id: session?.id ?? activity.session_id,
          aspiration_id: aspirationId,
          participant_id: participant?.id ?? null,
          activity_id: activity.id,
          event_type: opts.eventType ?? "guardo",
          summary: opts.summary,
        });
      }
    },
    [activity.id, activity.session_id, aspirationId, participant?.id, rowId, session?.id]
  );

  const setContent = useCallback(
    (next: T) => {
      setContentState(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        persist(next);
      }, 700);
    },
    [persist]
  );

  const save = useCallback(
    async (next?: T, opts?: { eventType?: string; summary?: string }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await persist(next ?? content, opts);
    },
    [content, persist]
  );

  return { content, setContent, saving, updatedAt, save, loaded };
}
