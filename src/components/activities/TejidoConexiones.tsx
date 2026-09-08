"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { uploadMedia } from "@/lib/storage";
import { isVideoUrl, isHeicUrl } from "@/lib/media";
import { isPresenter } from "@/lib/presenter";
import ConnectionsWebView from "@/components/ConnectionsWebView";
import WeaveGalleryViewer from "@/components/WeaveGalleryViewer";
import { ActivityComponentProps, inputCls, btnPrimary, btnGhost, SaveIndicator, PresenterHint, uid } from "./shared";

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
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadMsg, setUploadMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  // Un video con códec no soportado (típicamente HEVC de iPhone en modo "Alta eficiencia")
  // no sube con error — solo falla al intentar reproducirlo en el navegador. Se detecta con
  // el evento onError y se trata igual que un HEIC: aviso en vez de un recuadro vacío.
  const [failedVideos, setFailedVideos] = useState<Set<string>>(new Set());
  function markVideoFailed(url: string) {
    setFailedVideos((s) => new Set(s).add(url));
  }

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

  // Sube cada archivo con hasta 2 reintentos (la wifi de un taller presencial es poco
  // confiable) y nunca deja que un solo archivo problemático descarte a los demás: antes se
  // usaba Promise.all, que es todo-o-nada — si una sola foto/video fallaba, la tanda entera se
  // perdía en silencio y el facilitador no se enteraba de nada. Ahora cada archivo se resuelve
  // de forma independiente y se guardan los que sí lograron subir.
  async function uploadWithRetry(file: File, scope: string, attempts = 3): Promise<string> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await uploadMedia(file, scope);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  }

  async function handleUpload(files: FileList) {
    const fileList = Array.from(files);
    setUploading(true);
    setUploadMsg(null);
    setUploadProgress({ done: 0, total: fileList.length });
    const succeeded: string[] = [];
    const failed: { name: string; reason: string }[] = [];
    for (const f of fileList) {
      try {
        const url = await uploadWithRetry(f, `activity-${activity.id}`);
        succeeded.push(url);
      } catch (err) {
        console.error(err);
        failed.push({ name: f.name, reason: err instanceof Error ? err.message : "error desconocido" });
      } finally {
        setUploadProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    }
    if (succeeded.length > 0) {
      save(
        { ...content, media: [...content.media, ...succeeded] },
        {
          eventType: "foto",
          summary: `${participant.name} subió ${succeeded.length > 1 ? `${succeeded.length} fotos/videos` : "una foto"} en "${activity.title}"`,
        }
      );
    }
    if (failed.length === 0) {
      setUploadMsg({ text: `✓ Se subieron ${succeeded.length} ${succeeded.length === 1 ? "archivo" : "archivos"}.`, isError: false });
    } else {
      setUploadMsg({
        text: `${succeeded.length > 0 ? `Se subieron ${succeeded.length} de ${fileList.length}. ` : "No se pudo subir ningún archivo. "}Fallaron: ${failed
          .map((f) => `${f.name} (${f.reason})`)
          .join(", ")}`,
        isError: true,
      });
    }
    setUploading(false);
    setUploadProgress(null);
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
        <ConnectionsWebView threads={content.threads} />
        {content.media.length > 0 && (
          <div className="mt-4 flex justify-center">
            <button
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-dark to-brand px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.03]"
              onClick={() => setGalleryOpen(true)}
            >
              🧶🖼️ Ver el mural del tejido
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs">{content.media.length}</span>
            </button>
          </div>
        )}
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
          <h4 className="mb-2 text-sm font-semibold text-foreground">Fotos, videos y panel visual</h4>
          <p className="mb-2 text-xs text-muted">
            Solo tú, como facilitador, subes y quitas fotos y videos aquí. En cuanto subas algo, todos los
            participantes podrán abrirlo desde el botón <strong className="text-foreground">🧶🖼️ Ver el mural del tejido</strong>{" "}
            encima del tejido, y también rotará en <strong className="text-foreground">Panel en vivo</strong>.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {content.media.map((url) => (
              <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-md border border-border bg-black/5">
                {(() => {
                  const unsupported = isHeicUrl(url) || (isVideoUrl(url) && failedVideos.has(url));
                  return (
                    <button
                      className="relative h-full w-full cursor-zoom-in"
                      title={unsupported ? "Formato no compatible — clic para abrir el original" : "Ampliar"}
                      onClick={() => (unsupported ? window.open(url, "_blank", "noopener,noreferrer") : setLightboxUrl(url))}
                    >
                      {unsupported ? (
                        <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-amber-50 px-1 text-center text-[10px] text-amber-700">
                          <span className="text-lg">⚠️</span>
                          Sin vista previa
                        </span>
                      ) : isVideoUrl(url) ? (
                        <>
                          <video src={url} className="h-full w-full object-cover" muted onError={() => markVideoFailed(url)} />
                          <span className="absolute inset-0 flex items-center justify-center text-lg text-white drop-shadow">▶</span>
                        </>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="Foto de la actividad" className="h-full w-full object-cover" />
                      )}
                    </button>
                  );
                })()}
                <button
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1 text-xs text-white opacity-0 group-hover:opacity-100"
                  onClick={() => removeMedia(url)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className={btnGhost + " cursor-pointer"}>
              {uploading ? `Subiendo… ${uploadProgress ? `${uploadProgress.done}/${uploadProgress.total}` : ""}` : "📷 Subir fotos o videos"}
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) handleUpload(files);
                  e.target.value = "";
                }}
              />
            </label>
            {uploadMsg && (
              <p className={`text-xs ${uploadMsg.isError ? "text-red-600" : "text-brand-dark"}`}>{uploadMsg.text}</p>
            )}
          </div>
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
          {isVideoUrl(lightboxUrl) ? (
            <video
              src={lightboxUrl}
              controls
              autoPlay
              className="max-h-full max-w-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
              onError={() => {
                markVideoFailed(lightboxUrl);
                setLightboxUrl(null);
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightboxUrl} alt="Foto ampliada" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}

      <WeaveGalleryViewer media={content.media} open={galleryOpen} onClose={() => setGalleryOpen(false)} />
    </div>
  );
}
