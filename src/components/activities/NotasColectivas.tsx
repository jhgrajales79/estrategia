"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { aspAbbrev, aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { uploadMedia } from "@/lib/storage";
import { isPresenter } from "@/lib/presenter";
import {
  ActivityComponentProps,
  inputCls,
  textareaCls,
  btnPrimary,
  btnGhost,
  btnDanger,
  SaveIndicator,
  PostIt,
  PresenterHint,
  PinToggle,
  ToggleSwitch,
  uid,
} from "./shared";

interface Note {
  id: string;
  category: string;
  aspiration_id: number | null;
  author: string;
  text: string;
  impact?: "alto" | "medio" | "bajo";
  highlighted?: boolean;
}
interface Content extends Record<string, unknown> {
  notes: Note[];
  media: string[];
  external_link: string;
  showOnlyHighlighted: boolean;
}

export default function NotasColectivas({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const categories = (activity.config.categories as { key: string; label: string }[]) ?? [];
  const impactLevels = Boolean(activity.config.impactLevels);
  const allowMedia = Boolean(activity.config.allowMedia);
  const linkOnly = Boolean(activity.config.linkOnly);
  const selectableAspiration = Boolean(activity.config.selectableAspiration);
  const externalLinkLabel = (activity.config.externalLinkLabel as string) ?? "Enlace externo";
  const defaultLink = (activity.config.defaultLink as string) ?? "";
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { notes: [], media: [], external_link: defaultLink, showOnlyHighlighted: false }
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [impact, setImpact] = useState<Record<string, Note["impact"]>>({});
  const [aspirationChoice, setAspirationChoice] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadMedia(file, `activity-${activity.id}`);
      save(
        { ...content, media: [...content.media, url] },
        { eventType: "foto", summary: `${participant.name} subió una foto en "${activity.title}"` }
      );
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }
  function removeMedia(url: string) {
    save({ ...content, media: content.media.filter((m) => m !== url) });
  }

  function addNote(categoryKey: string) {
    const text = (draft[categoryKey] ?? "").trim();
    if (!text) return;
    const chosen = aspirationChoice[categoryKey];
    if (selectableAspiration && !chosen) return;
    const aspirationId = selectableAspiration ? Number(chosen) : participant.aspiration_id;
    const note: Note = {
      id: uid(),
      category: categoryKey,
      aspiration_id: aspirationId,
      author: participant.name,
      text,
      impact: impactLevels ? impact[categoryKey] ?? "medio" : undefined,
    };
    const next = { ...content, notes: [...content.notes, note] };
    save(next, { eventType: "nota", summary: `${participant.name} agregó una nota en "${activity.title}"` });
    setDraft((d) => ({ ...d, [categoryKey]: "" }));
  }

  function removeNote(id: string) {
    save({ ...content, notes: content.notes.filter((n) => n.id !== id) });
  }

  function toggleHighlight(id: string) {
    save({ ...content, notes: content.notes.map((n) => (n.id === id ? { ...n, highlighted: !n.highlighted } : n)) });
  }

  return (
    <div className="space-y-5">
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
          <PresenterHint />
          <div className="flex items-center gap-3">
            <ToggleSwitch
              checked={content.showOnlyHighlighted}
              onChange={(next) => save({ ...content, showOnlyHighlighted: next })}
              label="Mostrar solo destacadas"
            />
            <button
              className={btnGhost}
              title="Ampliar tablero en una pestaña nueva"
              onClick={() => window.open(`/notas/${activity.id}`, "_blank", "noopener,noreferrer")}
            >
              ⛶ Ampliar
            </button>
          </div>
        </div>
      )}
      {allowMedia && presenter && (
        <div className="rounded-lg border border-border bg-card p-3">
          <h4 className="mb-2 text-sm font-semibold text-foreground">Fotos y panel visual</h4>
          <p className="mb-2 text-xs text-muted">
            Solo tú, como facilitador, gestionas esto. Los participantes lo verán en el panel de avance, no aquí en la sesión.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {content.media.map((url) => (
              <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-md border border-border">
                <button className="h-full w-full cursor-zoom-in" title="Ampliar foto" onClick={() => setLightboxUrl(url)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Foto de la actividad" className="h-full w-full object-cover" />
                </button>
                <button
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1 text-xs text-white opacity-0 group-hover:opacity-100"
                  onClick={() => removeMedia(url)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <label className={btnGhost + " cursor-pointer"}>
            {uploading ? "Subiendo…" : "📷 Subir foto"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
          </label>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-muted">{externalLinkLabel}</label>
            <input
              className={inputCls}
              placeholder="https://..."
              defaultValue={content.external_link}
              onBlur={(e) => save({ ...content, external_link: e.target.value })}
            />
          </div>
        </div>
      )}
      {linkOnly && presenter && (
        <div className="rounded-lg border border-border bg-card p-3">
          <h4 className="mb-2 text-sm font-semibold text-foreground">{externalLinkLabel}</h4>
          <p className="mb-2 text-xs text-muted">Guarda aquí el enlace y ábrelo cuando lo necesites durante la sesión.</p>
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
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {categories.map((cat) => {
          const allNotesInCat = content.notes.filter((n) => n.category === cat.key);
          const notesInCat = content.showOnlyHighlighted ? allNotesInCat.filter((n) => n.highlighted) : allNotesInCat;
          return (
            <div key={cat.key} className="rounded-lg border border-border bg-card p-3">
              <h4 className="mb-2 text-sm font-semibold text-foreground">{cat.label}</h4>
              {presenter ? (
                <div className="mb-4 flex max-h-72 flex-wrap gap-3 overflow-y-auto p-1">
                  {notesInCat.length === 0 && <p className="text-xs text-muted">Aún no hay notas.</p>}
                  {notesInCat.map((n, i) => {
                    const asp = findAspiration(aspirations, n.aspiration_id);
                    const cls = aspClasses(asp?.number);
                    const abbrev = aspAbbrev(aspirations, n.aspiration_id);
                    return (
                      <PostIt key={n.id} bgClass={asp ? cls.bgSoft : undefined} index={i} highlighted={n.highlighted} className="w-36">
                        <p className="text-foreground">{n.text}</p>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                          <span className="font-semibold">
                            {abbrev ?? "—"}
                            {n.impact ? ` · ${n.impact}` : ""}
                          </span>
                          <PinToggle pinned={Boolean(n.highlighted)} onClick={() => toggleHighlight(n.id)} />
                        </div>
                      </PostIt>
                    );
                  })}
                </div>
              ) : (
                <div className="mb-4 max-h-72 space-y-1.5 overflow-y-auto">
                  {notesInCat.length === 0 && <p className="text-xs text-muted">Aún no hay notas.</p>}
                  {notesInCat.map((n) => {
                    const abbrev = aspAbbrev(aspirations, n.aspiration_id);
                    return (
                      <div key={n.id} className="flex items-start justify-between gap-2 text-sm">
                        <p className="text-foreground">
                          {abbrev && <span className="font-semibold text-brand-dark">{abbrev}: </span>}
                          {n.text}
                        </p>
                        {n.author === participant.name && (
                          <button className={btnDanger + " shrink-0"} onClick={() => removeNote(n.id)}>
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {!presenter && (
                <div className="flex flex-col gap-2">
                  {selectableAspiration && (
                    <select
                      className={inputCls}
                      value={aspirationChoice[cat.key] ?? ""}
                      onChange={(e) => setAspirationChoice((a) => ({ ...a, [cat.key]: e.target.value }))}
                    >
                      <option value="">Selecciona la aspiración…</option>
                      {aspirations.map((a) => (
                        <option key={a.id} value={a.id}>
                          Aspiración {a.number} — {a.name}
                        </option>
                      ))}
                    </select>
                  )}
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
              )}
            </div>
          );
        })}
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-6"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
            onClick={() => setLightboxUrl(null)}
          >
            ✕ Cerrar
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Foto ampliada"
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
