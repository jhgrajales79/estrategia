"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { ActivityComponentProps, inputCls, textareaCls, btnPrimary, btnDanger, SaveIndicator, PostIt, uid } from "./shared";

interface Note {
  id: string;
  category: string;
  aspiration_id: number | null;
  author: string;
  text: string;
  impact?: "alto" | "medio" | "bajo";
}
interface Content extends Record<string, unknown> {
  notes: Note[];
}

export default function NotasColectivas({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const categories = (activity.config.categories as { key: string; label: string }[]) ?? [];
  const impactLevels = Boolean(activity.config.impactLevels);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { notes: [] }
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [impact, setImpact] = useState<Record<string, Note["impact"]>>({});

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  function addNote(categoryKey: string) {
    const text = (draft[categoryKey] ?? "").trim();
    if (!text) return;
    const note: Note = {
      id: uid(),
      category: categoryKey,
      aspiration_id: participant.aspiration_id,
      author: participant.name,
      text,
      impact: impactLevels ? impact[categoryKey] ?? "medio" : undefined,
    };
    const next = { notes: [...content.notes, note] };
    save(next, { eventType: "nota", summary: `${participant.name} agregó una nota en "${activity.title}"` });
    setDraft((d) => ({ ...d, [categoryKey]: "" }));
  }

  function removeNote(id: string) {
    save({ notes: content.notes.filter((n) => n.id !== id) });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {categories.map((cat) => {
          const notesInCat = content.notes.filter((n) => n.category === cat.key);
          return (
            <div key={cat.key} className="rounded-lg border border-border bg-card p-3">
              <h4 className="mb-2 text-sm font-semibold text-foreground">{cat.label}</h4>
              <div className="mb-4 flex max-h-72 flex-wrap gap-3 overflow-y-auto p-1">
                {notesInCat.length === 0 && <p className="text-xs text-muted">Aún no hay notas.</p>}
                {notesInCat.map((n, i) => {
                  const asp = findAspiration(aspirations, n.aspiration_id);
                  const cls = aspClasses(asp?.number);
                  return (
                    <PostIt key={n.id} bgClass={asp ? cls.bgSoft : undefined} index={i} className="w-36">
                      <p className="text-foreground">{n.text}</p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                        <span>
                          {n.author}
                          {n.impact ? ` · ${n.impact}` : ""}
                        </span>
                        {n.author === participant.name && (
                          <button className={btnDanger} onClick={() => removeNote(n.id)}>
                            ✕
                          </button>
                        )}
                      </div>
                    </PostIt>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2">
                <textarea
                  className={textareaCls}
                  placeholder="Escribe tu aporte…"
                  value={draft[cat.key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [cat.key]: e.target.value }))}
                />
                <div className="flex items-center gap-2">
                  {impactLevels && (
                    <select
                      className={inputCls + " w-auto"}
                      value={impact[cat.key] ?? "medio"}
                      onChange={(e) => setImpact((i) => ({ ...i, [cat.key]: e.target.value as Note["impact"] }))}
                    >
                      <option value="alto">Impacto alto</option>
                      <option value="medio">Impacto medio</option>
                      <option value="bajo">Impacto bajo</option>
                    </select>
                  )}
                  <button className={btnPrimary} onClick={() => addNote(cat.key)}>
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} />
    </div>
  );
}
