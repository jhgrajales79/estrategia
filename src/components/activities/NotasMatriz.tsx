"use client";

import { Fragment, useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import AspirationBadge from "@/components/AspirationBadge";
import { ActivityComponentProps, inputCls, btnGhost, SaveIndicator, uid } from "./shared";

type Impact = "alto" | "medio" | "bajo";
interface Note {
  id: string;
  category: string;
  aspiration_id: number | null;
  author: string;
  text: string;
  impact?: Impact;
}
interface Content extends Record<string, unknown> {
  notes: Note[];
  external_link: string;
}

const IMPACT_META: Record<Impact, { label: string; dot: string; text: string }> = {
  alto: { label: "Alto", dot: "bg-red-500", text: "text-red-700" },
  medio: { label: "Medio", dot: "bg-amber-500", text: "text-amber-700" },
  bajo: { label: "Bajo", dot: "bg-brand-dark", text: "text-brand-dark" },
};
const IMPACT_ORDER: Impact[] = ["alto", "medio", "bajo"];

export default function NotasMatriz({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const categories = (activity.config.categories as { key: string; label: string }[]) ?? [];
  const linkOnly = Boolean(activity.config.linkOnly);
  const impactLevels = Boolean(activity.config.impactLevels);
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
  const [impactDraft, setImpactDraft] = useState<Record<string, Impact>>({});
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  function cellKey(aspirationId: number, categoryKey: string) {
    return `${aspirationId}:${categoryKey}`;
  }

  function addNote(aspirationId: number, categoryKey: string) {
    const key = cellKey(aspirationId, categoryKey);
    const text = (draft[key] ?? "").trim();
    if (!text) return;
    const note: Note = {
      id: uid(),
      category: categoryKey,
      aspiration_id: aspirationId,
      author: participant.name,
      text,
      impact: impactLevels ? impactDraft[key] ?? "medio" : undefined,
    };
    save(
      { ...content, notes: [...content.notes, note] },
      { eventType: "nota", summary: `${participant.name} agregó una nota en "${activity.title}"` }
    );
    setDraft((d) => ({ ...d, [key]: "" }));
    setImpactDraft((d) => ({ ...d, [key]: "medio" }));
  }

  function removeNote(id: string) {
    save({ ...content, notes: content.notes.filter((n) => n.id !== id) });
  }

  function startEdit(note: Note) {
    setEditing((e) => ({ ...e, [note.id]: note.text }));
  }

  function cancelEdit(id: string) {
    setEditing((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });
  }

  function commitEdit(id: string) {
    const text = (editing[id] ?? "").trim();
    if (!text) {
      removeNote(id);
    } else {
      save({ ...content, notes: content.notes.map((n) => (n.id === id ? { ...n, text } : n)) });
    }
    cancelEdit(id);
  }

  function copyMatrix() {
    const lines: string[] = [];
    for (const a of aspirations) {
      lines.push(`Aspiración ${a.number} — ${a.name}`);
      for (const c of categories) {
        const notes = content.notes.filter((n) => n.aspiration_id === a.id && n.category === c.key);
        lines.push(`  ${c.label}:`);
        if (notes.length === 0) lines.push("    (sin aportes)");
        for (const n of notes) {
          const impactSuffix = n.impact ? ` [Impacto: ${IMPACT_META[n.impact].label}]` : "";
          lines.push(`    - ${n.text} (${n.author})${impactSuffix}`);
        }
      }
      lines.push("");
    }
    const text = lines.join("\n");
    const flash = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    const fallbackCopy = () => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        flash();
      } catch (err) {
        console.error(err);
      } finally {
        document.body.removeChild(textarea);
      }
    };
    if (navigator.clipboard?.writeText) {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          fallbackCopy();
        }
      }, 800);
      navigator.clipboard
        .writeText(text)
        .then(() => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          flash();
        })
        .catch(() => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          fallbackCopy();
        });
    } else {
      fallbackCopy();
    }
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

      <div className="flex items-center justify-end">
        <button className={btnGhost} onClick={copyMatrix}>
          {copied ? "✓ Copiado" : "📋 Copiar matriz"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid min-w-[640px] gap-2"
          style={{ gridTemplateColumns: `160px repeat(${categories.length}, minmax(200px, 1fr))` }}
        >
          <div />
          {categories.map((c) => {
            const total = content.notes.filter((n) => n.category === c.key).length;
            return (
              <div key={c.key} className="flex items-baseline gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                {c.label}
                {total > 0 && <span className="font-normal normal-case text-muted/80">({total})</span>}
              </div>
            );
          })}
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
                    <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
                      {notes.map((n) => {
                        const canEdit = presenter || n.author === participant.name;
                        if (editing[n.id] !== undefined) {
                          return (
                            <input
                              key={n.id}
                              autoFocus
                              className="w-full rounded-md border border-brand/50 bg-card px-2 py-1.5 text-xs focus:outline-none"
                              value={editing[n.id]}
                              onChange={(e) => setEditing((ed) => ({ ...ed, [n.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit(n.id);
                                if (e.key === "Escape") cancelEdit(n.id);
                              }}
                              onBlur={() => commitEdit(n.id)}
                            />
                          );
                        }
                        const impactMeta = n.impact ? IMPACT_META[n.impact] : null;
                        return (
                          <div
                            key={n.id}
                            className={`group flex items-start justify-between gap-1.5 rounded-md bg-card px-2 py-1.5 text-xs shadow-sm ${canEdit ? "cursor-pointer" : ""}`}
                            onClick={() => canEdit && startEdit(n)}
                            title={canEdit ? "Clic para editar" : undefined}
                          >
                            <div className="min-w-0">
                              {impactMeta && (
                                <span className={`mb-0.5 inline-flex items-center gap-1 text-[10px] font-semibold ${impactMeta.text}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${impactMeta.dot}`} />
                                  {impactMeta.label}
                                </span>
                              )}
                              <p className="text-foreground">{n.text}</p>
                            </div>
                            {canEdit && (
                              <button
                                className="shrink-0 text-muted opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeNote(n.id);
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {impactLevels && (
                      <div className="flex gap-1">
                        {IMPACT_ORDER.map((lvl) => {
                          const active = (impactDraft[key] ?? "medio") === lvl;
                          const meta = IMPACT_META[lvl];
                          return (
                            <button
                              key={lvl}
                              type="button"
                              className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                active ? `border-current ${meta.text} bg-card` : "border-border text-muted"
                              }`}
                              onClick={() => setImpactDraft((d) => ({ ...d, [key]: lvl }))}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${active ? meta.dot : "bg-black/20"}`} />
                              {meta.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
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
