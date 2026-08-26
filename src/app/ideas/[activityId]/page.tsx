"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchSessionById } from "@/lib/data";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import IdeaCloudView from "@/components/IdeaCloudView";
import type { ActivityRow, SessionRow } from "@/lib/types";

interface Candidate {
  id: string;
  text: string;
}
interface Vote {
  participant_id: string;
  candidate_id: string;
  points: number;
}
interface Content extends Record<string, unknown> {
  candidates: Candidate[];
  votes: Vote[];
}

export default function IdeasFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);

  useEffect(() => {
    fetchActivityById(Number(activityId)).then((a) => {
      setActivity(a);
      if (a) fetchSessionById(a.session_id).then(setSession).catch(console.error);
    });
  }, [activityId]);

  const submissionAspId = activity ? effectiveAspirationId(activity, participant) : null;
  const { content, loaded } = useSubmission<Content>(
    activity ?? ({ id: -1, config: {} } as ActivityRow),
    session,
    submissionAspId,
    participant,
    { candidates: [], votes: [] }
  );

  const ideas = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const v of content?.votes ?? []) totals[v.candidate_id] = (totals[v.candidate_id] ?? 0) + v.points;
    return (content?.candidates ?? []).map((c) => ({ id: c.id, text: c.text, votes: totals[c.id] ?? 0 }));
  }, [content?.candidates, content?.votes]);

  if (!participant || !activity || !session || !loaded) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted">Cargando…</div>;
  }

  if (!presenter) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-muted">
        Solo el facilitador puede abrir esta vista ampliada.
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background p-8">
      <h1 className="shrink-0 text-center text-3xl font-bold text-foreground">{activity.title}</h1>
      <div className="min-h-0 flex-1">
        <IdeaCloudView ideas={ideas} large />
      </div>
    </div>
  );
}
