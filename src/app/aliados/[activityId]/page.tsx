"use client";

import { use, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchAspirations, fetchSessionById } from "@/lib/data";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { aspClasses, findAspiration, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";

interface Card {
  id: string;
  quadrant: string;
  text: string;
  aspiration_id: number | null;
  author: string;
  star?: boolean;
}
interface Content extends Record<string, unknown> {
  cards: Card[];
}
interface Quadrant {
  key: string;
  label: string;
}

// Convención de la metodología interés/influencia: el cuadrante "alto interés + alta
// influencia" es la zona a gestionar de cerca — se resalta si la config trae esas claves.
const PRIORITY_KEY = "alto_alto";
const AXIS_KEYS = new Set(["alto_alto", "alto_bajo", "bajo_alto", "bajo_bajo"]);

export default function AliadosFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
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
    { cards: [] }
  );

  const quadrants = useMemo(() => (activity?.config.quadrants as Quadrant[]) ?? [], [activity]);
  const starLabel = (activity?.config.starLabel as string) ?? "Aliado crítico";
  const useAxisLayout = quadrants.length === 4 && quadrants.every((q) => AXIS_KEYS.has(q.key));

  const cards = useMemo(
    () => (aspFilter === null ? content.cards : content.cards.filter((c) => c.aspiration_id === aspFilter)),
    [content.cards, aspFilter]
  );
  const cardsByQuadrant = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const q of quadrants) map.set(q.key, cards.filter((c) => c.quadrant === q.key));
    return map;
  }, [cards, quadrants]);

  const usedAspirations = useMemo(() => {
    const ids = new Set(content.cards.map((c) => c.aspiration_id).filter((id): id is number => id !== null));
    return aspirations.filter((a) => ids.has(a.id));
  }, [content.cards, aspirations]);

  const totalCards = cards.length;
  const totalStars = cards.filter((c) => c.star).length;
  const priorityCount = cardsByQuadrant.get(PRIORITY_KEY)?.length ?? 0;

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
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto brightness-0 invert" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{activity.title}</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
          <div className="text-center">
            <p className="text-xl font-bold leading-none">{totalCards}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/40">Aliados mapeados</p>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="text-center">
            <p className="text-xl font-bold leading-none text-accent-yellow">{totalStars}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/40">Críticos ⭐</p>
          </div>
          {useAxisLayout && (
            <>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-center">
                <p className="text-xl font-bold leading-none text-brand">{priorityCount}</p>
                <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/40">Gestionar de cerca</p>
              </div>
            </>
          )}
        </div>
      </div>

      {usedAspirations.length > 0 && (
        <div className="mx-auto mt-6 flex max-w-[1500px] flex-wrap gap-2">
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

      <div className="mx-auto mt-8 max-w-[1500px] pb-10">
        {useAxisLayout ? (
          <AxisQuadrantGrid
            quadrants={quadrants}
            cardsByQuadrant={cardsByQuadrant}
            aspirations={aspirations}
            starLabel={starLabel}
          />
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(quadrants.length, 2) || 1}, minmax(0,1fr))` }}>
            {quadrants.map((q) => (
              <QuadrantPanel
                key={q.key}
                label={q.label}
                cards={cardsByQuadrant.get(q.key) ?? []}
                aspirations={aspirations}
                starLabel={starLabel}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AxisQuadrantGrid({
  quadrants,
  cardsByQuadrant,
  aspirations,
  starLabel,
}: {
  quadrants: Quadrant[];
  cardsByQuadrant: Map<string, Card[]>;
  aspirations: Aspiration[];
  starLabel: string;
}) {
  const byKey = new Map(quadrants.map((q) => [q.key, q]));
  // Disposición del plano interés (x) × influencia (y): alta influencia arriba, alto
  // interés a la derecha — el mismo sentido en que se lee un plano cartesiano.
  const topLeft = byKey.get("bajo_alto");
  const topRight = byKey.get("alto_alto");
  const bottomLeft = byKey.get("bajo_bajo");
  const bottomRight = byKey.get("alto_bajo");

  return (
    <div className="flex gap-3">
      <div className="flex w-8 shrink-0 flex-col items-center justify-between py-2 text-white/40">
        <span className="text-lg leading-none">↑</span>
        <span className="rotate-180 text-[11px] font-semibold tracking-wide [writing-mode:vertical-rl]">INFLUENCIA</span>
        <span className="text-lg leading-none opacity-0">↑</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="grid grid-cols-2 gap-3">
          {topLeft && <QuadrantPanel label={topLeft.label} cards={cardsByQuadrant.get(topLeft.key) ?? []} aspirations={aspirations} starLabel={starLabel} />}
          {topRight && (
            <QuadrantPanel
              label={topRight.label}
              cards={cardsByQuadrant.get(topRight.key) ?? []}
              aspirations={aspirations}
              starLabel={starLabel}
              priority
            />
          )}
          {bottomLeft && <QuadrantPanel label={bottomLeft.label} cards={cardsByQuadrant.get(bottomLeft.key) ?? []} aspirations={aspirations} starLabel={starLabel} />}
          {bottomRight && <QuadrantPanel label={bottomRight.label} cards={cardsByQuadrant.get(bottomRight.key) ?? []} aspirations={aspirations} starLabel={starLabel} />}
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-white/40">
          <span className="text-[11px] font-semibold tracking-wide">INTERÉS</span>
          <span className="text-lg leading-none">→</span>
        </div>
      </div>
    </div>
  );
}

function QuadrantPanel({
  label,
  cards,
  aspirations,
  starLabel,
  priority = false,
}: {
  label: string;
  cards: Card[];
  aspirations: Aspiration[];
  starLabel: string;
  priority?: boolean;
}) {
  const stars = cards.filter((c) => c.star).length;
  // Estrellas primero, y dentro de cada grupo el orden en que se agregaron.
  const sorted = [...cards].sort((a, b) => Number(Boolean(b.star)) - Number(Boolean(a.star)));

  return (
    <div
      className={`flex min-h-[280px] flex-col rounded-2xl border p-4 ${
        priority ? "border-brand/50 bg-brand/[0.07] ring-1 ring-brand/30" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className={`text-sm font-semibold ${priority ? "text-brand" : "text-white"}`}>{label}</p>
          {priority && <p className="text-[11px] font-medium uppercase tracking-wide text-brand/70">Gestionar de cerca</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold text-white/70">{cards.length}</span>
          {stars > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-accent-yellow/15 px-2 py-0.5 font-semibold text-accent-yellow" title={starLabel}>
              ⭐ {stars}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-wrap content-start gap-2 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="w-full py-6 text-center text-xs text-white/30">Sin aliados en este cuadrante.</p>
        ) : (
          sorted.map((c) => {
            const asp = findAspiration(aspirations, c.aspiration_id);
            const cls = aspClasses(asp?.number);
            return (
              <div
                key={c.id}
                className={`flex max-w-full items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
                  c.star ? "border-accent-yellow/50 bg-accent-yellow/10" : "border-white/10 bg-white/[0.04]"
                }`}
                title={c.author}
              >
                {c.star && <span className="shrink-0 text-accent-yellow">⭐</span>}
                <span className="min-w-0 break-words text-white/90">{c.text}</span>
                {asp && <span className={`ml-1 h-2 w-2 shrink-0 rounded-full ${cls.bg}`} title={`Aspiración ${asp.number}`} />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
