"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { ActivityComponentProps, textareaCls, btnPrimary, btnDanger, SaveIndicator, uid } from "./shared";

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

export default function MatrizCuadrantes({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const quadrants = (activity.config.quadrants as { key: string; label: string }[]) ?? [];
  const allowStar = Boolean(activity.config.allowStar);
  const starLabel = (activity.config.starLabel as string) ?? "Destacar";
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { cards: [] }
  );
  const [draft, setDraft] = useState<Record<string, string>>({});

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  function addCard(quadrantKey: string) {
    const text = (draft[quadrantKey] ?? "").trim();
    if (!text) return;
    const card: Card = {
      id: uid(),
      quadrant: quadrantKey,
      text,
      aspiration_id: participant.aspiration_id,
      author: participant.name,
    };
    save(
      { cards: [...content.cards, card] },
      { eventType: "tarjeta", summary: `${participant.name} agregó una tarjeta en "${activity.title}"` }
    );
    setDraft((d) => ({ ...d, [quadrantKey]: "" }));
  }
  function toggleStar(id: string) {
    save({ cards: content.cards.map((c) => (c.id === id ? { ...c, star: !c.star } : c)) });
  }
  function removeCard(id: string) {
    save({ cards: content.cards.filter((c) => c.id !== id) });
  }

  const cols = quadrants.length <= 3 ? quadrants.length : 2;

  return (
    <div className="space-y-4">
      <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {quadrants.map((q) => {
          const cardsIn = content.cards.filter((c) => c.quadrant === q.key);
          return (
            <div key={q.key} className="rounded-lg border border-border bg-card p-3">
              <h4 className="mb-2 text-sm font-semibold text-foreground">{q.label}</h4>
              <div className="mb-2 space-y-2 max-h-56 overflow-y-auto">
                {cardsIn.map((c) => {
                  const asp = findAspiration(aspirations, c.aspiration_id);
                  const cls = aspClasses(asp?.number);
                  return (
                    <div key={c.id} className={`rounded-md border-l-4 ${cls.border} bg-black/[0.02] p-2 text-sm`}>
                      <p className="text-foreground">
                        {c.star && "⭐ "}
                        {c.text}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted">
                        <span>{c.author}</span>
                        <span className="flex gap-2">
                          {allowStar && (
                            <button className="hover:underline" onClick={() => toggleStar(c.id)}>
                              {starLabel}
                            </button>
                          )}
                          {c.author === participant.name && (
                            <button className={btnDanger} onClick={() => removeCard(c.id)}>
                              eliminar
                            </button>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <textarea
                className={textareaCls}
                placeholder="Agregar tarjeta…"
                value={draft[q.key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [q.key]: e.target.value }))}
              />
              <button className={btnPrimary + " mt-2"} onClick={() => addCard(q.key)}>
                Agregar
              </button>
            </div>
          );
        })}
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} />
    </div>
  );
}
