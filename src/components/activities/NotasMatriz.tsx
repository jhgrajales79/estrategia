"use client";

import { Fragment, useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import AspirationBadge from "@/components/AspirationBadge";
import { ActivityComponentProps, inputCls, btnGhost, SaveIndicator, uid } from "./shared";

interface Note {
  id: string;
  category: string;
  aspiration_id: number | null;
  author: string;
  text: string;
}
interface Content extends Record<string, unknown> {
  notes: Note[];
  external_link: string;
}

export default function NotasMatriz({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const categories = (activity.config.categories as { key: string; label: string }[]) ?? [];
  const linkOnly = Boolean(activity.config.linkOnly);
  const externalLinkLabel = (activity.config.externalLinkLabel as string) ?? "Enlace externo";
  const defaultLink = (activity.config.defaultLink as string) ?? "";
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { notes: [], external_link: defaultLink }
  );
  const [draft, setDraft] = useState<Record<string, string>>({});

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  function cellKey(aspirationId: number, categoryKey: string) {
    return `${aspirationId}:${categoryKey}`;
  }

  function addNote(aspirationId: number, categoryKey: string) {
    const key = cellKey(aspirationId, categoryKey);
    const text = (draft[key] ?? "").trim();
    if (!text) return;
    const note: Note = { id: uid(), category: categoryKey, aspiration_id: aspirationId, author: participant.name, text };
    save(
      { ...content, notes: [...content.notes, note] },
      { eventType: "nota", summary: `${participant.name} agregó una nota en "${activity.title}"` }
    );
    setDraft((d) => ({ ...d, [key]: "" }));
  }

  function removeNote(id: string) {
    save({ ...content, notes: content.notes.filter((n) => n.id !== id) });
  }

  return (
    <div className="space-y-4">
      {linkOnly && (
        <div className="rounded-lg border border-border bg-card p-3">
          <h4 className="mb-1 text-sm font-semibold text-foreground">{externalLinkLabel}</h4>
          {presenter ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className={inputCls}
                placeholder="https://..."
                defaultValue={content.external_link}
                onBlur={(e) => save({ ...content, external_link: e.target.value })}
              />
              <button
                className={btnGhost + " shrink-0"}
                disabled={!content.external_link}
                onClick={() => window.open(content.external_link, "_blank", "noopener,noreferrer")}
              >
                🔗 Abrir
              </button>
            </div>
          ) : (
            content.external_link && (
              <button className={btnGhost} onClick={() => window.open(content.external_link, "_blank", "noopener,noreferrer")}>
                🔗 Abrir {externalLinkLabel}
              </button>
            )
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <div
          className="grid min-w-[640px] gap-2"
          style={{ gridTemplateColumns: `160px repeat(${categories.length}, minmax(200px, 1fr))` }}
        >
          <div />
          {categories.map((c) => (
            <div key={c.key} className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {c.label}
            </div>
          ))}
          {aspirations.map((a) => (
            <Fragment key={a.id}>
              <div className="flex items-start pt-1">
                <AspirationBadge number={a.number} />
              </div>
              {categories.map((c) => {
                const key = cellKey(a.id, c.key);
                const notes = content.notes.filter((n) => n.aspiration_id === a.id && n.category === c.key);
                return (
                  <div key={key} className="flex min-h-[110px] flex-col gap-1.5 rounded-lg border border-border bg-black/[0.015] p-2">
                    {notes.map((n) => (
                      <div key={n.id} className="group flex items-start justify-between gap-1.5 rounded-md bg-card px-2 py-1.5 text-xs shadow-sm">
                        <span className="text-foreground">{n.text}</span>
                        {(presenter || n.author === participant.name) && (
                          <button
                            className="shrink-0 text-muted opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                            onClick={() => removeNote(n.id)}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <input
                      className="w-full rounded-md border border-dashed border-border bg-transparent px-2 py-1 text-xs placeholder:text-muted focus:border-solid focus:border-brand/50 focus:outline-none"
                      placeholder="+ Agregar…"
                      value={draft[key] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && addNote(a.id, c.key)}
                      onBlur={() => addNote(a.id, c.key)}
                    />
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
