"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { ActivityComponentProps, inputCls, btnPrimary, btnDanger, SaveIndicator, uid } from "./shared";

interface Candidate {
  id: string;
  text: string;
  author: string;
  owner?: string;
  target_date?: string;
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

export default function VotacionFichas({ activity, session, participant }: ActivityComponentProps) {
  const pointsPerPerson = (activity.config.pointsPerPerson as number) ?? 3;
  const allowSubmitCandidates = Boolean(activity.config.allowSubmitCandidates);
  const candidateLabel = (activity.config.candidateLabel as string) ?? "Candidata";
  const requireOwnerAndDate = Boolean(activity.config.requireOwnerAndDate);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { candidates: [], votes: [] }
  );
  const [newText, setNewText] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newDate, setNewDate] = useState("");

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  const myVotes = content.votes.filter((v) => v.participant_id === participant.id);
  const myUsed = myVotes.reduce((a, v) => a + v.points, 0);
  const myRemaining = pointsPerPerson - myUsed;

  function addCandidate() {
    if (!newText.trim()) return;
    const c: Candidate = { id: uid(), text: newText.trim(), author: participant.name, owner: newOwner || undefined, target_date: newDate || undefined };
    save(
      { ...content, candidates: [...content.candidates, c] },
      { eventType: "candidata", summary: `${participant.name} propuso "${newText.trim()}" en "${activity.title}"` }
    );
    setNewText("");
    setNewOwner("");
    setNewDate("");
  }
  function removeCandidate(id: string) {
    save({ candidates: content.candidates.filter((c) => c.id !== id), votes: content.votes.filter((v) => v.candidate_id !== id) });
  }
  function vote(candidateId: string, points: number) {
    if (points < 0) return;
    const others = content.votes.filter((v) => !(v.participant_id === participant.id && v.candidate_id === candidateId));
    const usedByOthers = others.filter((v) => v.participant_id === participant.id).reduce((a, v) => a + v.points, 0);
    if (usedByOthers + points > pointsPerPerson) return;
    const votes = points === 0 ? others : [...others, { participant_id: participant.id, participant_name: participant.name, candidate_id: candidateId, points }];
    save({ ...content, votes }, { eventType: "voto", summary: `${participant.name} votó en "${activity.title}"` });
  }

  const totals = content.candidates
    .map((c) => ({ c, total: content.votes.filter((v) => v.candidate_id === c.id).reduce((a, v) => a + v.points, 0) }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      {allowSubmitCandidates && (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-sm font-semibold">Proponer {candidateLabel.toLowerCase()}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className={inputCls} placeholder={candidateLabel} value={newText} onChange={(e) => setNewText(e.target.value)} />
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
        </div>
      )}

      <p className="text-sm text-muted">
        Tus fichas disponibles: <span className="font-semibold text-foreground">{myRemaining}</span> de {pointsPerPerson}
      </p>

      <div className="space-y-2">
        {totals.map(({ c, total }, idx) => {
          const mine = myVotes.find((v) => v.candidate_id === c.id)?.points ?? 0;
          return (
            <div key={c.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {idx === 0 && total > 0 && "🏆 "}
                  {c.text}
                </p>
                <p className="text-xs text-muted">
                  {c.author}
                  {c.owner ? ` · doliente: ${c.owner}` : ""}
                  {c.target_date ? ` · fecha objetivo: ${c.target_date}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-brand">{total} pts</span>
                <button className={inputCls + " w-8 text-center"} onClick={() => vote(c.id, Math.max(0, mine - 1))}>
                  -
                </button>
                <span className="w-4 text-center text-sm">{mine}</span>
                <button className={inputCls + " w-8 text-center"} onClick={() => vote(c.id, mine + 1)} disabled={myRemaining <= 0}>
                  +
                </button>
                {c.author === participant.name && (
                  <button className={btnDanger} onClick={() => removeCandidate(c.id)}>
                    eliminar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} />
    </div>
  );
}
