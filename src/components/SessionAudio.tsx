"use client";

import { useRef, useState } from "react";
import { uploadMedia } from "@/lib/storage";
import { updateSessionAudio } from "@/lib/data";
import { btnGhost } from "@/components/activities/shared";
import AudioPlayer from "@/components/AudioPlayer";
import type { SessionRow } from "@/lib/types";

// Audio por sesión en "Nuestro trabajo" (p. ej. la grabación de la plenaria): un solo archivo,
// reemplazable, subido solo por el facilitador — cualquier visitante que vea la sesión lo puede
// reproducir apenas está disponible.
export default function SessionAudio({
  session,
  presenter,
  onUpdated,
}: {
  session: SessionRow;
  presenter: boolean;
  onUpdated: (sessionId: number, audioUrl: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadMedia(file, `session-${session.id}-audio`, setProgress);
      await updateSessionAudio(session.id, url);
      onUpdated(session.id, url);
    } catch (err) {
      console.error(err);
      setError("No se pudo subir el audio. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    try {
      await updateSessionAudio(session.id, null);
      onUpdated(session.id, null);
    } catch (err) {
      console.error(err);
    }
  }

  if (!session.audio_url && !presenter) return null;

  return (
    <div className="mb-4">
      {session.audio_url ? (
        <div className="space-y-1.5">
          <AudioPlayer src={session.audio_url} />
          {presenter && (
            <button className={btnGhost} onClick={handleRemove}>
              ✕ Quitar audio
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mp4,.mp4,.m4a,audio/x-m4a"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <button className={btnGhost} disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? `Subiendo… ${Math.round(progress * 100)}%` : "🎙️ Subir audio de la sesión (mp4)"}
          </button>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
