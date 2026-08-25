"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredParticipant, StoredParticipant } from "./participant";

export function useRequireParticipant(): StoredParticipant | null {
  const router = useRouter();
  const [participant, setParticipant] = useState<StoredParticipant | null>(null);

  useEffect(() => {
    const p = getStoredParticipant();
    if (!p) {
      router.replace("/ingresar");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParticipant(p);
  }, [router]);

  return participant;
}
