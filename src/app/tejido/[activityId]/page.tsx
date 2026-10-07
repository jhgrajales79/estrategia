"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchSessionById, fetchSubmissionsByActivityIds } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import ConnectionsWebView from "@/components/ConnectionsWebView";
import type { ActivityRow, SessionRow } from "@/lib/types";

interface Thread {
  id: string;
  author: string;
  text: string;
}
interface Content extends Record<string, unknown> {
  threads: Thread[];
  media: string[];
}

// Tablero de solo lectura para "El tejido de conexiones": la misma telaraña de hilos, a tamaño
// grande, para proyectar durante el ejercicio en vivo sin competir con la pantalla de quien
// facilita.
export default function TejidoFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [content, setContent] = useState<Content>({ threads: [], media: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchActivityById(Number(activityId)).then((a) => {
      setActivity(a);
      if (a) fetchSessionById(a.session_id).then(setSession).catch(console.error);
    });
  }, [activityId]);

  useEffect(() => {
    async function load() {
      const subs = await fetchSubmissionsByActivityIds([Number(activityId)]);
      const shared = subs.find((s) => s.aspiration_id === null);
      setContent((shared?.content as Content | undefined) ?? { threads: [], media: [] });
      setLoaded(true);
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`tejido-board-${activityId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${activityId}` }, () => {
        load().catch(console.error);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activityId]);

  if (!participant || !activity || !session || !loaded) {
    return <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>;
  }

  if (!presenter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark px-4 text-center text-sm text-white/60">
        Solo el facilitador puede abrir este tablero.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark bg-[radial-gradient(circle_at_50%_0%,rgba(128,198,18,0.08),transparent_60%)] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[1200px] items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto brightness-0 invert" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{activity.title}</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
          {content.threads.length} {content.threads.length === 1 ? "hilo" : "hilos"}
        </span>
      </div>

      {/* ConnectionsWebView está pensado para fondo claro (texto oscuro, hilos en los colores de
          marca) — se proyecta dentro de un panel claro en vez de forzar sus colores a oscuro. */}
      <div className="mx-auto mt-10 max-w-[1200px] rounded-2xl bg-card p-8 shadow-2xl">
        <ConnectionsWebView threads={content.threads} large />
      </div>
    </div>
  );
}
