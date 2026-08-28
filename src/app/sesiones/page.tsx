"use client";

import { useEffect, useMemo, useState } from "react";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { fetchOutputs, fetchSessions } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/feed";
import { isPresenter } from "@/lib/presenter";
import type { OutputRow, SessionRow } from "@/lib/types";
import Cronograma from "@/components/Cronograma";

export default function SesionesPage() {
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [outputs, setOutputs] = useState<OutputRow[]>([]);

  useEffect(() => {
    fetchSessions().then(setSessions).catch(console.error);
    fetchOutputs().then(setOutputs).catch(console.error);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("sesiones-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => {
        fetchSessions().then(setSessions).catch(console.error);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
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

  async function toggleSession(session: SessionRow, next: boolean) {
    await supabase.from("sessions").update({ is_enabled: next }).eq("id", session.id);
    setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, is_enabled: next } : s)));
    await logActivity({
      session_id: session.id,
      participant_id: participant!.id,
      event_type: next ? "sesion_habilitada" : "sesion_bloqueada",
      summary: `${participant!.name} ${next ? "habilitó" : "bloqueó"} la sesión ${session.code}`,
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold text-dark">Las 8 sesiones</h1>
      <p className="mb-6 text-sm text-muted">
        12 semanas · S0 a S7.{" "}
        {presenter ? "Como facilitador, puedes habilitar cada sesión." : "Las sesiones habilitadas por el facilitador están disponibles para trabajar."}
      </p>
      <Cronograma sessions={sessions} progress={progress} presenter={presenter} onToggleEnabled={toggleSession} />
    </div>
  );
}
