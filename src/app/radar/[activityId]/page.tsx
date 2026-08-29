"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchSessionById } from "@/lib/data";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import RadarChartView from "@/components/RadarChartView";
import type { ActivityRow, SessionRow } from "@/lib/types";

interface Axis {
  key: string;
  label: string;
}
interface Signal {
  id: string;
  axis: string;
  ring: number;
  round: number;
  text: string;
  author: string;
  aspiration_id: number | null;
}
interface Vote {
  participant_id: string;
  signal_id: string;
  points: number;
}
type RoundStage = "pending" | "collect" | "vote" | "closed";

interface Content extends Record<string, unknown> {
  signals: Signal[];
  votes: Vote[];
  roundStatus: Record<string, RoundStage>;
}

export default function RadarFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [size, setSize] = useState(600);

  useEffect(() => {
    fetchActivityById(Number(activityId)).then((a) => {
      setActivity(a);
      if (a) fetchSessionById(a.session_id).then(setSession).catch(console.error);
    });
  }, [activityId]);

  useEffect(() => {
    function computeSize() {
      setSize(Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.82));
    }
    computeSize();
    window.addEventListener("resize", computeSize);
    return () => window.removeEventListener("resize", computeSize);
  }, []);

  const submissionAspId = activity ? effectiveAspirationId(activity, participant) : null;
  const { content, loaded } = useSubmission<Content>(
    activity ?? ({ id: -1, config: {} } as ActivityRow),
    session,
    submissionAspId,
    participant,
    { signals: [], votes: [], roundStatus: {} }
  );

  const voteTotal = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const v of content?.votes ?? []) totals[v.signal_id] = (totals[v.signal_id] ?? 0) + v.points;
    return totals;
  }, [content?.votes]);

  const axes = (activity?.config.axes as Axis[]) ?? [];
  const winnerByAxis = useMemo(() => {
    const winners: Record<string, Signal | undefined> = {};
    for (const a of axes) {
      const inAxis = (content?.signals ?? []).filter((s) => s.axis === a.key);
      let best: Signal | undefined;
      let bestVotes = -1;
      for (const s of inAxis) {
        const v = voteTotal[s.id] ?? 0;
        if (v > bestVotes) {
          best = s;
          bestVotes = v;
        }
      }
      winners[a.key] = bestVotes > 0 ? best : undefined;
    }
    return winners;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content?.signals, voteTotal, axes.length]);

  if (!participant || !activity || !session || !loaded) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted">Cargando…</div>;
  }

  if (!presenter) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-muted">
        Solo el facilitador puede abrir esta vista ampliada del radar.
      </div>
    );
  }

  const liveAxisKeys = axes
    .filter((a) => {
      const stage = content.roundStatus?.[a.key];
      return stage === "collect" || stage === "vote";
    })
    .map((a) => a.key);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6">
      <h1 className="text-2xl font-bold text-dark">{activity.title}</h1>
      <RadarChartView axes={axes} winnerByAxis={winnerByAxis} voteTotal={voteTotal} size={size} activeAxisKey={liveAxisKeys} />
    </div>
  );
}
