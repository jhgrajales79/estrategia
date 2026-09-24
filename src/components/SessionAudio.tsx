"use client";

import AudioPlayer from "@/components/AudioPlayer";
import type { SessionRow } from "@/lib/types";

// Reproducción del audio de la sesión en "Nuestro trabajo" — visible para cualquier persona.
// La subida es exclusiva del facilitador y vive en /sesiones/[code] (ver SessionAudioUpload.tsx).
export default function SessionAudio({ session }: { session: SessionRow }) {
  if (!session.audio_url) return null;
  return (
    <div className="mb-4">
      <AudioPlayer src={session.audio_url} />
    </div>
  );
}
