"use client";

import { use, useEffect, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchAspirations, fetchSessionById } from "@/lib/data";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import NotesBoardView from "@/components/NotesBoardView";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";

interface Note {
  id: string;
  category: string;
  aspiration_id: number | null;
  author: string;
  text: string;
  impact?: "alto" | "medio" | "bajo";
  highlighted?: boolean;
}
interface Content extends Record<string, unknown> {
  notes: Note[];
  showOnlyHighlighted: boolean;
}

export default function NotasFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
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
    { notes: [], showOnlyHighlighted: false }
  );

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

  const categories = (activity.config.categories as { key: string; label: string }[]) ?? [];

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="mb-8 text-center text-3xl font-bold text-foreground">{activity.title}</h1>
      <NotesBoardView categories={categories} notes={content.notes} aspirations={aspirations} showOnlyHighlighted={content.showOnlyHighlighted} large />
    </div>
  );
}
