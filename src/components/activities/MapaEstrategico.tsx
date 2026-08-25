"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { ActivityComponentProps, inputCls, btnPrimary, btnDanger, SaveIndicator, PostIt, uid } from "./shared";

interface Card {
  id: string;
  perspective: string;
  aspiration_id: number | null;
  text: string;
  leads_to: string[];
}
interface Content extends Record<string, unknown> {
  cards: Card[];
}

export default function MapaEstrategico({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const perspectives = (activity.config.perspectives as { key: string; label: string }[]) ?? [];
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

  function addCard(perspectiveKey: string) {
    const text = (draft[perspectiveKey] ?? "").trim();
    if (!text) return;
    const card: Card = { id: uid(), perspective: perspectiveKey, aspiration_id: participant.aspiration_id, text, leads_to: [] };
    save({ cards: [...content.cards, card] }, { eventType: "objetivo", summary: `${participant.name} agregó un objetivo en el mapa estratégico` });
    setDraft((d) => ({ ...d, [perspectiveKey]: "" }));
  }
  function removeCard(id: string) {
    save({ cards: content.cards.filter((c) => c.id !== id).map((c) => ({ ...c, leads_to: c.leads_to.filter((l) => l !== id) })) });
  }
  function toggleLeadsTo(fromId: string, toId: string) {
    save({
      cards: content.cards.map((c) =>
        c.id === fromId ? { ...c, leads_to: c.leads_to.includes(toId) ? c.leads_to.filter((l) => l !== toId) : [...c.leads_to, toId] } : c
      ),
    });
  }

  // orden de abajo hacia arriba: última perspectiva de la lista es la base
  const orderedPerspectives = [...perspectives].reverse();

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">Perspectivas de abajo hacia arriba, tal como en el paredón estratégico.</p>
      <div className="space-y-3">
        {orderedPerspectives.map((p) => {
          const cardsIn = content.cards.filter((c) => c.perspective === p.key);
          const cardsAbove = content.cards.filter((c) => {
            const idxThis = perspectives.findIndex((x) => x.key === p.key);
            const idxCard = perspectives.findIndex((x) => x.key === c.perspective);
            return idxCard === idxThis + 1;
          });
          return (
            <div key={p.key} className="rounded-lg border border-border bg-card p-3">
              <h4 className="mb-2 text-sm font-semibold text-foreground">{p.label}</h4>
              <div className="mb-2 flex flex-wrap gap-2">
                {cardsIn.map((c, i) => {
                  const asp = findAspiration(aspirations, c.aspiration_id);
                  const cls = aspClasses(asp?.number);
                  return (
                    <PostIt key={c.id} bgClass={asp ? cls.bgSoft : undefined} index={i} className="w-48">
                      <p className="text-foreground">{c.text}</p>
                      {cardsAbove.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {cardsAbove.map((above) => (
                            <label key={above.id} className="flex items-center gap-1 text-[11px] text-muted">
                              <input
                                type="checkbox"
                                checked={c.leads_to.includes(above.id)}
                                onChange={() => toggleLeadsTo(c.id, above.id)}
                              />
                              lleva a: {above.text.slice(0, 24)}
                            </label>
                          ))}
                        </div>
                      )}
                      <div className="mt-1 flex items-center justify-end text-[11px] text-muted">
                        <button className={btnDanger} onClick={() => removeCard(c.id)}>
                          ✕
                        </button>
                      </div>
                    </PostIt>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  placeholder="Nuevo objetivo estratégico…"
                  value={draft[p.key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [p.key]: e.target.value }))}
                />
                <button className={btnPrimary} onClick={() => addCard(p.key)}>
                  Agregar
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} />
    </div>
  );
}
