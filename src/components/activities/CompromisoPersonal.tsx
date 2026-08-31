"use client";

import { useEffect, useState } from "react";
import { useSubmission } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { ActivityComponentProps, textareaCls, btnPrimary, btnGhost, SaveIndicator, PresenterHint, Avatar } from "./shared";

interface Commitment {
  author: string;
  text: string;
  signed_at: string;
  aspiration_id: number | null;
  role: string;
}
interface Content extends Record<string, unknown> {
  commitments: Commitment[];
}

const MAX_LENGTH = 220;

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "justo ahora";
  if (mins < 60) return `hace ${mins} min`;
  const time = new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  return time;
}

export default function CompromisoPersonal({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const presenter = isPresenter(participant);
  // Plenaria: un compromiso por persona, sin importar su aspiración.
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    null,
    participant,
    { commitments: [] }
  );
  const [draft, setDraft] = useState("");
  const [justSigned, setJustSigned] = useState(false);
  const [confirmDeleteFor, setConfirmDeleteFor] = useState<string | null>(null);

  useEffect(() => {
    if (!justSigned) return;
    const t = setTimeout(() => setJustSigned(false), 2500);
    return () => clearTimeout(t);
  }, [justSigned]);

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  const mine = content.commitments.find((c) => c.author === participant.name);
  const others = content.commitments.filter((c) => c.author !== participant.name);
  const ordered = [...(mine ? [mine] : []), ...others].sort((a, b) => a.signed_at.localeCompare(b.signed_at));
  const signedCount = content.commitments.length;

  function sign() {
    const text = draft.trim();
    if (!text) return;
    const commitment: Commitment = {
      author: participant.name,
      text,
      signed_at: new Date().toISOString(),
      aspiration_id: participant.aspiration_id,
      role: participant.role,
    };
    save(
      { ...content, commitments: [...content.commitments.filter((c) => c.author !== participant.name), commitment] },
      { eventType: "compromiso", summary: `${participant.name} firmó su compromiso en "${activity.title}"` }
    );
    setDraft("");
    setJustSigned(true);
  }

  function editMine() {
    if (!mine) return;
    setDraft(mine.text);
    save({ ...content, commitments: content.commitments.filter((c) => c.author !== participant.name) });
    setJustSigned(false);
  }

  function removeCommitment(author: string) {
    save({ ...content, commitments: content.commitments.filter((c) => c.author !== author) });
    setConfirmDeleteFor(null);
  }

  return (
    <div className="space-y-5">
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PresenterHint />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-dark">
            ✍️ {signedCount} {signedCount === 1 ? "compromiso firmado" : "compromisos firmados"}
          </span>
        </div>
      )}

      {!presenter && (
        <div className="rounded-xl border border-border bg-gradient-to-b from-brand/5 to-transparent p-4">
          {mine ? (
            <div className="flex items-start gap-3 rounded-lg border border-brand/40 bg-card p-3 shadow-sm">
              <Avatar name={participant.name} bgClass={aspClasses(findAspiration(aspirations, participant.aspiration_id)?.number).bg} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-brand-dark">
                  {justSigned ? "🎉 ¡Compromiso firmado!" : `Tu compromiso, ${participant.name}`}
                </p>
                <p className="mt-1 text-sm italic text-foreground">&ldquo;{mine.text}&rdquo;</p>
              </div>
              <button className={btnGhost + " shrink-0"} onClick={editMine}>
                ✏️ Editar
              </button>
            </div>
          ) : (
            <>
              <p className="mb-2 text-sm text-muted">
                Escribe el dato o insumo que <strong className="text-foreground">tú personalmente</strong> te comprometes a
                traer a la S1, y firma con tu nombre.
              </p>
              <textarea
                className={textareaCls}
                placeholder="Mi compromiso para la S1…"
                maxLength={MAX_LENGTH}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sign();
                }}
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-muted">
                  {draft.length}/{MAX_LENGTH}
                </span>
                <button className={btnPrimary} onClick={sign} disabled={!draft.trim()}>
                  ✍️ Firmar como {participant.name}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Compromisos firmados ({signedCount})</p>
        {ordered.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border py-8 text-center">
            <span className="text-2xl">✍️</span>
            <p className="text-sm text-muted">Aún nadie ha firmado su compromiso. ¡Sé el primero!</p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {ordered.map((c) => {
              const asp = findAspiration(aspirations, c.aspiration_id);
              const cls = aspClasses(asp?.number);
              const isMine = c.author === participant.name;
              return (
                <div
                  key={c.author}
                  className={`group flex items-start gap-3 rounded-lg border bg-card p-3 ${isMine ? "border-brand/40 shadow-sm" : "border-border"}`}
                >
                  <Avatar name={c.author} bgClass={cls.bg} isFacilitador={c.role === "facilitador"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{c.author}</p>
                      <span className="shrink-0 text-[10px] text-muted">{timeAgo(c.signed_at)}</span>
                    </div>
                    <p className="mt-0.5 text-sm italic text-muted">&ldquo;{c.text}&rdquo;</p>
                  </div>
                  {presenter &&
                    (confirmDeleteFor === c.author ? (
                      <div className="flex shrink-0 flex-col gap-1">
                        <button className="text-[10px] font-medium text-red-600 hover:underline" onClick={() => removeCommitment(c.author)}>
                          Confirmar
                        </button>
                        <button className="text-[10px] text-muted hover:underline" onClick={() => setConfirmDeleteFor(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        className="shrink-0 text-xs text-muted opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                        onClick={() => setConfirmDeleteFor(c.author)}
                      >
                        ✕
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
