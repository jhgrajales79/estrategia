"use client";

import { use, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchSessionById } from "@/lib/data";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import IdeaCloudView from "@/components/IdeaCloudView";
import type { ActivityRow, SessionRow } from "@/lib/types";

interface Candidate {
  id: string;
  text: string;
  author?: string;
  starred?: boolean;
}
interface Vote {
  participant_id: string;
  candidate_id: string;
  points: number;
}
type Phase = "sketch" | "gallery" | "closed";
interface Content extends Record<string, unknown> {
  candidates: Candidate[];
  votes: Vote[];
  phase?: Phase;
}

const PHASE_META: Record<Phase, { label: string; icon: string; badge: string }> = {
  sketch: { label: "Boceto individual", icon: "✏️", badge: "bg-asp-2-soft text-asp-2" },
  gallery: { label: "Galería y votación", icon: "🗳️", badge: "bg-asp-1-soft text-asp-1" },
  closed: { label: "Cerrada", icon: "✅", badge: "bg-brand/20 text-brand" },
};

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

  const phase = content?.phase;
  const hasPhases = phase !== undefined;
  const visibleCandidates = useMemo(() => {
    const all = content?.candidates ?? [];
    if (!hasPhases) return all;
    if (phase === "sketch") return [];
    return all.filter((c) => c.starred);
  }, [content?.candidates, hasPhases, phase]);

  const ideas = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const v of content?.votes ?? []) totals[v.candidate_id] = (totals[v.candidate_id] ?? 0) + v.points;
    return visibleCandidates
      .map((c) => ({ id: c.id, text: c.text, votes: totals[c.id] ?? 0, author: c.author }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [visibleCandidates, content?.votes]);

  const topIds = useMemo(() => {
    if (phase !== "closed") return [];
    return [...ideas]
      .sort((a, b) => b.votes - a.votes)
      .filter((i) => i.votes > 0)
      .slice(0, 3)
      .map((i) => i.id);
  }, [ideas, phase]);

  if (!participant || !activity || !session || !loaded) {
    return <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>;
  }

  if (!presenter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark px-4 text-center text-sm text-white/60">
        Solo el facilitador puede abrir esta vista ampliada.
      </div>
    );
  }

  const startedCount = new Set((content?.candidates ?? []).filter((c) => c.text.trim()).map((c) => c.author)).size;
  const meta = phase ? PHASE_META[phase] : null;

  return (
    <div
      className="grid gap-6 overflow-hidden bg-dark bg-[radial-gradient(circle_at_50%_0%,rgba(128,198,18,0.08),transparent_60%)] p-8 text-white"
      style={{ height: "100vh", gridTemplateRows: "auto 1fr" }}
    >
      <div className="mx-auto flex items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto brightness-0 invert" />
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{activity.title}</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name}
          </p>
        </div>
        {meta && (
          <span className={`ml-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.badge}`}>
            {meta.icon} {meta.label}
          </span>
        )}
      </div>
      <div className="min-h-0 min-w-0">
        {hasPhases && phase === "sketch" ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-5xl">✏️</p>
            <p className="text-xl font-semibold">El grupo está bocetando sus ideas…</p>
            <p className="text-sm text-white/50">
              {startedCount} {startedCount === 1 ? "persona ya escribió" : "personas ya escribieron"} ideas. La galería
              aparecerá aquí cuando el facilitador la abra.
            </p>
          </div>
        ) : (
          <IdeaCloudView ideas={ideas} large topIds={topIds} dark />
        )}
      </div>
    </div>
  );
}
