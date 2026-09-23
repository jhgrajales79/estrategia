"use client";

import { useEffect, useRef, useState } from "react";
import { useSubmission, effectiveAspirationId, fetchLatestContent } from "@/lib/useSubmission";
import { aspAbbrev, aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { uploadMedia } from "@/lib/storage";
import { isHeicUrl } from "@/lib/media";
import { isPresenter } from "@/lib/presenter";
import { serverNow } from "@/lib/useServerClock";
import RotationBoard, { Rotation, EMPTY_ROTATION } from "@/components/RotationBoard";
import { exportRotationNotesToExcel } from "@/lib/exportExcel";
import ConsolidacionImpacto from "./ConsolidacionImpacto";
import SintesisEntorno from "./SintesisEntorno";
import {
  ActivityComponentProps,
  inputCls,
  textareaCls,
  btnPrimary,
  btnGhost,
  btnDanger,
  SaveIndicator,
  PostIt,
  NewsPage,
  PresenterHint,
  PinToggle,
  ToggleSwitch,
  uid,
  POLARITY_META,
  NotePolarity,
} from "./shared";

interface Note {
  id: string;
  category: string;
  aspiration_id: number | null;
  author: string;
  text: string;
  impact?: "alto" | "medio" | "bajo";
  polarity?: NotePolarity;
  highlighted?: boolean;
}

interface Content extends Record<string, unknown> {
  notes: Note[];
  media: string[];
  external_link: string;
  showOnlyHighlighted: boolean;
  rotation?: Rotation;
}

export default function NotasColectivas(props: ActivityComponentProps) {
  // El POAM reutiliza este mismo activity_type ("notas") pero, en vez del flujo de agregar texto
  // libre, presenta un tablero de arrastrar y soltar sobre las notas de otra actividad (p. ej.
  // Mundo café) para clasificarlas por impacto — ver ConsolidacionImpacto.tsx.
  if (props.activity.config.consolidationFrom) {
    return <ConsolidacionImpacto {...props} />;
  }
  // El Cierre reutiliza también "notas": en vez de texto libre, trae en vivo las candidatas de
  // alto impacto del POAM y solo pide votar cuando hay más de `topN` por categoría — ver
  // SintesisEntorno.tsx.
  if (props.activity.config.topFrom) {
    return <SintesisEntorno {...props} />;
  }
  return <NotasColectivasClasico {...props} />;
}

function NotasColectivasClasico({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const categories = (activity.config.categories as { key: string; label: string }[]) ?? [];
  const rotationMinutes = Number(activity.config.rotationMinutes) || 0;
  const impactLevels = Boolean(activity.config.impactLevels);
  const polarityTags = Boolean(activity.config.polarityTags);
  const allowMedia = Boolean(activity.config.allowMedia);
  const linkOnly = Boolean(activity.config.linkOnly);
  const selectableAspiration = Boolean(activity.config.selectableAspiration);
  const newsStyle = Boolean(activity.config.newsStyle);
  const externalLinkLabel = (activity.config.externalLinkLabel as string) ?? "Enlace externo";
  const defaultLink = (activity.config.defaultLink as string) ?? "";
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const emptyContent: Content = { notes: [], media: [], external_link: defaultLink, showOnlyHighlighted: false };
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    emptyContent
  );
  // Muchas personas escriben en esta actividad a la vez (mesas rotando, aportes constantes) y el
  // facilitador interactúa con la rotación bastante seguido — si su pestaña llegara a perder la
  // suscripción de tiempo real por un momento (backgrounding del navegador, red inestable), el
  // `content` que tiene en memoria queda desactualizado. Guardar con un spread directo de ese
  // `content` viejo (p. ej. al pausar o avanzar de mesa) pisaría en silencio las notas que otros
  // ya guardaron mientras tanto. Por eso cada guardado parcial vuelve a leer el valor más
  // reciente de la base de datos justo antes de aplicar su cambio — mismo patrón que ya usan
  // ConsolidacionImpacto.tsx y SintesisEntorno.tsx para submissions compartidas.
  async function mutateContent(fn: (latest: Content) => Content, opts?: { eventType?: string; summary?: string }) {
    const latest = await fetchLatestContent<Content>(activity.id, submissionAspId, emptyContent);
    await save(fn(latest), opts);
  }
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [impact, setImpact] = useState<Record<string, Note["impact"]>>({});
  const [polarity, setPolarity] = useState<Record<string, Note["polarity"]>>({});
  const [aspirationChoice, setAspirationChoice] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Al llegar a la última ronda ("done") nada se borra del tablero — las notas siguen en
  // `content.notes` igual que siempre — pero el facilitador se lleva además una copia en Excel
  // como respaldo, apenas la rotación termina. `autoExportedRef` evita repetir la descarga en
  // cada re-render mientras el estado sigue en "done", y se limpia si la rotación se reinicia
  // para que una rotación futura vuelva a disparar su propia descarga.
  const rotationStatus = content.rotation?.status ?? "idle";
  const autoExportedRef = useRef(false);
  useEffect(() => {
    if (!presenter || rotationMinutes <= 0) return;
    if (rotationStatus === "done") {
      if (!autoExportedRef.current) {
        autoExportedRef.current = true;
        exportRotationNotesToExcel({ activityTitle: activity.title, categories, notes: content.notes, aspirations });
      }
    } else {
      autoExportedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotationStatus, presenter, rotationMinutes]);

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadMedia(file, `activity-${activity.id}`);
      await mutateContent((latest) => ({ ...latest, media: [...latest.media, url] }), {
        eventType: "foto",
        summary: `${participant.name} subió una foto en "${activity.title}"`,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }
  function removeMedia(url: string) {
    mutateContent((latest) => ({ ...latest, media: latest.media.filter((m) => m !== url) }));
  }

  function addNote(categoryKey: string) {
    // Mientras la rotación está corriendo, cada aporte solo puede ir a la mesa activa — evita
    // que alguien siga escribiendo en una mesa que ya rotó, o se adelante a una que no ha
    // empezado. El botón ya está oculto para esas mesas, pero se repite la validación aquí por
    // si el guardado se dispara desde otro lado (p. ej. Enter en el textarea).
    if (rotationLive && categoryKey !== activeCategoryKey) return;
    const text = (draft[categoryKey] ?? "").trim();
    if (!text) return;
    const chosen = aspirationChoice[categoryKey];
    if (selectableAspiration && !chosen) return;
    const chosenPolarity = polarity[categoryKey];
    if (polarityTags && !chosenPolarity) return;
    const aspirationId = selectableAspiration ? Number(chosen) : participant.aspiration_id;
    const note: Note = {
      id: uid(),
      category: categoryKey,
      aspiration_id: aspirationId,
      author: participant.name,
      text,
      impact: impactLevels ? impact[categoryKey] ?? "medio" : undefined,
      polarity: polarityTags ? chosenPolarity : undefined,
    };
    mutateContent((latest) => ({ ...latest, notes: [...latest.notes, note] }), {
      eventType: "nota",
      summary: `${participant.name} agregó una nota en "${activity.title}"`,
    });
    setDraft((d) => ({ ...d, [categoryKey]: "" }));
  }

  function removeNote(id: string) {
    mutateContent((latest) => ({ ...latest, notes: latest.notes.filter((n) => n.id !== id) }));
  }

  function toggleHighlight(id: string) {
    mutateContent((latest) => ({ ...latest, notes: latest.notes.map((n) => (n.id === id ? { ...n, highlighted: !n.highlighted } : n)) }));
  }

  const rotation = content.rotation ?? EMPTY_ROTATION;
  const rotationLive = rotationMinutes > 0 && (rotation.status === "running" || rotation.status === "paused");
  const activeCategoryKey = rotationLive ? categories[rotation.round - 1]?.key ?? null : null;
  function saveRotation(next: Rotation) {
    mutateContent((latest) => ({ ...latest, rotation: next }));
  }
  function startRotationRound(startAt: number) {
    saveRotation({ round: startAt, status: "running", endAt: new Date(serverNow() + rotationMinutes * 60_000).toISOString(), remainingSeconds: null });
  }
  function pauseRotation() {
    const remaining = rotation.endAt ? Math.max(0, Math.round((new Date(rotation.endAt).getTime() - serverNow()) / 1000)) : rotationMinutes * 60;
    saveRotation({ ...rotation, status: "paused", endAt: null, remainingSeconds: remaining });
  }
  function resumeRotation() {
    const secs = rotation.remainingSeconds ?? rotationMinutes * 60;
    saveRotation({ ...rotation, status: "running", endAt: new Date(serverNow() + secs * 1000).toISOString(), remainingSeconds: null });
  }
  function nextTable() {
    if (rotation.round >= categories.length) {
      saveRotation({ ...rotation, status: "done", endAt: null, remainingSeconds: null });
    } else {
      startRotationRound(rotation.round + 1);
    }
  }
  function resetRotation() {
    saveRotation(EMPTY_ROTATION);
  }

  return (
    <div className="space-y-5">
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
          <PresenterHint />
          <div className="flex items-center gap-3">
            <ToggleSwitch
              checked={content.showOnlyHighlighted}
              onChange={(next) => mutateContent((latest) => ({ ...latest, showOnlyHighlighted: next }))}
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
      {rotationMinutes > 0 && categories.length > 0 && (
        <RotationBoard
          rotation={rotation}
          minutesPerRound={rotationMinutes}
          tableCount={categories.length}
          activeLabel={categories[Math.min(rotation.round, categories.length) - 1]?.label ?? ""}
          nextLabel={categories[rotation.round]?.label ?? null}
          presenter={presenter}
          onStart={() => startRotationRound(1)}
          onPause={pauseRotation}
          onResume={resumeRotation}
          onNext={nextTable}
          onReset={resetRotation}
        />
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
                <button
                  className="h-full w-full cursor-zoom-in"
                  title={isHeicUrl(url) ? "Formato no compatible — clic para abrir el original" : "Ampliar foto"}
                  onClick={() => (isHeicUrl(url) ? window.open(url, "_blank", "noopener,noreferrer") : setLightboxUrl(url))}
                >
                  {isHeicUrl(url) ? (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-amber-50 px-1 text-center text-[10px] text-amber-700">
                      <span className="text-lg">⚠️</span>
                      Sin vista previa
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="Foto de la actividad" className="h-full w-full object-cover" />
                  )}
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
              onBlur={(e) => mutateContent((latest) => ({ ...latest, external_link: e.target.value }))}
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
              onBlur={(e) => mutateContent((latest) => ({ ...latest, external_link: e.target.value }))}
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
        {categories.map((cat, catIndex) => {
          const allNotesInCat = content.notes.filter((n) => n.category === cat.key);
          const notesInCat = content.showOnlyHighlighted ? allNotesInCat.filter((n) => n.highlighted) : allNotesInCat;
          const isActiveTable = rotationLive && cat.key === activeCategoryKey;
          const isPastTable = rotationLive && catIndex < rotation.round - 1;
          const canWriteHere = !rotationLive || isActiveTable;
          if (newsStyle) {
            // La página de periódico ya trae su propio masthead — el recuadro genérico de
            // categoría (título + borde) sobraría encima, así que esta rama la reemplaza entera.
            return (
              <NewsPage
                key={cat.key}
                title={cat.label}
                notes={notesInCat.map((n) => {
                  const abbrev = aspAbbrev(aspirations, n.aspiration_id);
                  const asp = findAspiration(aspirations, n.aspiration_id);
                  const cls = aspClasses(asp?.number);
                  const canRemove = !presenter && n.author === participant.name;
                  return {
                    id: n.id,
                    headline: n.text,
                    author: n.author,
                    highlighted: n.highlighted,
                    tag: abbrev ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls.bgSoft} ${cls.text}`}>{abbrev}</span> : undefined,
                    actions: presenter ? (
                      <PinToggle pinned={Boolean(n.highlighted)} onClick={() => toggleHighlight(n.id)} title="Poner/quitar de portada" />
                    ) : canRemove ? (
                      <button className={btnDanger} onClick={() => removeNote(n.id)}>
                        ✕ quitar
                      </button>
                    ) : undefined,
                  };
                })}
              />
            );
          }
          return (
            <div
              key={cat.key}
              className={`rounded-lg border p-3 transition-all ${
                isActiveTable
                  ? "border-brand bg-brand/5 shadow-sm ring-1 ring-brand/40"
                  : isPastTable
                    ? "border-border bg-card opacity-60"
                    : "border-border bg-card"
              }`}
            >
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                {cat.label}
                {isActiveTable && (
                  <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-dark">
                    📍 Mesa actual
                  </span>
                )}
              </h4>
              {presenter ? (
                <div className="mb-4 flex max-h-72 flex-wrap gap-3 overflow-y-auto p-1">
                  {notesInCat.length === 0 && allNotesInCat.length > 0 && (
                    <p className="text-xs text-amber-700">
                      ⚠️ Hay {allNotesInCat.length} {allNotesInCat.length === 1 ? "nota" : "notas"} guardadas, pero "Mostrar solo
                      destacadas" está activo y ninguna está marcada con 📌 — desactívalo arriba para verlas.
                    </p>
                  )}
                  {notesInCat.length === 0 && allNotesInCat.length === 0 && <p className="text-xs text-muted">Aún no hay notas.</p>}
                  {notesInCat.map((n, i) => {
                    const asp = findAspiration(aspirations, n.aspiration_id);
                    const cls = aspClasses(asp?.number);
                    const abbrev = aspAbbrev(aspirations, n.aspiration_id);
                    const pol = n.polarity ? POLARITY_META[n.polarity] : null;
                    return (
                      <PostIt key={n.id} bgClass={asp ? cls.bgSoft : undefined} index={i} highlighted={n.highlighted} className="w-36">
                        {pol && (
                          <span className={`mb-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold ${pol.badgeCls}`}>
                            {pol.icon} {pol.label}
                          </span>
                        )}
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
                  {notesInCat.length === 0 && allNotesInCat.length > 0 && (
                    <p className="text-xs text-amber-700">
                      ⚠️ El facilitador activó "Mostrar solo destacadas" y aún no marcó ninguna — tus aportes están guardados, solo
                      no se ven por ahora.
                    </p>
                  )}
                  {notesInCat.length === 0 && allNotesInCat.length === 0 && <p className="text-xs text-muted">Aún no hay notas.</p>}
                  {notesInCat.map((n) => {
                    const abbrev = aspAbbrev(aspirations, n.aspiration_id);
                    const pol = n.polarity ? POLARITY_META[n.polarity] : null;
                    return (
                      <div key={n.id} className="flex items-start justify-between gap-2 text-sm">
                        <p className="text-foreground">
                          {pol && <span className="mr-1">{pol.icon}</span>}
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
              {!presenter && !canWriteHere && (
                <p className="rounded-md bg-black/[0.03] px-3 py-2 text-xs text-muted">
                  🔒 Esta mesa no está activa en este momento — espera tu turno de rotación.
                </p>
              )}
              {!presenter && canWriteHere && (
                <div className="flex flex-col gap-2">
                  {polarityTags && (
                    <div className="flex gap-1.5" role="radiogroup" aria-label="¿Oportunidad o amenaza?">
                      {(Object.keys(POLARITY_META) as (keyof typeof POLARITY_META)[]).map((key) => {
                        const meta = POLARITY_META[key];
                        const selected = polarity[cat.key] === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setPolarity((p) => ({ ...p, [cat.key]: key }))}
                            className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
                              selected ? meta.selectedCls + " border-transparent" : "border-border text-muted hover:bg-black/5"
                            }`}
                          >
                            {meta.icon} {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
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
                    <button
                      className={btnPrimary}
                      disabled={polarityTags && !polarity[cat.key]}
                      title={polarityTags && !polarity[cat.key] ? "Marca si es una oportunidad o una amenaza" : undefined}
                      onClick={() => addNote(cat.key)}
                    >
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
