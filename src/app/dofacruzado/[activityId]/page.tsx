"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchAspirations, fetchSessionById, fetchSubmissionsByActivityIds } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";

interface SourceFactor {
  id: string;
  factor: string;
  category: "fortaleza" | "debilidad" | "oportunidad" | "amenaza";
}
interface Selection {
  id: string;
  quadrant: "FO" | "DO" | "FA" | "DA";
  factorAId: string;
  factorBId: string;
  note?: string;
  custom?: { textA: string; textB: string };
}
interface Content extends Record<string, unknown> {
  selections: Selection[];
}

const QUADRANT_LABEL: Record<Selection["quadrant"], string> = {
  FO: "FO — Fortalezas + Oportunidades",
  DO: "DO — Debilidades + Oportunidades",
  FA: "FA — Fortalezas + Amenazas",
  DA: "DA — Debilidades + Amenazas",
};

// Tablero de solo lectura para "Tres DOFA cruzados": los cruces que cada aspiración marcó como
// válidos (generados automáticamente desde EFI × EFE, o agregados a mano), agrupados por
// cuadrante — con el texto real de cada factor resuelto desde la Matriz EFI/EFE de esa
// aspiración.
export default function DofaCruzadoFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [selectionsByAsp, setSelectionsByAsp] = useState<Map<number, Selection[]>>(new Map());
  const [factorsByAsp, setFactorsByAsp] = useState<Map<number, Map<string, string>>>(new Map());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
    fetchActivityById(Number(activityId)).then((a) => {
      setActivity(a);
      if (a) fetchSessionById(a.session_id).then(setSession).catch(console.error);
    });
  }, [activityId]);

  useEffect(() => {
    if (!activity) return;
    const efiFrom = activity.config.efiFrom as number;
    const efeFrom = activity.config.efeFrom as number;
    async function load() {
      const subs = await fetchSubmissionsByActivityIds([Number(activityId)]);
      const nextSel = new Map<number, Selection[]>();
      for (const s of subs) {
        if (s.aspiration_id === null) continue;
        nextSel.set(s.aspiration_id, (s.content as Content | null)?.selections ?? []);
      }
      setSelectionsByAsp(nextSel);

      const nextFactors = new Map<number, Map<string, string>>();
      for (const asp of aspirations) {
        const [efi, efe] = await Promise.all([
          supabase.from("submissions").select("content").eq("activity_id", efiFrom).eq("aspiration_id", asp.id).maybeSingle(),
          supabase.from("submissions").select("content").eq("activity_id", efeFrom).eq("aspiration_id", asp.id).maybeSingle(),
        ]);
        const rows: SourceFactor[] = [
          ...(((efi.data?.content as { rows?: SourceFactor[] } | null)?.rows) ?? []),
          ...(((efe.data?.content as { rows?: SourceFactor[] } | null)?.rows) ?? []),
        ];
        nextFactors.set(asp.id, new Map(rows.map((r) => [r.id, r.factor])));
      }
      setFactorsByAsp(nextFactors);
      setLoaded(true);
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`dofacruzado-board-${activityId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${activityId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, activityId, aspirations.length]);

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

  const totalSelected = Array.from(selectionsByAsp.values()).reduce((a, list) => a + list.length, 0);

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
          {totalSelected} {totalSelected === 1 ? "cruce marcado" : "cruces marcados"}
        </span>
      </div>

      <div className="mx-auto mt-8 grid max-w-[1500px] gap-5 md:grid-cols-3">
        {aspirations.map((a) => {
          const cls = aspClasses(a.number);
          const selections = selectionsByAsp.get(a.id) ?? [];
          const factorText = factorsByAsp.get(a.id) ?? new Map();
          return (
            <div key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cls.bg}`} />
                <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
                </p>
                <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/60">{selections.length}</span>
              </div>
              {selections.length === 0 ? (
                <p className="py-10 text-center text-sm italic text-white/30">Aún sin cruces marcados.</p>
              ) : (
                (["FO", "DO", "FA", "DA"] as const).map((q) => {
                  const inQuadrant = selections.filter((s) => s.quadrant === q);
                  if (inQuadrant.length === 0) return null;
                  return (
                    <div key={q} className="mt-3 first:mt-0">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/35">{QUADRANT_LABEL[q]}</p>
                      <div className="space-y-2">
                        {inQuadrant.map((s) => {
                          const textA = s.custom ? s.custom.textA : factorText.get(s.factorAId) ?? "—";
                          const textB = s.custom ? s.custom.textB : factorText.get(s.factorBId) ?? "—";
                          return (
                            <div key={s.id} className={`rounded-xl border ${cls.border} bg-white/[0.04] p-3`}>
                              <p className="text-sm leading-snug text-white">
                                <b>{textA}</b> + <b>{textB}</b>
                                {s.custom && (
                                  <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-white/50">
                                    personalizada
                                  </span>
                                )}
                              </p>
                              {s.note && <p className="mt-1 text-xs italic text-white/60">{s.note}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
