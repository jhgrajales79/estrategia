"use client";

import { use, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchAspirations, fetchSessionById } from "@/lib/data";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { aspClasses, findAspiration, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";

interface Candidate {
  id: string;
  text: string;
  author: string;
  owner?: string;
  target_date?: string;
  aspiration_id?: number | null;
  impact?: "alto" | "medio" | "bajo";
}
interface Vote {
  participant_id: string;
  participant_name: string;
  candidate_id: string;
  points: number;
}
interface Content extends Record<string, unknown> {
  candidates: Candidate[];
  votes: Vote[];
}

const IMPACT_META: Record<string, { label: string; dot: string; text: string }> = {
  alto: { label: "Alto", dot: "bg-red-400", text: "text-red-300" },
  medio: { label: "Medio", dot: "bg-amber-400", text: "text-amber-300" },
  bajo: { label: "Bajo", dot: "bg-brand", text: "text-brand" },
};
const RANK_BADGE = ["bg-[#f4c542] text-dark", "bg-[#c7ccd1] text-dark", "bg-[#d99a5b] text-dark"];

export default function VotacionFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [aspFilter, setAspFilter] = useState<number | null>(null);

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
    { candidates: [], votes: [] }
  );

  const pointsPerPerson = (activity?.config.pointsPerPerson as number) ?? 3;

  const usedAspirations = useMemo(() => {
    const ids = new Set(content.candidates.map((c) => c.aspiration_id).filter((id): id is number => id !== undefined && id !== null));
    return aspirations.filter((a) => ids.has(a.id));
  }, [content.candidates, aspirations]);

  const ranked = useMemo(() => {
    const totals = content.candidates.map((c) => ({
      c,
      total: content.votes.filter((v) => v.candidate_id === c.id).reduce((a, v) => a + v.points, 0),
    }));
    const filtered = aspFilter === null ? totals : totals.filter((t) => t.c.aspiration_id === aspFilter);
    return filtered.sort((a, b) => b.total - a.total);
  }, [content.candidates, content.votes, aspFilter]);

  const maxTotal = Math.max(1, ...ranked.map((r) => r.total));
  const pointsCast = content.votes.reduce((a, v) => a + v.points, 0);
  const votersCount = new Set(content.votes.map((v) => v.participant_id)).size;

  if (!participant || !activity || !session || !loaded) {
    return <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>;
  }

  if (!presenter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark px-4 text-center text-sm text-white/60">
        Solo el facilitador puede abrir este tablero.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark bg-[radial-gradient(circle_at_50%_0%,rgba(128,198,18,0.08),transparent_60%)] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto brightness-0 invert" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{activity.title}</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
          <div className="text-center">
            <p className="text-xl font-bold leading-none">{pointsCast}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/40">Puntos asignados</p>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="text-center">
            <p className="text-xl font-bold leading-none">{votersCount}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/40">Participantes votaron</p>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="text-center">
            <p className="text-xl font-bold leading-none">{content.candidates.length}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/40">Debilidades en juego</p>
          </div>
        </div>
      </div>

      {usedAspirations.length > 0 && (
        <div className="mx-auto mt-6 flex max-w-[1400px] flex-wrap gap-2">
          <button
            onClick={() => setAspFilter(null)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              aspFilter === null ? "border-transparent bg-brand text-dark" : "border-white/15 bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
            }`}
          >
            Todas
          </button>
          {usedAspirations.map((a) => {
            const cls = aspClasses(a.number);
            const active = aspFilter === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setAspFilter(a.id)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                  active ? `border-transparent ${cls.bg} text-dark` : "border-white/15 bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
                }`}
              >
                Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
              </button>
            );
          })}
        </div>
      )}

      <div className="mx-auto mt-8 max-w-[1400px] space-y-3 pb-10">
        {ranked.length === 0 ? (
          <p className="py-16 text-center text-lg text-white/40">Aún no hay debilidades registradas para priorizar.</p>
        ) : (
          ranked.map(({ c, total }, idx) => {
            const asp = findAspiration(aspirations, c.aspiration_id);
            const aspCls = aspClasses(asp?.number);
            const impactMeta = c.impact ? IMPACT_META[c.impact] : null;
            const isTop = idx < 3 && total > 0;
            return (
              <div
                key={c.id}
                className={`flex items-center gap-5 rounded-2xl border p-5 transition-colors ${
                  isTop ? "border-brand/40 bg-brand/[0.06]" : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-lg font-bold ${
                    isTop ? `border-transparent ${RANK_BADGE[idx]}` : "border-white/20 bg-white/[0.08] text-white/80"
                  }`}
                >
                  {idx + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xl font-semibold leading-tight sm:text-2xl" title={c.text}>
                    {c.text}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/40">
                    <span>{c.author}</span>
                    {c.owner && <span>· doliente: {c.owner}</span>}
                    {c.target_date && <span>· fecha objetivo: {c.target_date}</span>}
                    {asp && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${aspCls.bg} text-dark`}>
                        Aspiración {asp.number}
                      </span>
                    )}
                    {impactMeta && (
                      <span className={`inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold ${impactMeta.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${impactMeta.dot}`} />
                        Impacto {impactMeta.label}
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${isTop ? "bg-brand" : "bg-white/25"}`}
                      style={{ width: `${(total / maxTotal) * 100}%` }}
                    />
                  </div>
                </div>

                <span className={`shrink-0 text-3xl font-bold tabular-nums ${isTop ? "text-brand" : "text-white/70"}`}>{total}</span>
              </div>
            );
          })
        )}
      </div>

      <p className="mx-auto max-w-[1400px] pb-2 text-center text-xs text-white/30">
        Cada participante reparte {pointsPerPerson} puntos entre las debilidades más urgentes de resolver.
      </p>
    </div>
  );
}
