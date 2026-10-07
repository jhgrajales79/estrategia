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
  type: "text" | "textarea";
}
interface Project extends Record<string, string> {
  id: string;
}

// Tablero de solo lectura, genérico, para cualquier actividad "tablero_proyectos"
// (config.fields define qué columnas mostrar) — con o sin perAspiration. Usado hoy por
// "De objetivo a proyecto estratégico" (S6 id31, perAspiration), pero no asume esos campos
// específicos: solo recorre config.fields, igual que lo hace el propio TableroProyectos.tsx.
export default function ProyectosFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [projectsByAsp, setProjectsByAsp] = useState<Map<number | null, Project[]>>(new Map());
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
      const next = new Map<number | null, Project[]>();
      for (const s of subs) {
        const projects = (s.content as { projects?: Project[] } | null)?.projects ?? [];
        next.set(s.aspiration_id, projects);
      }
      setProjectsByAsp(next);
      setLoaded(true);
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`proyectos-board-${activityId}`)
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
  const titleField = fields[0];
  const bodyFields = fields.slice(1);
  const perAspiration = Boolean(activity.config.perAspiration);
  const totalProjects = Array.from(projectsByAsp.values()).reduce((a, list) => a + list.length, 0);

  function ProjectCard({ p, border }: { p: Project; border: string }) {
    return (
      <div className={`rounded-xl border ${border} bg-white/[0.04] p-3.5`}>
        {titleField && <p className="text-base font-bold leading-snug text-white">{p[titleField.key] || "—"}</p>}
        {bodyFields.map((f) => (
          <div key={f.key} className="mt-2 first:mt-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/30">{f.label}</p>
            <p className="mt-0.5 text-sm leading-snug text-white/80">{p[f.key] || "—"}</p>
          </div>
        ))}
      </div>
    );
  }

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
          {totalProjects} {totalProjects === 1 ? "proyecto" : "proyectos"}
        </span>
      </div>

      <div className="mx-auto mt-8 max-w-[1500px]">
        {perAspiration ? (
          <div className="grid gap-5 md:grid-cols-3">
            {aspirations.map((a) => {
              const cls = aspClasses(a.number);
              const projects = projectsByAsp.get(a.id) ?? [];
              return (
                <div key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cls.bg}`} />
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                      Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
                    </p>
                    <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/60">{projects.length}</span>
                  </div>
                  {projects.length === 0 ? (
                    <p className="py-10 text-center text-sm italic text-white/30">Aún sin proyectos.</p>
                  ) : (
                    <div className="space-y-3">
                      {projects.map((p) => (
                        <ProjectCard key={p.id} p={p} border={cls.border} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {(projectsByAsp.get(null) ?? []).map((p) => (
              <ProjectCard key={p.id} p={p} border="border-white/10" />
            ))}
            {(projectsByAsp.get(null) ?? []).length === 0 && (
              <p className="py-10 text-center text-sm italic text-white/30">Aún no hay proyectos registrados.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
