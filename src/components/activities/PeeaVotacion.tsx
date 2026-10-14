"use client";

import { useState } from "react";
import { useSubmission, fetchLatestContent } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import QuadrantPoint from "@/components/charts/QuadrantPoint";
import { ActivityComponentProps, inputCls, SaveIndicator, PresenterHint } from "./shared";

interface AxisDef {
  key: string;
  axis: "FF" | "VC" | "EE" | "FI";
  label: string;
}
interface Vote {
  // id determinístico `${axis}:${participant_id}` — cada persona tiene como mucho UN voto por
  // eje; votar de nuevo actualiza el mismo registro en vez de crear uno nuevo.
  id: string;
  axis: AxisDef["axis"];
  participant_id: string;
  participant_name: string;
  score: number;
  note?: string;
}
interface Content extends Record<string, unknown> {
  votes: Vote[];
}

const AXIS_LABEL: Record<AxisDef["axis"], string> = {
  FF: "Fortaleza financiera",
  VC: "Ventaja competitiva",
  EE: "Estabilidad del entorno",
  FI: "Fortaleza de la industria",
};

export function computePosture(byAxis: (axis: AxisDef["axis"]) => number) {
  const x = byAxis("VC") * -1 + byAxis("FI"); // ventaja competitiva es negativa por convención PEEA, industria positiva
  const y = byAxis("FF") - byAxis("EE");
  let posture: string;
  if (x >= 0 && y >= 0) posture = "Agresiva";
  else if (x < 0 && y >= 0) posture = "Conservadora";
  else if (x < 0 && y < 0) posture = "Defensiva";
  else posture = "Competitiva";
  return { x, y, posture };
}

// PEEA como votación individual consolidada: en vez de dividir el salón en subgrupos, CADA
// persona vota su propio puntaje por eje (0-scaleMax) y escribe su sustento — sin pelearse por
// un control compartido. La postura estratégica final se calcula con el PROMEDIO de los votos de
// cada eje, y cualquiera puede ver cuántas personas ya votaron y qué sustentos dejaron los demás.
// Cada persona puede votar como máximo en MAX_VOTES ejes; bajar un voto a 0 (sin sustento) lo
// retira y libera el cupo para votar en otro eje.
const MAX_VOTES = 3;

export default function PeeaVotacion({ activity, session, participant }: ActivityComponentProps) {
  const axes = (activity.config.items as AxisDef[]) ?? [];
  const scaleMax = (activity.config.scaleMax as number) ?? 6;
  const presenter = isPresenter(participant);
  const emptyContent: Content = { votes: [] };
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    null,
    participant,
    emptyContent
  );
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  // Muchas personas votan casi al mismo tiempo sobre la MISMA submission compartida — releer la
  // fila más reciente antes de guardar evita que el voto de una persona borre el de otra que
  // acaba de votar en el mismo instante.
  async function mutateContent(fn: (latest: Content) => Content, opts?: { eventType?: string; summary?: string }) {
    const latest = await fetchLatestContent<Content>(activity.id, null, emptyContent);
    const next = fn(latest);
    if (next !== latest) await save(next, opts);
  }

  function myVote(axis: AxisDef["axis"]) {
    return content.votes.find((v) => v.participant_id === participant.id && v.axis === axis);
  }
  function myVoteCount(votes: Vote[]) {
    return votes.filter((v) => v.participant_id === participant.id).length;
  }
  // Se valida contra la fila más reciente (no solo contra el estado local) para que la misma
  // persona no supere el máximo votando desde dos pestañas a la vez.
  function overLimit(latest: Content, id: string) {
    return !latest.votes.some((v) => v.id === id) && myVoteCount(latest.votes) >= MAX_VOTES;
  }
  function setScore(axis: AxisDef["axis"], score: number) {
    const id = `${axis}:${participant.id}`;
    mutateContent(
      (latest) => {
        if (overLimit(latest, id)) return latest;
        const existing = latest.votes.find((v) => v.id === id);
        const others = latest.votes.filter((v) => v.id !== id);
        if (score === 0 && !existing?.note?.trim()) return { votes: others };
        const vote: Vote = { id, axis, participant_id: participant.id, participant_name: participant.name, score, note: existing?.note };
        return { votes: [...others, vote] };
      },
      { eventType: "voto_peea", summary: `${participant.name} votó en "${activity.title}"` }
    );
  }
  function commitNote(axis: AxisDef["axis"]) {
    const id = `${axis}:${participant.id}`;
    const value = noteDrafts[id];
    if (value === undefined) return;
    setNoteDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    mutateContent((latest) => {
      if (overLimit(latest, id)) return latest;
      const existing = latest.votes.find((v) => v.id === id);
      if (!existing && !value.trim()) return latest;
      const vote: Vote = { id, axis, participant_id: participant.id, participant_name: participant.name, score: existing?.score ?? 0, note: value };
      return { votes: [...latest.votes.filter((v) => v.id !== id), vote] };
    });
  }

  function axisVotes(axis: AxisDef["axis"]) {
    return content.votes.filter((v) => v.axis === axis);
  }
  function axisAverage(axis: AxisDef["axis"]) {
    const votes = axisVotes(axis);
    return votes.length > 0 ? votes.reduce((a, v) => a + v.score, 0) / votes.length : 0;
  }

  const { x, y, posture } = computePosture(axisAverage);
  const totalVoters = new Set(content.votes.map((v) => v.participant_id)).size;
  const myVotes = myVoteCount(content.votes);
  const limitReached = myVotes >= MAX_VOTES;

  return (
    <div className="space-y-3">
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PresenterHint />
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5"
            title="Ver la postura consolidada en una pestaña nueva"
            onClick={() => window.open(`/rueda/${activity.id}`, "_blank", "noopener,noreferrer")}
          >
            ⛶ Ver tablero
          </button>
        </div>
      )}
      <p className="text-xs text-muted">
        {totalVoters} {totalVoters === 1 ? "persona ha votado" : "personas han votado"} — cada quien pone su propio puntaje y
        sustento por eje; el resultado final es el promedio de todos.
      </p>
      {!presenter && (
        <p className={`text-xs font-medium ${limitReached ? "text-brand-dark" : "text-muted"}`}>
          Llevas {myVotes} de {MAX_VOTES} votos.
          {limitReached && " Para votar en otro eje, baja a 0 uno de tus votos."}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {axes.map((a) => {
          const votes = axisVotes(a.axis);
          const average = axisAverage(a.axis);
          const mine = myVote(a.axis);
          const noteId = `${a.axis}:${participant.id}`;
          const blocked = !mine && limitReached;
          return (
            <div key={a.key} className="rounded-lg border border-border bg-card p-3">
              <p className="text-sm font-semibold text-foreground">{a.label}</p>
              <p className="text-xs text-muted">({AXIS_LABEL[a.axis]})</p>
              <p className="mt-1 text-xs text-muted">
                {votes.length} {votes.length === 1 ? "voto" : "votos"} · promedio{" "}
                <span className="font-semibold text-brand-dark">{average.toFixed(1)}</span>/{scaleMax}
              </p>

              {!presenter && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border text-base font-semibold hover:bg-black/5 disabled:opacity-30"
                    disabled={(mine?.score ?? 0) <= 0}
                    onClick={() => setScore(a.axis, Math.max(0, (mine?.score ?? 0) - 1))}
                    aria-label="Bajar mi puntaje"
                  >
                    −
                  </button>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/10">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-300 ease-out"
                      style={{ width: `${((mine?.score ?? 0) / scaleMax) * 100}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border text-base font-semibold hover:bg-black/5 disabled:opacity-30"
                    disabled={blocked || (mine?.score ?? 0) >= scaleMax}
                    onClick={() => setScore(a.axis, Math.min(scaleMax, (mine?.score ?? 0) + 1))}
                    aria-label="Subir mi puntaje"
                  >
                    +
                  </button>
                  <span className="w-14 shrink-0 text-center text-sm font-semibold text-foreground">
                    Yo: {mine?.score ?? 0}/{scaleMax}
                  </span>
                </div>
              )}
              {!presenter && (
                <input
                  className={inputCls + " mt-2"}
                  placeholder={blocked ? `Ya usaste tus ${MAX_VOTES} votos` : "Mi sustento…"}
                  disabled={blocked}
                  value={noteDrafts[noteId] ?? mine?.note ?? ""}
                  onChange={(e) => setNoteDrafts((d) => ({ ...d, [noteId]: e.target.value }))}
                  onBlur={() => commitNote(a.axis)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
              )}

              {votes.filter((v) => v.note?.trim()).length > 0 && (
                <div className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-border pt-2">
                  {votes
                    .filter((v) => v.note?.trim())
                    .map((v) => (
                      <p key={v.id} className="text-xs text-muted">
                        <span className="font-semibold text-foreground">{v.participant_name}</span> ({v.score}/{scaleMax}): {v.note}
                      </p>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-md bg-black/[0.03] p-3 text-sm">
        <QuadrantPoint x={x} y={y} range={scaleMax} />
        <p>
          <span className="font-medium">Postura estratégica (PEEA): </span>
          {posture}
        </p>
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} sticky />
    </div>
  );
}
