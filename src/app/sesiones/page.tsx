"use client";

import { useEffect, useMemo, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchOutputs, fetchSessions } from "@/lib/data";
import type { OutputRow, SessionRow } from "@/lib/types";
import Cronograma from "@/components/Cronograma";

export default function SesionesPage() {
  const participant = useRequireParticipant();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [outputs, setOutputs] = useState<OutputRow[]>([]);

  useEffect(() => {
    fetchSessions().then(setSessions).catch(console.error);
    fetchOutputs().then(setOutputs).catch(console.error);
  }, []);

  const progress = useMemo(() => {
    const map: Record<number, number> = {};
    for (const s of sessions) {
      const outs = outputs.filter((o) => o.session_id === s.id);
      if (outs.length === 0) continue;
      map[s.id] = Math.round((outs.filter((o) => o.is_done).length / outs.length) * 100);
    }
    return map;
  }, [sessions, outputs]);

  if (!participant) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold text-foreground">Las 8 sesiones</h1>
      <p className="mb-6 text-sm text-muted">12 semanas · S0 a S7. Haz clic en una sesión para trabajar sus dinámicas.</p>
      <Cronograma sessions={sessions} progress={progress} />
    </div>
  );
}
