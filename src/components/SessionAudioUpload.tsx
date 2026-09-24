"use client";

import { useRef, useState } from "react";
import { uploadMedia } from "@/lib/storage";
import { updateSessionAudio } from "@/lib/data";
import { btnGhost } from "@/components/activities/shared";
import type { SessionRow } from "@/lib/types";

// Control de moderador para el audio de la sesión — vive en /sesiones/[code], no en "Nuestro
// trabajo": solo el facilitador puede subir o reemplazar el archivo aquí; la reproducción (para
// cualquier persona) está en SessionAudio.tsx.
export default function SessionAudioUpload({
  session,
  onUpdated,
}: {
  session: SessionRow;
  onUpdated: (audioUrl: string | null) => void;
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
      onUpdated(url);
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
      onUpdated(null);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold text-muted">🎙️ Audio de la sesión:</span>
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
      {session.audio_url ? (
        <>
          <span className="text-muted">Subido — se escucha en &quot;Nuestro trabajo&quot;.</span>
          <button className={btnGhost} disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? `Subiendo… ${Math.round(progress * 100)}%` : "↺ Reemplazar"}
          </button>
          <button className={btnGhost} onClick={handleRemove}>
            ✕ Quitar
          </button>
        </>
      ) : (
        <button className={btnGhost} disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? `Subiendo… ${Math.round(progress * 100)}%` : "Subir audio (mp4)"}
        </button>
      )}
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
