"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>
    );
  }

  if (!presenter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark px-4 text-center text-sm text-white/60">
        Solo el facilitador puede abrir esta vista ampliada.
      </div>
    );
  }

  const categories = (activity.config.categories as { key: string; label: string }[]) ?? [];
  const totalNotes = content.notes.length;

  return (
    <div className="min-h-screen bg-dark bg-[radial-gradient(circle_at_50%_0%,rgba(128,198,18,0.08),transparent_60%)] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto brightness-0 invert" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{activity.title}</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
          {totalNotes} {totalNotes === 1 ? "aporte" : "aportes"}
        </span>
      </div>

      <div className="mx-auto mt-10 max-w-[1400px]">
        {totalNotes === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 py-24 text-center">
            <span className="text-3xl">🗒️</span>
            <p className="text-sm text-white/40">Aún no hay aportes registrados en esta actividad.</p>
          </div>
        ) : (
          <NotesBoardView
            categories={categories}
            notes={content.notes}
            aspirations={aspirations}
            showOnlyHighlighted={content.showOnlyHighlighted}
            large
            dark
          />
        )}
      </div>
    </div>
  );
}
