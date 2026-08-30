"use client";

import { use, useEffect, useMemo, useState } from "react";
import Image from "next/image";
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

const STAGE_META: Record<RoundStage, { label: string; icon: string; badge: string }> = {
  pending: { label: "Pendiente", icon: "⏳", badge: "bg-white/10 text-white/60" },
  collect: { label: "Recolectando", icon: "✏️", badge: "bg-asp-2-soft text-asp-2" },
  vote: { label: "Votando", icon: "🗳️", badge: "bg-asp-1-soft text-asp-1" },
  closed: { label: "Cerrada", icon: "✅", badge: "bg-brand/20 text-brand" },
};

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
      const w = window.innerWidth;
      const h = window.innerHeight;
      const reserveForSidebar = w >= 900 ? 480 : 0;
      setSize(Math.round(Math.min(w - reserveForSidebar, h - 160) * 0.95));
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>
    );
  }

  if (!presenter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark px-4 text-center text-sm text-white/60">
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
    <div className="min-h-screen bg-dark bg-[radial-gradient(circle_at_50%_0%,rgba(128,198,18,0.08),transparent_60%)] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto brightness-0 invert" />
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{activity.title}</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name}
          </p>
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-[1400px] flex-col items-center gap-8 md:flex-row md:items-start md:justify-center md:gap-24">
        <RadarChartView axes={axes} winnerByAxis={winnerByAxis} voteTotal={voteTotal} size={size} activeAxisKey={liveAxisKeys} variant="dark" legend />

        <div className="w-full max-w-sm shrink-0 space-y-2 md:mt-8">
          {axes.map((a) => {
            const stage = content.roundStatus?.[a.key] ?? "pending";
            const meta = STAGE_META[stage];
            const winner = winnerByAxis[a.key];
            const live = liveAxisKeys.includes(a.key);
            return (
              <div
                key={a.key}
                className={`rounded-xl border p-3 transition-colors ${
                  live ? "border-brand/60 bg-white/[0.06]" : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{a.label}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>
                    {meta.icon} {meta.label}
                  </span>
                </div>
                {winner ? (
                  <p className="mt-1.5 text-xs text-white/70">
                    <span className="font-semibold text-brand">{voteTotal[winner.id] ?? 0} pts</span> · {winner.text}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-white/35">Sin resultado aún</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
