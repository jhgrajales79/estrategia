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
interface Entry extends Record<string, unknown> {
  id: string;
  aspiration_id?: number | null;
  meta_id?: string;
}
interface MetaCandidate {
  id: string;
  text: string;
}

// Tablero de solo lectura para actividades "tarjeta_estructurada" repetibles Y por aspiración
// (p. ej. "De aspiración a objetivos SMART"): 3 columnas, una por aspiración, cada una con todos
// los registros que ese subgrupo lleva hechos — a diferencia de /aspiraciones (no repetible, un
// solo resultado por aspiración) y de /pilares (repetible pero sin aspiración).
export default function ObjetivosFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [entriesByAsp, setEntriesByAsp] = useState<Map<number, Entry[]>>(new Map());
  const [metas, setMetas] = useState<MetaCandidate[]>([]);
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
      const next = new Map<number, Entry[]>();
      for (const s of subs) {
        if (s.aspiration_id === null) continue;
        const entries = (s.content as { entries?: Entry[] } | null)?.entries ?? [];
        next.set(s.aspiration_id, entries);
      }
      setEntriesByAsp(next);
      setLoaded(true);
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`objetivos-board-${activityId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${activityId}` }, () => {
        load().catch(console.error);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activityId]);

  // Metas de la Subasta (config.metasFrom), para mostrar a qué meta responde cada objetivo —
  // mismo patrón de lectura en vivo que usa TarjetaEstructurada.tsx al crear los registros.
  useEffect(() => {
    const metasFrom = activity?.config.metasFrom as number | undefined;
    if (!metasFrom) return;
    let cancelled = false;
    async function loadMetas() {
      const { data } = await supabase.from("submissions").select("content").eq("activity_id", metasFrom!).is("aspiration_id", null).maybeSingle();
      if (cancelled) return;
      const candidates = (data?.content as { candidates?: MetaCandidate[] } | null)?.candidates ?? [];
      setMetas(candidates);
    }
    loadMetas();
    const channel = supabase
      .channel(`objetivos-board-metas-${metasFrom}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${metasFrom}` }, () => loadMetas())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activity]);

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
  const displayFields = fields.filter((f) => f.type !== "aspiration_name");
  const totalEntries = Array.from(entriesByAsp.values()).reduce((a, list) => a + list.length, 0);

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
          {totalEntries} {totalEntries === 1 ? "objetivo" : "objetivos"}
        </span>
      </div>

      <div className="mx-auto mt-8 grid max-w-[1500px] gap-5 md:grid-cols-3">
        {aspirations.map((a) => {
          const cls = aspClasses(a.number);
          const entries = entriesByAsp.get(a.id) ?? [];
          return (
            <div key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cls.bg}`} />
                <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
                </p>
                <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/60">{entries.length}</span>
              </div>

              {entries.length === 0 ? (
                <p className="py-10 text-center text-sm italic text-white/30">Aún sin objetivos.</p>
              ) : (
                <div className="space-y-3">
                  {entries.map((entry) => {
                    const meta = entry.meta_id ? metas.find((m) => m.id === entry.meta_id) : undefined;
                    return (
                      <div key={entry.id} className={`rounded-xl border ${cls.border} bg-white/[0.04] p-3.5`}>
                        {meta && (
                          <p className="mb-2 rounded-md bg-black/20 px-2 py-1 text-[11px] text-white/60">
                            🏷️ Meta: <span className="text-white/80">{meta.text}</span>
                          </p>
                        )}
                        {displayFields.map((f) => {
                          const value = entry[f.key] as string;
                          return (
                            <div key={f.key} className="mt-2 first:mt-0">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/30">{f.label}</p>
                              <p className="mt-0.5 text-sm leading-snug text-white/85">{value || "—"}</p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
