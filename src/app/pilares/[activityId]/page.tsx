"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchAspirations, fetchSessionById, fetchSubmissionsByActivityIds } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { aspClasses, findAspiration, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "aspiration_name";
}
interface Entry extends Record<string, unknown> {
  id: string;
  aspiration_id?: number | null;
  ejemplo?: boolean;
}

// Tablero de solo lectura para actividades "tarjeta_estructurada" repetibles y NO por
// aspiración (p. ej. "Cierre: pilares y valores en acción"): una tarjeta por registro, pensada
// para proyectar en la plenaria mientras el grupo va completando los pilares — no agrupa por
// aspiración porque esta actividad no tiene una (ver AspiracionesFullscreenPage para esa).
export default function PilaresFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [unifiedText, setUnifiedText] = useState("");
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
      const content = subs.find((s) => s.aspiration_id === null)?.content as
        | { entries?: Entry[]; values?: Record<string, string> }
        | undefined;
      setEntries(content?.entries ?? []);
      setUnifiedText(content?.values?.unificada ?? "");
      setLoaded(true);
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`pilares-board-${activityId}`)
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
  // El primer campo hace de título de la tarjeta (p. ej. "Pilar organizacional"); el resto se
  // muestra como cuerpo — igual de genérico que el resto de campos de esta actividad, sin
  // asumir nombres de clave específicos.
  const titleField = fields[0];
  const bodyFields = fields.slice(1);
  // Los registros precargados (`ejemplo`) se proyectan aparte, como insignias compactas arriba
  // de todo — no se mezclan con la cuadrícula de registros reales del equipo.
  const exampleEntries = entries.filter((e) => e.ejemplo);
  const realEntries = entries.filter((e) => !e.ejemplo);

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
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
          {realEntries.length} {realEntries.length === 1 ? "registro" : "registros"}
        </span>
      </div>

      {exampleEntries.length > 0 && (
        <div className="mx-auto mt-6 max-w-[1500px]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">🧩 Ejemplos</p>
          <div className="flex flex-wrap gap-2">
            {exampleEntries.map((entry) => {
              const asp = findAspiration(aspirations, entry.aspiration_id ?? null);
              const cls = aspClasses(asp?.number);
              const titleValue = titleField ? (entry[titleField.key] as string) : undefined;
              const bodyValue = bodyFields[0] ? (entry[bodyFields[0].key] as string) : undefined;
              return (
                <div key={entry.id} className={`max-w-[260px] rounded-lg border px-3 py-2 ${cls.border} bg-white/[0.04]`}>
                  <p className={`text-xs font-bold ${cls.text}`}>{titleValue || "—"}</p>
                  {bodyValue && <p className="mt-0.5 line-clamp-2 text-[11px] italic text-white/60">{bodyValue}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {unifiedText && (
        <div className="mx-auto mt-6 max-w-[1500px] rounded-2xl border border-brand/30 bg-brand/[0.08] p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand">🌐 Estrategia corporativa unificada</p>
          <p className="text-lg leading-relaxed text-white">{unifiedText}</p>
        </div>
      )}

      <div className="mx-auto mt-8 max-w-[1500px]">
        {realEntries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 py-24 text-center">
            <span className="text-3xl">🏛️</span>
            <p className="text-sm text-white/40">Aún no hay registros en esta actividad.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {realEntries.map((entry) => {
              const asp = findAspiration(aspirations, entry.aspiration_id ?? null);
              const cls = aspClasses(asp?.number);
              return (
              <div key={entry.id} className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${asp ? `border-l-4 ${cls.border}` : ""}`}>
                {asp && (
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls.bgSoft} ${cls.text}`}>
                      Aspiración {asp.number} · {ARCHETYPE_LABEL[asp.number]}
                    </span>
                  </div>
                )}
                {titleField && (
                  <p className="mb-3 text-lg font-bold leading-snug text-brand">
                    {(entry[titleField.key] as string) || "—"}
                  </p>
                )}
                {bodyFields.map((f) => {
                  const value = entry[f.key] as string;
                  return (
                    <div key={f.key} className="mt-3 first:mt-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/30">{f.label}</p>
                      <p className="mt-0.5 text-sm leading-snug text-white/80">{value || "—"}</p>
                    </div>
                  );
                })}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
