"use client";

import { useEffect, useState } from "react";
import { getStoredParticipant, StoredParticipant } from "./participant";

// Como useRequireParticipant, pero sin redirigir a /ingresar cuando no hay sesión guardada —
// para páginas públicas (p. ej. la portada publicada de Visión Socya 2029) que cualquiera debe
// poder abrir sin haber ingresado como participante o facilitador. `loaded` distingue "todavía no
// leí localStorage" de "leí y no hay nadie" para no parpadear a la vista pública antes de tiempo.
export function useOptionalParticipant(): { participant: StoredParticipant | null; loaded: boolean } {
  const [participant, setParticipant] = useState<StoredParticipant | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParticipant(getStoredParticipant());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(true);
  }, []);

  return { participant, loaded };
}
