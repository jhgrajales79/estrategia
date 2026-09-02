"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchAspirations, fetchSessionById } from "@/lib/data";
import { useSubmission } from "@/lib/useSubmission";
import { axisColor } from "@/components/RadarChartView";
import CapabilityWheelView from "@/components/CapabilityWheelView";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";
import type { StoredParticipant } from "@/lib/participant";

interface Item {
  id: string;
  key?: string;
  label: string;
  score: number;
  note?: string;
}
interface Content extends Record<string, unknown> {
  items: Item[];
}

function WheelPanel({
  activity,
  session,
  aspirationId,
  participant,
  scaleMax,
  size,
  active,
}: {
  activity: ActivityRow;
  session: SessionRow;
  aspirationId: number | null;
  participant: StoredParticipant;
  scaleMax: number;
  size: number;
  active: boolean;
}) {
  const { content, loaded } = useSubmission<Content>(activity, session, aspirationId, participant, { items: [] });

  if (!active) return null;
  if (!loaded) return <div className="flex h-[340px] items-center justify-center text-sm text-white/40">Cargando…</div>;

  return (
    <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-center md:gap-16">
      <CapabilityWheelView items={content.items} scaleMax={scaleMax} size={size} variant="dark" />
      <div className="w-full max-w-md shrink-0 space-y-2">
        {content.items.length === 0 ? (
          <p className="text-sm text-white/40">Aún no hay capacidades registradas.</p>
        ) : (
          content.items.map((it, i) => (
            <div key={it.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: axisColor(i) }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{it.label}</p>
                  <span className="shrink-0 text-sm font-bold text-brand">
                    {it.score}/{scaleMax}
                  </span>
                </div>
                {it.note && <p className="mt-1 text-xs text-white/50">{it.note}</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function RuedaFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [activeAspId, setActiveAspId] = useState<number | null>(null);
  const [size, setSize] = useState(420);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
    fetchActivityById(Number(activityId)).then((a) => {
      setActivity(a);
      if (a) fetchSessionById(a.session_id).then(setSession).catch(console.error);
    });
  }, [activityId]);

  useEffect(() => {
    if (activeAspId === null && aspirations.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveAspId(aspirations[0].id);
    }
  }, [aspirations, activeAspId]);

  useEffect(() => {
    function computeSize() {
      const w = window.innerWidth;
      setSize(Math.round(Math.min(w >= 900 ? w - 480 : w - 32, 520)));
    }
    computeSize();
    window.addEventListener("resize", computeSize);
    return () => window.removeEventListener("resize", computeSize);
  }, []);

  if (!participant || !activity || !session) {
    return <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>;
  }

  if (!presenter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark px-4 text-center text-sm text-white/60">
        Solo el facilitador puede abrir este tablero.
      </div>
    );
  }

  const perAspiration = Boolean(activity.config.perAspiration);
  const scaleMax = (activity.config.scaleMax as number) ?? 5;
  const tabs = perAspiration ? aspirations : [];

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
      </div>

      {perAspiration && (
        <div className="mx-auto mt-6 flex max-w-[1400px] flex-wrap gap-2">
          {tabs.map((a) => {
            const cls = aspClasses(a.number);
            const active = activeAspId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setActiveAspId(a.id)}
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

      <div className="mx-auto mt-10 max-w-[1400px]">
        {perAspiration ? (
          aspirations.map((a) => (
            <WheelPanel
              key={a.id}
              activity={activity}
              session={session}
              aspirationId={a.id}
              participant={participant}
              scaleMax={scaleMax}
              size={size}
              active={activeAspId === a.id}
            />
          ))
        ) : (
          <WheelPanel
            activity={activity}
            session={session}
            aspirationId={null}
            participant={participant}
            scaleMax={scaleMax}
            size={size}
            active
          />
        )}
      </div>
    </div>
  );
}
