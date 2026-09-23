"use client";

import { useEffect, useState } from "react";
import { useSubmission, effectiveAspirationId, fetchLatestContent } from "@/lib/useSubmission";
import { aspAbbrev, aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import { isPresenter } from "@/lib/presenter";
import { supabase } from "@/lib/supabase";
import { ActivityComponentProps, SaveIndicator, PresenterHint, btnGhost, POLARITY_META, NotePolarity } from "./shared";

// Nota clasificada tal como la deja el POAM (ConsolidacionImpacto) — solo nos interesan las de
// impact "alto": son las candidatas a top 3 por aspiración.
interface PoamNote {
  id: string;
  text: string;
  author: string;
  category: string;
  impact?: "alto" | "medio" | "bajo";
  aspiration_id: number | null;
}

interface Vote {
  participant_id: string;
  candidate_id: string;
}

interface Content extends Record<string, unknown> {
  votes: Vote[];
}

const PLURAL_LABEL: Record<NotePolarity, string> = { oportunidad: "Oportunidades", amenaza: "Amenazas" };

export default function SintesisEntorno({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const topFrom = activity.config.topFrom as number | undefined;
  const topN = (activity.config.topN as number) || 3;
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { votes: [] }
  );
  const [source, setSource] = useState<PoamNote[]>([]);
  // La votación es una selección informativa por aspiración: en "Todas" solo se ve el
  // acumulado, no tiene sentido elegir mezclando candidatas de los 3 grupos.
  const [activeAspId, setActiveAspId] = useState<number | "all">(() => aspirations[0]?.id ?? "all");

  async function fetchSource() {
    if (!topFrom) return;
    const { data } = await supabase.from("submissions").select("content").eq("activity_id", topFrom).is("aspiration_id", null).maybeSingle();
    const notes = ((data?.content as { notes?: PoamNote[] } | null)?.notes) ?? [];
    setSource(notes.filter((n) => n.impact === "alto"));
  }

  useEffect(() => {
    fetchSource();
    if (!topFrom) return;
    // El POAM puede seguir ajustándose (reclasificaciones de último minuto) mientras el grupo
    // ya está votando el cierre — nos suscribimos para que las candidatas se actualicen solas.
    const channel = supabase
      .channel(`sintesis-source-${topFrom}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${topFrom}` },
        () => fetchSource()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topFrom]);

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  const matchesAsp = (id: number | null) => activeAspId === "all" || id === activeAspId;
  // La votación decide el top 3 combinando las tres aspiraciones — se hace desde "Todas". Las
  // pestañas de aspiración son solo para revisar qué candidatas de alto impacto aportó ese
  // grupo, sin votar ahí.
  const canVote = !presenter && activeAspId === "all";

  async function toggleVote(candidatesInCategory: PoamNote[], candidateId: string) {
    const latest = await fetchLatestContent<Content>(activity.id, submissionAspId, { votes: [] });
    const mine = latest.votes.filter((v) => v.participant_id === participant.id);
    const alreadyVoted = mine.some((v) => v.candidate_id === candidateId);
    if (alreadyVoted) {
      save({ votes: latest.votes.filter((v) => !(v.participant_id === participant.id && v.candidate_id === candidateId)) });
      return;
    }
    // Tope de `topN` elecciones por persona, por categoría — no global — así elegir amenazas
    // no le quita cupo a las oportunidades.
    const idsInCategory = new Set(candidatesInCategory.map((c) => c.id));
    const usedInCategory = mine.filter((v) => idsInCategory.has(v.candidate_id)).length;
    if (usedInCategory >= topN) return;
    save({ votes: [...latest.votes, { participant_id: participant.id, candidate_id: candidateId }] });
  }

  function Section({ categoryKey }: { categoryKey: NotePolarity }) {
    const meta = POLARITY_META[categoryKey];
    // El top 3 y el corte de empate se calculan SIEMPRE sobre el universo completo de la
    // categoría (las tres aspiraciones juntas) — es la misma escala que usa "Todas", donde
    // ocurre la votación. Si se recalculara solo con las candidatas de la pestaña de aspiración
    // que se esté viendo, el trofeo podría no coincidir con el top 3 real (p. ej. una candidata
    // que sí es top 3 a nivel general podría quedar sin marcar al filtrar por su aspiración, o
    // viceversa). Ver también SintesisFullscreenBoard en notas/[activityId]/page.tsx.
    const allInCategory = source.filter((n) => n.category === categoryKey);
    const needsVote = allInCategory.length > topN;
    const globalRanked = allInCategory
      .map((c) => ({ c, votes: content.votes.filter((v) => v.candidate_id === c.id).length }))
      .sort((a, b) => b.votes - a.votes);
    // Punto de corte del top N por votos. Si hay empate justo en la frontera (p. ej. 3 candidatas
    // con 1 voto disputando el 3er lugar), todas las que igualen ese conteo se marcan como
    // ganadoras — el sistema no debe inventar un desempate que el grupo no hizo. `votes > 0`
    // evita que, mientras nadie ha votado, el corte en 0 corone a candidatas sin apoyo real.
    const cutoffVotes = needsVote ? globalRanked[topN - 1]?.votes ?? 0 : 0;
    const isWinner = (votes: number) => votes > 0 && votes >= cutoffVotes;

    // Lo que se MUESTRA sí respeta la pestaña activa (una aspiración, o todas).
    const candidates = allInCategory.filter((n) => matchesAsp(n.aspiration_id));
    const ranked = candidates
      .map((c) => ({ c, votes: content.votes.filter((v) => v.candidate_id === c.id).length }))
      .sort((a, b) => b.votes - a.votes);
    const myPicks = content.votes.filter(
      (v) => v.participant_id === participant.id && allInCategory.some((c) => c.id === v.candidate_id)
    ).length;

    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            {meta.icon} {PLURAL_LABEL[categoryKey]}
          </p>
          {needsVote && canVote && (
            <span className="text-xs text-muted">
              {myPicks}/{topN} elegidas
            </span>
          )}
        </div>
        {candidates.length === 0 ? (
          <p className="text-xs text-muted">
            Aún no hay {PLURAL_LABEL[categoryKey].toLowerCase()} de alto impacto en el POAM para esta vista.
          </p>
        ) : !needsVote ? (
          // 3 o menos candidatas de alto impacto: son el top directo, no hace falta votar.
          <ul className="space-y-1.5">
            {candidates.map((c) => (
              <li key={c.id} className="text-sm text-foreground">
                🏆 {c.text} <span className="text-xs text-muted">— {c.author}</span>
                {activeAspId === "all" && (
                  <span className="ml-1 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                    {aspAbbrev(aspirations, c.aspiration_id) ?? "—"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-2">
            {ranked.map(({ c, votes }) => {
              const mine = content.votes.some((v) => v.participant_id === participant.id && v.candidate_id === c.id);
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="break-words text-foreground">
                      {isWinner(votes) ? "🏆 " : ""}
                      {c.text}
                    </p>
                    <p className="text-xs text-muted">
                      {c.author}
                      {activeAspId === "all" && (
                        <span className="ml-1 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold">
                          {aspAbbrev(aspirations, c.aspiration_id) ?? "—"}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold text-brand">
                      {votes} {votes === 1 ? "voto" : "votos"}
                    </span>
                    {canVote && (
                      <button
                        type="button"
                        disabled={!mine && myPicks >= topN}
                        onClick={() => toggleVote(candidates, c.id)}
                        className={`rounded-md border px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-40 ${
                          mine ? "border-brand bg-brand/10 text-brand-dark" : "border-border text-muted hover:bg-black/5"
                        }`}
                      >
                        {mine ? "✓ Elegida" : "Elegir"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PresenterHint text="Modo presentador: puedes visualizar el resultado — la votación la hacen los participantes." />
          <button
            className={btnGhost}
            title="Ampliar el escalafón en una pestaña nueva"
            onClick={() => window.open(`/notas/${activity.id}`, "_blank", "noopener,noreferrer")}
          >
            ⛶ Ampliar
          </button>
        </div>
      )}
      {aspirations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveAspId("all")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeAspId === "all" ? "border-transparent bg-foreground text-card" : "border-border text-muted hover:bg-black/5"
            }`}
          >
            📊 Todas
          </button>
          {aspirations.map((a) => {
            const cls = aspClasses(a.number);
            const active = activeAspId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setActiveAspId(a.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active ? `border-transparent ${cls.bg} text-dark` : `${cls.border} ${cls.text} bg-card hover:bg-black/5`
                }`}
              >
                Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
              </button>
            );
          })}
        </div>
      )}
      {!canVote && !presenter && (
        <p className="text-xs text-muted">Cambia a la pestaña "Todas" para poder votar.</p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Section categoryKey="oportunidad" />
        <Section categoryKey="amenaza" />
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
