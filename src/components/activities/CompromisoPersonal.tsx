"use client";

import { useState } from "react";
import { useSubmission } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import { ActivityComponentProps, textareaCls, btnPrimary, btnGhost, btnDanger, SaveIndicator, PresenterHint } from "./shared";

interface Commitment {
  author: string;
  text: string;
  signed_at: string;
}
interface Content extends Record<string, unknown> {
  commitments: Commitment[];
}

export default function CompromisoPersonal({ activity, session, participant }: ActivityComponentProps) {
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

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  const mine = content.commitments.find((c) => c.author === participant.name);
  const others = content.commitments.filter((c) => c.author !== participant.name);
  const signedCount = content.commitments.length;

  function sign() {
    const text = draft.trim();
    if (!text) return;
    const commitment: Commitment = { author: participant.name, text, signed_at: new Date().toISOString() };
    save(
      { ...content, commitments: [...content.commitments.filter((c) => c.author !== participant.name), commitment] },
      { eventType: "compromiso", summary: `${participant.name} firmó su compromiso en "${activity.title}"` }
    );
    setDraft("");
  }

  function editMine() {
    if (!mine) return;
    setDraft(mine.text);
    save({ ...content, commitments: content.commitments.filter((c) => c.author !== participant.name) });
  }

  function removeCommitment(author: string) {
    save({ ...content, commitments: content.commitments.filter((c) => c.author !== author) });
  }

  return (
    <div className="space-y-4">
      {presenter && (
        <div className="flex items-center justify-between gap-2">
          <PresenterHint />
          <span className="text-xs font-medium text-muted">
            <strong className="text-foreground">{signedCount}</strong> {signedCount === 1 ? "compromiso firmado" : "compromisos firmados"}
          </span>
        </div>
      )}

      {!presenter && (
        <div className="rounded-xl border border-border bg-gradient-to-b from-brand/5 to-transparent p-4">
          {mine ? (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-brand/40 bg-card p-3">
              <div>
                <p className="text-xs font-semibold text-brand-dark">✍️ Tu compromiso, {participant.name}</p>
                <p className="mt-1 text-sm text-foreground">&ldquo;{mine.text}&rdquo;</p>
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
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button className={btnPrimary + " mt-2"} onClick={sign} disabled={!draft.trim()}>
                ✍️ Firmar como {participant.name}
              </button>
            </>
          )}
        </div>
      )}

      {(mine || others.length > 0) && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Compromisos firmados ({signedCount})
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[...(mine ? [mine] : []), ...others].map((c) => (
              <div key={c.author} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">✍️ {c.author}</p>
                  {presenter && (
                    <button className={btnDanger} onClick={() => removeCommitment(c.author)}>
                      eliminar
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">&ldquo;{c.text}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
