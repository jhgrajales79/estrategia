"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchAspirations, fetchSessionById, fetchSubmissionsByActivityIds } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "aspiration_name";
}

// Tablero de solo lectura para actividades "tarjeta_estructurada" no repetibles y por aspiración
// (p. ej. el Taller de ajuste de aspiraciones): una tarjeta por aspiración con su resultado
// destacado — pensado para proyectar en la plenaria de convergencia, donde el grupo ratifica lo
// que cada subgrupo propuso sin tener que abrir la vista de edición de nadie.
export default function AspiracionesFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [contentByAsp, setContentByAsp] = useState<Map<number, Record<string, unknown>>>(new Map());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
    fetchActivityById(Number(activityId)).then((a) => {
      setActivity(a);
      if (a) fetchSessionById(a.session_id).then(setSession).catch(console.error);
    });
  }, [activityId]);

  useEffect(() => {
    async function load() {
      const subs = await fetchSubmissionsByActivityIds([Number(activityId)]);
      const next = new Map<number, Record<string, unknown>>();
      for (const s of subs) {
        if (s.aspiration_id !== null) next.set(s.aspiration_id, s.content);
      }
      setContentByAsp(next);
      setLoaded(true);
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`aspiraciones-board-${activityId}`)
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

  const fields = (activity.config.fields as FieldDef[]) ?? [];
  // Qué campo se muestra grande y destacado por aspiración — el resultado que importa proyectar
  // (p. ej. el enunciado ratificado). Sin esta config, se toma el último campo como el más
  // probable "resultado final" del formulario.
  const highlightKey = (activity.config.boardHighlightField as string) ?? fields[fields.length - 1]?.key;
  const supportFields = fields.filter((f) => f.key !== highlightKey && f.type !== "aspiration_name");

  return (
    <div className="min-h-screen bg-dark bg-[radial-gradient(circle_at_50%_0%,rgba(128,198,18,0.08),transparent_60%)] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto brightness-0 invert" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{activity.title}</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name}
          </p>
        </div>
      </div>

      <div className="mx-auto mt-8 grid max-w-[1500px] gap-5 md:grid-cols-3">
        {aspirations.map((a) => {
          const cls = aspClasses(a.number);
          const values = (contentByAsp.get(a.id) as { values?: Record<string, string> } | undefined)?.values ?? {};
          const highlightValue = highlightKey ? values[highlightKey] : undefined;
          return (
            <div key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cls.bg}`} />
                <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
                </p>
              </div>
              <p className="mb-5 text-sm text-white/60">{a.name}</p>

              <div className={`min-h-[7rem] rounded-xl border ${cls.border} bg-white/[0.04] p-4`}>
                {highlightValue ? (
                  <p className="text-lg font-semibold leading-snug text-white">{highlightValue}</p>
                ) : (
                  <p className="text-sm italic text-white/30">Aún sin definir.</p>
                )}
              </div>

              {supportFields.length > 0 && (
                <div className="mt-4 space-y-3">
                  {supportFields.map((f) => (
                    <div key={f.key}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/30">{f.label}</p>
                      <p className="mt-0.5 text-sm text-white/70">{values[f.key] || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
