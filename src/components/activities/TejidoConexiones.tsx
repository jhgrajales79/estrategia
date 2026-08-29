"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { uploadMedia } from "@/lib/storage";
import { isPresenter } from "@/lib/presenter";
import {
  ActivityComponentProps,
  inputCls,
  btnPrimary,
  btnGhost,
  SaveIndicator,
  PresenterHint,
  initials,
  uid,
} from "./shared";

interface Thread {
  id: string;
  author: string;
  text: string;
}
interface Content extends Record<string, unknown> {
  threads: Thread[];
  media: string[];
  external_link: string;
}

const SIZE = 280;

function Web({ threads }: { threads: Thread[] }) {
  const n = threads.length;
  const center = SIZE / 2;
  const radius = SIZE / 2 - 44;

  function point(i: number) {
    const angle = -90 + (360 / Math.max(n, 1)) * i;
    const rad = (angle * Math.PI) / 180;
    return { x: center + radius * Math.cos(rad), y: center + radius * Math.sin(rad) };
  }

  if (n === 0) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-1 text-center text-sm text-muted">
        <span className="text-2xl">🧶</span>
        Aún nadie ha lanzado su hilo. ¡Sé el primero en tejer la red!
      </div>
    );
  }

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="absolute inset-0 overflow-visible">
        {threads.map((t, i) => {
          if (i === 0) return null;
          const a = point(i - 1);
          const b = point(i);
          return <line key={t.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--brand-dark)" strokeWidth={1.5} opacity={0.55} />;
        })}
        {n > 2 &&
          (() => {
            const a = point(n - 1);
            const b = point(0);
            return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--brand-dark)" strokeWidth={1.5} opacity={0.3} strokeDasharray="4 3" />;
          })()}
      </svg>
      {threads.map((t, i) => {
        const p = point(i);
        return (
          <div key={t.id} className="group absolute -translate-x-1/2 -translate-y-1/2" style={{ left: p.x, top: p.y }}>
            <div className="flex h-10 w-10 cursor-default items-center justify-center rounded-full bg-brand-dark text-[11px] font-bold text-white shadow ring-2 ring-card">
              {initials(t.author)}
            </div>
            <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 w-44 -translate-x-1/2 rounded-md bg-dark px-2.5 py-1.5 text-[11px] leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              <span className="font-semibold">{t.author}: </span>
              &ldquo;{t.text}&rdquo;
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TejidoConexiones({ activity, session, participant }: ActivityComponentProps) {
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { threads: [], media: [], external_link: "" }
  );
  const [draft, setDraft] = useState("");
  const [showMedia, setShowMedia] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  const myThread = content.threads.find((t) => t.author === participant.name);

  function addThread() {
    const text = draft.trim();
    if (!text) return;
    const thread: Thread = { id: uid(), author: participant.name, text };
    save({ ...content, threads: [...content.threads, thread] }, { eventType: "nota", summary: `${participant.name} tejió su hilo en "${activity.title}"` });
    setDraft("");
  }

  function removeThread(id: string) {
    save({ ...content, threads: content.threads.filter((t) => t.id !== id) });
  }

  function editMyThread() {
    if (!myThread) return;
    setDraft(myThread.text);
    removeThread(myThread.id);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadMedia(file, `activity-${activity.id}`);
      save({ ...content, media: [...content.media, url] }, { eventType: "foto", summary: `${participant.name} subió una foto en "${activity.title}"` });
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }
  function removeMedia(url: string) {
    save({ ...content, media: content.media.filter((m) => m !== url) });
  }

  return (
    <div className="space-y-5">
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
          <PresenterHint />
          <button className={btnGhost} onClick={() => setShowMedia((v) => !v)}>
            {showMedia ? "Ocultar" : "📷"} fotos y panel visual
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-gradient-to-b from-brand/5 to-transparent p-4">
        <p className="mb-4 text-center text-sm text-muted">
          En círculo, un ovillo de lana pasa de persona a persona: quien lo recibe dice en una frase cómo su rol{" "}
          <strong className="text-foreground">teje conexiones</strong> con el ser humano o la naturaleza.
        </p>
        <Web threads={content.threads} />
      </div>

      {!presenter && (
        <div className="rounded-lg border border-border bg-card p-3">
          {myThread ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-foreground">
                Tu hilo: <span className="italic">&ldquo;{myThread.text}&rdquo;</span>
              </p>
              <button className={btnGhost + " shrink-0"} onClick={editMyThread}>
                ✏️ Editar
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className={inputCls}
                placeholder="Mi rol teje conexión con…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addThread()}
              />
              <button className={btnPrimary + " shrink-0"} onClick={addThread}>
                🧶 Lanzar mi hilo
              </button>
            </div>
          )}
        </div>
      )}

      {presenter && showMedia && (
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
            <label className="mb-1 block text-xs font-medium text-muted">Panel visual (Obsidian u otro tablero)</label>
            <input
              className={inputCls}
              placeholder="https://..."
              defaultValue={content.external_link}
              onBlur={(e) => save({ ...content, external_link: e.target.value })}
            />
          </div>
        </div>
      )}

      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />

      {lightboxUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-6" onClick={() => setLightboxUrl(null)}>
          <button className="absolute right-4 top-4 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20" onClick={() => setLightboxUrl(null)}>
            ✕ Cerrar
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="Foto ampliada" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
