"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import { supabase } from "@/lib/supabase";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import BarChart from "@/components/charts/BarChart";
import { ActivityComponentProps, inputCls, btnPrimary, btnGhost, btnDanger, SaveIndicator, PresenterHint, uid } from "./shared";

interface Candidate {
  id: string;
  text: string;
  author: string;
  owner?: string;
  target_date?: string;
  aspiration_id?: number | null;
  impact?: "alto" | "medio" | "bajo";
}
interface SourceNote {
  id: string;
  text: string;
  author: string;
  category: string;
  impact?: "alto" | "medio" | "bajo";
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
  const allowSubmitCandidates = Boolean(activity.config.allowSubmitCandidates);
  const candidateLabel = (activity.config.candidateLabel as string) ?? "Candidata";
  const requireOwnerAndDate = Boolean(activity.config.requireOwnerAndDate);
  const cloudView = Boolean(activity.config.cloudView);
  const maxTextLength = (activity.config.maxTextLength as number) ?? (cloudView ? 40 : 140);
  const importCandidatesFrom = activity.config.importCandidatesFrom as number | undefined;
  const importCategory = (activity.config.importCategory as string) ?? "debilidad";
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { candidates: [], votes: [] }
  );
  const [newText, setNewText] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newDate, setNewDate] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  async function importFromSource() {
    if (!importCandidatesFrom) return;
    setImporting(true);
    setImportMsg(null);
    const { data, error } = await supabase
      .from("submissions")
      .select("content")
      .eq("activity_id", importCandidatesFrom)
      .is("aspiration_id", null)
      .maybeSingle();
    setImporting(false);
    if (error) {
      setImportMsg("No se pudo consultar la actividad de origen.");
      return;
    }
    const notes = ((data?.content as { notes?: SourceNote[] } | null)?.notes ?? []).filter((n) => n.category === importCategory);
    const existing = new Set(content.candidates.map((c) => c.text.trim().toLowerCase()));
    const newCandidates: Candidate[] = notes
      .filter((n) => !existing.has(n.text.trim().toLowerCase()))
      .map((n) => ({ id: uid(), text: n.text.trim(), author: n.author, aspiration_id: n.aspiration_id, impact: n.impact }));
    if (newCandidates.length === 0) {
      setImportMsg("No hay candidatas nuevas por importar.");
      return;
    }
    save({ ...content, candidates: [...content.candidates, ...newCandidates] });
    setImportMsg(`Se importaron ${newCandidates.length} ${newCandidates.length === 1 ? "candidata" : "candidatas"}.`);
  }

  const myVotes = content.votes.filter((v) => v.participant_id === participant.id);
  const myUsed = myVotes.length;
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
  function toggleVote(candidateId: string) {
    const already = content.votes.some((v) => v.participant_id === participant.id && v.candidate_id === candidateId);
    if (!already && myRemaining <= 0) return;
    const votes = already
      ? content.votes.filter((v) => !(v.participant_id === participant.id && v.candidate_id === candidateId))
      : [...content.votes, { participant_id: participant.id, participant_name: participant.name, candidate_id: candidateId, points: 1 }];
    save({ ...content, votes }, { eventType: "voto", summary: `${participant.name} votó en "${activity.title}"` });
  }

  const totals = content.candidates
    .map((c) => ({ c, total: content.votes.filter((v) => v.candidate_id === c.id).reduce((a, v) => a + v.points, 0) }))
    .sort((a, b) => b.total - a.total);
  const hasVotes = totals.some((t) => t.total > 0);

  return (
    <div className="space-y-4">
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PresenterHint />
          <div className="flex flex-wrap items-center gap-2">
            {importCandidatesFrom && (
              <button className={btnGhost} disabled={importing} onClick={importFromSource}>
                {importing ? "Importando…" : "⬇ Importar del PCI"}
              </button>
            )}
            {cloudView && (
              <button
                className={btnGhost}
                title="Ampliar como nube de ideas en una pestaña nueva"
                onClick={() => window.open(`/ideas/${activity.id}`, "_blank", "noopener,noreferrer")}
              >
                ⛶ Ampliar
              </button>
            )}
          </div>
        </div>
      )}
      {presenter && importMsg && <p className="text-xs text-muted">{importMsg}</p>}
      {hasVotes && (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Resultados en vivo</p>
          <BarChart bars={totals.map((t) => ({ label: t.c.text, value: t.total, colorClass: "bg-brand" }))} unit=" pts" />
        </div>
      )}
      {allowSubmitCandidates && !presenter && (
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

      {!presenter && (
        <p className="text-sm text-muted">
          Votos disponibles: <span className="font-semibold text-foreground">{myRemaining}</span> de {pointsPerPerson} (1 voto por idea)
        </p>
      )}

      <div className="space-y-2">
        {totals.map(({ c, total }, idx) => {
          const mine = myVotes.some((v) => v.candidate_id === c.id);
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
                {!presenter && (
                  <button
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      mine ? "border-brand bg-brand/10 text-brand-dark" : "border-border"
                    } disabled:opacity-40`}
                    disabled={!mine && myRemaining <= 0}
                    onClick={() => toggleVote(c.id)}
                  >
                    {mine ? "✓ Votado" : "Votar"}
                  </button>
                )}
                {c.author === participant.name && total === 0 && (
                  <button className={btnDanger} onClick={() => removeCandidate(c.id)}>
                    eliminar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
