"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchAspirations, fetchSessionById } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import IEMatrixGrid, { ieGroup } from "@/components/charts/IEMatrixGrid";
import { ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";

interface SourceRow {
  peso: number;
  calificacion: number;
  aspiration_id: number | null;
}
interface Note {
  id: string;
  text: string;
  author: string;
}
interface Content extends Record<string, unknown> {
  notes: Note[];
}

const GROUP_LABEL: Record<string, string> = {
  crecer: "Crecer y construir",
  mantener: "Mantener y sostener",
  cosechar: "Cosechar o desinvertir",
};

// Mismo cruce de colores que aspClasses (azul Protectora <-> aspiración 3, verde Especialista <->
// aspiración 2) pero en variantes "fill-*" para usarlas dentro del SVG del plano.
function dotFillClass(number: number | undefined) {
  if (number === 1) return "fill-asp-1";
  if (number === 2) return "fill-asp-3";
  if (number === 3) return "fill-asp-2";
  return "fill-muted";
}

function total(rows: SourceRow[], aspirationId: number) {
  return rows.filter((r) => r.aspiration_id === aspirationId).reduce((a, r) => a + (Number(r.peso) || 0) * (Number(r.calificacion) || 0), 0);
}

export default function MatrizIEFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [efiRows, setEfiRows] = useState<SourceRow[]>([]);
  const [efeRows, setEfeRows] = useState<SourceRow[]>([]);
  const [notesByAsp, setNotesByAsp] = useState<Record<number, Note[]>>({});
  const [size, setSize] = useState(420);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
    fetchActivityById(Number(activityId)).then((a) => {
      setActivity(a);
      if (a) fetchSessionById(a.session_id).then(setSession).catch(console.error);
    });
  }, [activityId]);

  useEffect(() => {
    function computeSize() {
      setSize(Math.round(Math.min(window.innerWidth - 64, 480)));
    }
    computeSize();
    window.addEventListener("resize", computeSize);
    return () => window.removeEventListener("resize", computeSize);
  }, []);

  useEffect(() => {
    if (!activity) return;
    const [efiId, efeId] = (activity.config.inputsFrom as number[]) ?? [];
    async function load() {
      const [efi, efe, own] = await Promise.all([
        supabase.from("submissions").select("content").eq("activity_id", efiId),
        supabase.from("submissions").select("content").eq("activity_id", efeId),
        supabase.from("submissions").select("aspiration_id, content").eq("activity_id", Number(activityId)),
      ]);
      setEfiRows((efi.data ?? []).flatMap((s) => ((s.content as { rows?: SourceRow[] } | null)?.rows ?? [])));
      setEfeRows((efe.data ?? []).flatMap((s) => ((s.content as { rows?: SourceRow[] } | null)?.rows ?? [])));
      const byAsp: Record<number, Note[]> = {};
      for (const row of own.data ?? []) {
        if (row.aspiration_id === null) continue;
        byAsp[row.aspiration_id] = (row.content as Content | null)?.notes ?? [];
      }
      setNotesByAsp(byAsp);
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`matrizie-board-${activityId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${efiId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${efeId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${activityId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activity, activityId]);

  if (!participant || !activity || !session) {
    return <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>;
  }
  if (!presenter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark px-4 text-center text-sm text-white/60">
        Solo el facilitador puede abrir este tablero.
      </div>
    );
  }

  const points = aspirations
    .map((a) => {
      const efiTotal = total(efiRows, a.id);
      const efeTotal = total(efeRows, a.id);
      if (efiTotal <= 0 || efeTotal <= 0) return null;
      return { x: efiTotal, y: efeTotal, colorClass: dotFillClass(a.number), label: `Asp. ${a.number}`, aspiration: a, efiTotal, efeTotal };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

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
      </div>

      <div className="mx-auto mt-10 flex max-w-[1200px] flex-col items-center gap-8 md:flex-row md:items-start md:justify-center">
        <div className="rounded-2xl bg-card p-6 shadow-2xl">
          <IEMatrixGrid points={points} size={size} />
        </div>
        <div className="w-full max-w-lg shrink-0 space-y-3">
          {aspirations.map((a) => {
            const efiTotal = total(efiRows, a.id);
            const efeTotal = total(efeRows, a.id);
            const hasData = efiTotal > 0 && efeTotal > 0;
            const group = hasData ? ieGroup(efiTotal, efeTotal) : null;
            const notes = notesByAsp[a.id] ?? [];
            return (
              <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">
                    Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
                  </p>
                  {hasData && (
                    <span className="shrink-0 rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-dark">{GROUP_LABEL[group!]}</span>
                  )}
                </div>
                {hasData ? (
                  <p className="mt-1 text-xs text-white/50">
                    EFI {efiTotal.toFixed(2)} · EFE {efeTotal.toFixed(2)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-white/40">Sin totales EFI/EFE aún.</p>
                )}
                {notes.length > 0 && (
                  <div className="mt-2 max-h-28 space-y-1 overflow-y-auto border-t border-white/10 pt-2">
                    {notes.map((n) => (
                      <p key={n.id} className="text-xs text-white/50">
                        <span className="font-semibold text-white/80">{n.author}:</span> {n.text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
