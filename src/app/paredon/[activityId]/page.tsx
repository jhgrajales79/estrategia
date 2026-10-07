"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchAspirations, fetchSessionById, fetchSubmissionsByActivityIds } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";

interface Card {
  id: string;
  perspective: string;
  aspiration_id: number | null;
  author: string;
  text: string;
  leads_to: string[];
  highlighted?: boolean;
}
interface PerspectiveDef {
  key: string;
  label: string;
}

// Tablero de solo lectura para "El paredón estratégico" (mapa_estrategico): perspectivas
// apiladas de abajo hacia arriba, igual que en la actividad en vivo, mostrando además a qué
// objetivo(s) de la perspectiva de arriba lleva cada tarjeta (la cadena causal del mapa).
// Submission única y compartida (no perAspiration) — las tarjetas se etiquetan por color según
// la aspiración de quien las escribió.
export default function ParedonFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
    fetchActivityById(Number(activityId)).then((a) => {
      setActivity(a);
      if (a) fetchSessionById(a.session_id).then(setSession).catch(console.error);
    });
  }, [activityId]);

  useEffect(() => {
    async function load() {
      const subs = await fetchSubmissionsByActivityIds([Number(activityId)]);
      const shared = subs.find((s) => s.aspiration_id === null);
      setCards(((shared?.content as { cards?: Card[] } | null)?.cards) ?? []);
      setLoaded(true);
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`paredon-board-${activityId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${activityId}` }, () => {
        load().catch(console.error);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activityId]);

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

  const perspectives = (activity.config.perspectives as PerspectiveDef[]) ?? [];
  // De abajo hacia arriba, igual que en el paredón físico y en la actividad en vivo.
  const orderedPerspectives = [...perspectives].reverse();
  const cardById = new Map(cards.map((c) => [c.id, c]));

  return (
    <div className="min-h-screen bg-dark bg-[radial-gradient(circle_at_50%_0%,rgba(128,198,18,0.08),transparent_60%)] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto brightness-0 invert" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{activity.title}</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
          {cards.length} {cards.length === 1 ? "objetivo" : "objetivos"}
        </span>
      </div>

      <div className="mx-auto mt-8 flex max-w-[1500px] flex-col-reverse gap-4">
        {orderedPerspectives.map((p) => {
          const cardsIn = cards.filter((c) => c.perspective === p.key);
          return (
            <div key={p.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">{p.label}</p>
              {cardsIn.length === 0 ? (
                <p className="py-6 text-center text-sm italic text-white/30">Aún sin objetivos en esta perspectiva.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {cardsIn.map((c) => {
                    const asp = findAspiration(aspirations, c.aspiration_id);
                    const cls = aspClasses(asp?.number);
                    const above = c.leads_to.map((id) => cardById.get(id)).filter((x): x is Card => Boolean(x));
                    return (
                      <div
                        key={c.id}
                        className={`w-60 rounded-xl border bg-white/[0.04] p-3 ${
                          c.highlighted ? "border-brand/60 bg-brand/5" : asp ? cls.border : "border-white/10"
                        }`}
                      >
                        <p className="text-sm leading-snug text-white">{c.text}</p>
                        {above.length > 0 && (
                          <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                            {above.map((a) => (
                              <p key={a.id} className="text-[11px] text-white/40">
                                ↑ lleva a: {a.text.slice(0, 40)}
                              </p>
                            ))}
                          </div>
                        )}
                        <p className="mt-2 text-[11px] text-white/30">{c.author}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
