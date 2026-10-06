"use client";

import { useEffect, useState } from "react";
import { useSubmission, fetchLatestContent } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import { supabase } from "@/lib/supabase";
import { aspClasses, findAspiration, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import BarChart from "@/components/charts/BarChart";
import { ActivityComponentProps, inputCls, btnPrimary, SaveIndicator, PresenterHint, DeleteButton, Stepper, uid } from "./shared";

interface Candidate {
  id: string;
  text: string;
  author: string;
  author_id?: string;
  owner?: string;
  target_date?: string;
  aspiration_id?: number | null;
  impact?: "alto" | "medio" | "bajo";
}
interface EfiRow {
  id: string;
  factor: string;
  category?: "fortaleza" | "debilidad";
  sourceAuthor?: string;
  aspiration_id: number | null;
}
const IMPACT_LABEL: Record<string, string> = { alto: "Alto", medio: "Medio", bajo: "Bajo" };
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

export default function VotacionFichas({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const pointsPerPerson = (activity.config.pointsPerPerson as number) ?? 3;
  // Modo "elegir hasta N": en vez de repartir pointsPerPerson puntos (pudiendo concentrarlos en
  // una sola candidata), cada persona apoya como máximo maxVotes candidatas distintas, 1 voto
  // cada una. Con perAspiration, esto obliga a votar desde una pestaña "Todos" que junta las
  // candidatas de las 3 aspiraciones — si no, 3 votos "en total" no tendría sentido repartidos
  // en presupuestos separados por pestaña. Las demás actividades de votación (sin maxVotes)
  // no cambian: siguen con el reparto de puntos de siempre.
  const maxVotes = activity.config.maxVotes as number | undefined;
  const allowSubmitCandidates = Boolean(activity.config.allowSubmitCandidates);
  const candidateLabel = (activity.config.candidateLabel as string) ?? "Candidata";
  const requireOwnerAndDate = Boolean(activity.config.requireOwnerAndDate);
  const cloudView = Boolean(activity.config.cloudView);
  const maxTextLength = (activity.config.maxTextLength as number) ?? (cloudView ? 40 : 140);
  const importCandidatesFrom = activity.config.importCandidatesFrom as number | undefined;
  const importCategory = (activity.config.importCategory as string) ?? "debilidad";
  const presenter = isPresenter(participant);
  const perAspiration = Boolean(activity.config.perAspiration);
  // Con maxVotes + perAspiration, votar pasa a hacerse solo desde una pestaña "Todos" que junta
  // las candidatas de las 3 aspiraciones (ver comentario de `maxVotes` arriba); las pestañas por
  // aspiración quedan para proponer y para mirar, no para votar.
  const groupedVoting = perAspiration && Boolean(maxVotes);
  // A diferencia de MatrizPonderada/TarjetaEstructurada, aquí NO se separa en una submission por
  // aspiración: candidatas y votos siguen en una sola lista compartida (igual que ya la lee el
  // tablero proyectado en /votacion/[activityId], que filtra por `c.aspiration_id` en el
  // cliente) — solo se filtra qué candidatas se ven y se votan según la pestaña activa, así
  // "una nueva meta por aspiración" corre como 3 subastas independientes sobre los mismos datos
  // (o, con groupedVoting, como una sola subasta conjunta).
  const [activeAspId, setActiveAspId] = useState<number | "all" | null>(() => (groupedVoting ? "all" : aspirations[0]?.id ?? null));
  useEffect(() => {
    if (activeAspId === null && aspirations.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveAspId(groupedVoting ? "all" : aspirations[0].id);
    }
  }, [aspirations, activeAspId, groupedVoting]);
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    null,
    participant,
    { candidates: [], votes: [] }
  );
  const [newText, setNewText] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newDate, setNewDate] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const emptyContent: Content = { candidates: [], votes: [] };

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  // Muchas personas proponen candidatas y votan casi al mismo tiempo sobre esta MISMA
  // submission compartida (aspiration_id null) — si cada guardado parte del `content` que ya
  // trae el hook (que solo se refresca con el eco de tiempo real), dos escrituras que se cruzan
  // en milisegundos se pisan entre sí y una de las dos candidatas/votos desaparece en silencio.
  // Por eso cada mutación relee la fila más reciente justo antes de aplicar su cambio — mismo
  // patrón que ya usan NotasColectivas.tsx, ConsolidacionImpacto.tsx y SintesisEntorno.tsx para
  // submissions compartidas.
  async function mutateContent(fn: (latest: Content) => Content, opts?: { eventType?: string; summary?: string }) {
    const latest = await fetchLatestContent<Content>(activity.id, null, emptyContent);
    await save(fn(latest), opts);
  }

  async function importFromSource() {
    if (!importCandidatesFrom) return;
    setImporting(true);
    setImportMsg(null);
    // La EFI guarda una submission por aspiración (no una sola combinada), así que hay
    // que traerlas todas y aplanar sus filas para reunir las debilidades de las tres.
    const { data, error } = await supabase.from("submissions").select("content").eq("activity_id", importCandidatesFrom);
    if (error) {
      setImporting(false);
      setImportMsg("No se pudo consultar la actividad de origen.");
      return;
    }
    const rows = (data ?? []).flatMap((row) => ((row.content as { rows?: EfiRow[] } | null)?.rows ?? []));
    // Con `perAspiration`, cada pestaña importa solo las debilidades de SU aspiración — si no,
    // el equipo de una aspiración vería (y podría votar) candidatas que le corresponden a otra.
    const notes = rows.filter((r) => r.category === importCategory && (!perAspiration || activeAspId === "all" || r.aspiration_id === activeAspId));
    const latest = await fetchLatestContent<Content>(activity.id, null, emptyContent);
    const existing = new Set(latest.candidates.map((c) => c.text.trim().toLowerCase()));
    const newCandidates: Candidate[] = notes
      .filter((n) => n.factor.trim() && !existing.has(n.factor.trim().toLowerCase()))
      .map((n) => ({ id: uid(), text: n.factor.trim(), author: n.sourceAuthor ?? "Equipo", aspiration_id: n.aspiration_id }));
    setImporting(false);
    if (newCandidates.length === 0) {
      setImportMsg("No hay candidatas nuevas por importar.");
      return;
    }
    await save({ ...latest, candidates: [...latest.candidates, ...newCandidates] });
    setImportMsg(`Se importaron ${newCandidates.length} ${newCandidates.length === 1 ? "candidata" : "candidatas"}.`);
  }

  // Solo las candidatas de la pestaña activa cuentan para el escalafón y el presupuesto de
  // puntos de esta vista — cada aspiración es su propia subasta, con sus propios 3 puntos por
  // persona, aunque vivan en la misma lista compartida.
  const visibleCandidates =
    perAspiration && activeAspId !== "all" ? content.candidates.filter((c) => c.aspiration_id === activeAspId) : content.candidates;
  const visibleIds = new Set(visibleCandidates.map((c) => c.id));
  const myVotes = content.votes.filter((v) => v.participant_id === participant.id && visibleIds.has(v.candidate_id));
  const myUsed = myVotes.reduce((a, v) => a + v.points, 0);
  const myRemaining = pointsPerPerson - myUsed;
  // Modo maxVotes: cuenta cuántas candidatas DISTINTAS ya apoyó (no cuántos puntos sumó) — cada
  // voto vale 1, no se puede concentrar. Con groupedVoting, myVotes ya viene de visibleIds =
  // TODAS las candidatas (porque activeAspId es "all" cuando se vota), así el límite es global.
  const myVotesCount = myVotes.length;
  const myVotesRemaining = (maxVotes ?? 0) - myVotesCount;

  function addCandidate() {
    if (!newText.trim()) return;
    // En la pestaña "Todos" no hay una aspiración a la cual asignar la candidata nueva — el
    // formulario de proponer se oculta ahí (ver más abajo), esto es solo un resguardo.
    if (perAspiration && activeAspId === "all") return;
    const text = newText.trim();
    const c: Candidate = {
      id: uid(),
      text,
      author: participant.name,
      author_id: participant.id,
      owner: newOwner || undefined,
      target_date: newDate || undefined,
      aspiration_id: perAspiration && activeAspId !== "all" ? activeAspId : undefined,
    };
    mutateContent((latest) => ({ ...latest, candidates: [...latest.candidates, c] }), {
      eventType: "candidata",
      summary: `${participant.name} propuso "${text}" en "${activity.title}"`,
    });
    setNewText("");
    setNewOwner("");
    setNewDate("");
  }
  function removeCandidate(id: string) {
    mutateContent((latest) => ({
      candidates: latest.candidates.filter((c) => c.id !== id),
      votes: latest.votes.filter((v) => v.candidate_id !== id),
    }));
  }
  // Reparte puntos entre ideas (no un simple sí/no): un participante puede concentrar
  // varios de sus puntos en una misma idea si eso refleja mejor su prioridad. El presupuesto
  // (cuántos puntos lleva usados) se recalcula sobre `latest`, no sobre el `content` del
  // render, para que la validación use el dato más reciente de la base de datos.
  function setPoints(candidateId: string, requested: number) {
    mutateContent((latest) => {
      const visibleIdsLatest = new Set(
        (perAspiration && activeAspId !== "all" ? latest.candidates.filter((c) => c.aspiration_id === activeAspId) : latest.candidates).map(
          (c) => c.id
        )
      );
      const myVotesLatest = latest.votes.filter((v) => v.participant_id === participant.id && visibleIdsLatest.has(v.candidate_id));
      const myUsedLatest = myVotesLatest.reduce((a, v) => a + v.points, 0);
      const myRemainingLatest = pointsPerPerson - myUsedLatest;
      const current = myVotesLatest.find((v) => v.candidate_id === candidateId)?.points ?? 0;
      const maxAllowed = current + myRemainingLatest;
      const next = Math.max(0, Math.min(requested, maxAllowed));
      if (next === current) return latest;
      const others = latest.votes.filter((v) => !(v.participant_id === participant.id && v.candidate_id === candidateId));
      const votes =
        next > 0 ? [...others, { participant_id: participant.id, participant_name: participant.name, candidate_id: candidateId, points: next }] : others;
      return { ...latest, votes };
    }, { eventType: "voto", summary: `${participant.name} votó en "${activity.title}"` });
  }
  // Modo maxVotes: 1 voto por candidata (no puntos a repartir) — tocar apoya/quita el apoyo,
  // hasta un máximo de maxVotes candidatas distintas en total (recalculado sobre `latest`).
  function toggleVote(candidateId: string) {
    mutateContent((latest) => {
      const myVotesLatest = latest.votes.filter((v) => v.participant_id === participant.id);
      const already = myVotesLatest.some((v) => v.candidate_id === candidateId);
      const others = latest.votes.filter((v) => !(v.participant_id === participant.id && v.candidate_id === candidateId));
      if (!already && myVotesLatest.length >= (maxVotes ?? 0)) return latest;
      const votes = already
        ? others
        : [...others, { participant_id: participant.id, participant_name: participant.name, candidate_id: candidateId, points: 1 }];
      return { ...latest, votes };
    }, { eventType: "voto", summary: `${participant.name} votó en "${activity.title}"` });
  }

  const RANK_MEDAL = ["🥇", "🥈", "🥉"];
  const totals = visibleCandidates
    .map((c) => {
      const myVotesForC = content.votes.filter((v) => v.candidate_id === c.id);
      return { c, total: myVotesForC.reduce((a, v) => a + v.points, 0), voters: new Set(myVotesForC.map((v) => v.participant_id)).size };
    })
    // Desempate real cuando dos candidatas quedan con los mismos puntos: gana la que sumó esos
    // puntos entre más personas distintas (apoyo más amplio, no concentrado en una sola persona).
    // Si aun así persiste el empate, se resuelve por orden de llegada (sort de JS es estable) —
    // así el escalafón de 3 puestos queda siempre resuelto, nunca en tablas.
    .sort((a, b) => b.total - a.total || b.voters - a.voters);
  const hasVotes = totals.some((t) => t.total > 0);

  return (
    <div className="space-y-4">
      {perAspiration && aspirations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {groupedVoting && (
            <button
              type="button"
              onClick={() => setActiveAspId("all")}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                activeAspId === "all" ? "border-transparent bg-brand-dark text-white" : "border-brand-dark text-brand-dark bg-card hover:bg-black/5"
              }`}
            >
              🗳️ Todos · aquí se vota
            </button>
          )}
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
      {groupedVoting && (
        <p className="text-xs text-muted">
          {activeAspId === "all"
            ? "Estás en \"Todos\": aquí puedes apoyar tus metas favoritas, de cualquier aspiración."
            : "Esta pestaña es solo para proponer y mirar — para votar, ve a la pestaña \"Todos\"."}
        </p>
      )}
      {(presenter || importCandidatesFrom) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {presenter && <PresenterHint />}
          <div className="flex flex-wrap items-center gap-2">
            {importCandidatesFrom && (
              <button className={btnPrimary} disabled={importing} onClick={importFromSource}>
                {importing ? "Importando…" : "⬇ Importar de la EFI"}
              </button>
            )}
            {presenter && cloudView && (
              <button
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 transition-colors"
                title="Ampliar como nube de ideas en una pestaña nueva"
                onClick={() => window.open(`/ideas/${activity.id}`, "_blank", "noopener,noreferrer")}
              >
                ⛶ Ampliar
              </button>
            )}
            {presenter && (
              <button
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 transition-colors"
                title="Ver el tablero de priorización en una pestaña nueva"
                onClick={() => window.open(`/votacion/${activity.id}`, "_blank", "noopener,noreferrer")}
              >
                ⛶ Ver tablero
              </button>
            )}
          </div>
        </div>
      )}
      {importMsg && <p className="text-xs text-muted">{importMsg}</p>}
      {hasVotes && (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Resultados en vivo</p>
          <BarChart bars={totals.map((t) => ({ label: t.c.text, value: t.total, colorClass: "bg-brand" }))} unit=" pts" />
        </div>
      )}
      {allowSubmitCandidates && !presenter && !(groupedVoting && activeAspId === "all") && (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-sm font-semibold">Proponer {candidateLabel.toLowerCase()}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={inputCls}
              placeholder={candidateLabel}
              maxLength={maxTextLength}
              value={newText}
              onChange={(e) => setNewText(e.target.value.slice(0, maxTextLength))}
            />
            {requireOwnerAndDate && (
              <>
                <input className={inputCls} placeholder="Doliente" value={newOwner} onChange={(e) => setNewOwner(e.target.value)} />
                <input type="date" className={inputCls} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </>
            )}
            <button className={btnPrimary} onClick={addCandidate}>
              Agregar
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">
            {newText.length}/{maxTextLength} caracteres{cloudView ? " · ideas cortas se leen mejor en la nube" : ""}
          </p>
        </div>
      )}

      {!presenter && maxVotes && (!perAspiration || activeAspId === "all") && (
        <p className="text-sm text-muted">
          Metas apoyadas: <span className="font-semibold text-foreground">{myVotesCount}</span> de {maxVotes} — 1 voto por meta, sin
          concentrar
        </p>
      )}
      {!presenter && !maxVotes && (
        <p className="text-sm text-muted">
          Puntos disponibles: <span className="font-semibold text-foreground">{myRemaining}</span> de {pointsPerPerson} · puedes
          concentrar varios en una misma idea
        </p>
      )}

      <div className="space-y-2">
        {totals.map(({ c, total, voters }, idx) => {
          const myPoints = myVotes.find((v) => v.candidate_id === c.id)?.points ?? 0;
          const canDeleteOwn = c.author_id ? c.author_id === participant.id : c.author === participant.name;
          const medal = idx < 3 && total > 0 ? RANK_MEDAL[idx] : null;
          return (
            <div
              key={c.id}
              className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
                medal ? "border-brand/40 bg-brand/5" : "border-border bg-card"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {medal ? `${medal} ` : ""}
                  {c.text}
                </p>
                <p className="text-xs text-muted">
                  {c.author}
                  {c.owner ? ` · doliente: ${c.owner}` : ""}
                  {c.target_date ? ` · fecha objetivo: ${c.target_date}` : ""}
                  {total > 0 ? ` · ${voters} ${voters === 1 ? "persona" : "personas"}` : ""}
                </p>
                {(c.aspiration_id !== undefined && c.aspiration_id !== null) || c.impact ? (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {c.aspiration_id !== undefined && c.aspiration_id !== null && (() => {
                      const asp = findAspiration(aspirations, c.aspiration_id);
                      const cls = aspClasses(asp?.number);
                      return asp ? (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls.bgSoft} ${cls.text}`}>
                          Aspiración {asp.number}
                        </span>
                      ) : null;
                    })()}
                    {c.impact && (
                      <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-muted">
                        Impacto {IMPACT_LABEL[c.impact]}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-brand">{total} pts</span>
                {!presenter && maxVotes ? (
                  // Solo se puede votar desde "Todos" cuando hay groupedVoting — en las pestañas
                  // por aspiración el botón de apoyo no aparece (ver mensaje arriba).
                  (!groupedVoting || activeAspId === "all") && (
                    <button
                      type="button"
                      onClick={() => toggleVote(c.id)}
                      disabled={myPoints === 0 && myVotesRemaining <= 0}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        myPoints > 0
                          ? "border-transparent bg-brand-dark text-white"
                          : "border-brand-dark text-brand-dark hover:bg-brand/10"
                      }`}
                    >
                      {myPoints > 0 ? "✓ Apoyada" : "Apoyar"}
                    </button>
                  )
                ) : (
                  !presenter && (
                    <Stepper
                      value={myPoints}
                      max={myPoints + myRemaining}
                      onChange={(next) => setPoints(c.id, next)}
                      ariaLabel={`puntos para "${c.text}"`}
                    />
                  )
                )}
                {canDeleteOwn && total === 0 && <DeleteButton onConfirm={() => removeCandidate(c.id)} />}
              </div>
            </div>
          );
        })}
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} sticky />
    </div>
  );
}
