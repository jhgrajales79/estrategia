"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchSessionById } from "@/lib/data";
import { useSubmission, fetchLatestContent } from "@/lib/useSubmission";
import { axisColor } from "@/components/RadarChartView";
import BarChart from "@/components/charts/BarChart";
import { inputCls, DeleteButton, uid } from "@/components/activities/shared";
import type { ActivityRow, SessionRow } from "@/lib/types";

interface Candidate {
  id: string;
  text: string;
  author: string;
  slot: number;
  starred?: boolean;
}
interface Vote {
  participant_id: string;
  participant_name: string;
  candidate_id: string;
  points: number;
}
// Una idea homologada agrupa varias ideas crudas parecidas conservando cuáles eran (para no
// perder autoría ni votos): el texto unificado es editable, pero las ideas originales siguen
// existiendo tal cual dentro de `memberIds`.
interface HomologGroup {
  id: string;
  label: string;
  memberIds: string[];
}
interface Content extends Record<string, unknown> {
  candidates: Candidate[];
  votes: Vote[];
  homologatedGroups?: HomologGroup[];
}

const EMPTY: Content = { candidates: [], votes: [] };
const MEDALS = ["🥇", "🥈", "🥉"];

export default function HomologadoFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);

  useEffect(() => {
    fetchActivityById(Number(activityId)).then((a) => {
      setActivity(a);
      if (a) fetchSessionById(a.session_id).then(setSession).catch(console.error);
    });
  }, [activityId]);

  const { content, save, saving, updatedAt, loaded } = useSubmission<Content>(
    activity ?? ({ id: -1, config: {} } as ActivityRow),
    session,
    null,
    participant,
    EMPTY
  );

  if (!participant || !activity || !session || !loaded) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted">Cargando…</div>;
  }

  if (!presenter) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-muted">
        Solo el facilitador puede abrir el tablero homologado.
      </div>
    );
  }

  // Igual que en Crazy8.tsx: todos comparten una sola submission, así que cada mutación relee
  // la fila más reciente antes de guardar para no pisar cambios de alguien más (votos que
  // siguen entrando, ideas que se siguen escribiendo).
  async function withLatestContent(mutate: (latest: Content) => Content | null) {
    const latest = await fetchLatestContent<Content>(activity!.id, null, EMPTY);
    const next = mutate(latest);
    if (next) await save(next);
  }

  const ideas = content.candidates.filter((c) => c.text.trim());
  const groups = content.homologatedGroups ?? [];
  const groupedIds = new Set(groups.flatMap((g) => g.memberIds));
  const ungrouped = ideas.filter((c) => !groupedIds.has(c.id));
  const ideaById = new Map(ideas.map((c) => [c.id, c]));

  function votesFor(candidateId: string) {
    return content.votes.filter((v) => v.candidate_id === candidateId).reduce((a, v) => a + v.points, 0);
  }

  function createGroupFromIdea(candidateId: string) {
    const idea = ideaById.get(candidateId);
    if (!idea) return;
    withLatestContent((latest) => ({
      ...latest,
      homologatedGroups: [...(latest.homologatedGroups ?? []), { id: uid(), label: idea.text, memberIds: [candidateId] }],
    }));
  }

  function addToGroup(candidateId: string, groupId: string) {
    withLatestContent((latest) => ({
      ...latest,
      homologatedGroups: (latest.homologatedGroups ?? []).map((g) =>
        g.id === groupId && !g.memberIds.includes(candidateId) ? { ...g, memberIds: [...g.memberIds, candidateId] } : g
      ),
    }));
  }

  function handleAssign(candidateId: string, value: string) {
    if (!value) return;
    if (value === "__new__") createGroupFromIdea(candidateId);
    else addToGroup(candidateId, value);
  }

  function removeMember(groupId: string, candidateId: string) {
    withLatestContent((latest) => {
      const nextGroups = (latest.homologatedGroups ?? [])
        .map((g) => (g.id === groupId ? { ...g, memberIds: g.memberIds.filter((id) => id !== candidateId) } : g))
        .filter((g) => g.memberIds.length > 0);
      return { ...latest, homologatedGroups: nextGroups };
    });
  }

  function renameGroup(groupId: string, label: string) {
    withLatestContent((latest) => ({
      ...latest,
      homologatedGroups: (latest.homologatedGroups ?? []).map((g) => (g.id === groupId ? { ...g, label } : g)),
    }));
  }

  function deleteGroup(groupId: string) {
    withLatestContent((latest) => ({
      ...latest,
      homologatedGroups: (latest.homologatedGroups ?? []).filter((g) => g.id !== groupId),
    }));
  }

  // Escalafón: cada idea sin agrupar cuenta como su propia entrada, y cada grupo suma los
  // votos de todas las ideas que agrupó — así una idea muy votada nunca se "esconde" solo por
  // no haber sido homologada con otras.
  const ranking = [
    ...ungrouped.map((c) => ({ id: c.id, label: c.text, authors: [c.author], total: votesFor(c.id), members: 1 })),
    ...groups.map((g) => {
      const members = g.memberIds.map((id) => ideaById.get(id)).filter((c): c is Candidate => Boolean(c));
      return {
        id: g.id,
        label: g.label,
        authors: [...new Set(members.map((c) => c.author))],
        total: members.reduce((a, c) => a + votesFor(c.id), 0),
        members: members.length,
      };
    }),
  ].sort((a, b) => b.total - a.total);
  const top3 = ranking.filter((r) => r.total > 0).slice(0, 3);

  return (
    <div className="min-h-screen bg-background px-6 py-6">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto" priority />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-dark sm:text-2xl">🧩 Tablero homologado — {activity.title}</h1>
          <p className="text-sm text-muted">
            {session.code} · {session.name}
          </p>
        </div>
        {saving ? (
          <span className="text-xs text-muted">Guardando…</span>
        ) : updatedAt ? (
          <span className="text-xs text-muted">Guardado {new Date(updatedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
        ) : null}
      </div>

      <div className="mx-auto mt-6 max-w-[1400px] rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">🏆 Escalafón — posibles ideas ganadoras</h2>
        {top3.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay votos suficientes para armar el escalafón.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {top3.map((r, i) => (
              <div key={r.id} className="rounded-xl border-2 border-brand/40 bg-brand/5 p-3 text-center shadow-sm">
                <p className="text-2xl">{MEDALS[i]}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">&ldquo;{r.label}&rdquo;</p>
                <p className="text-xs text-muted">
                  {r.authors.join(", ")}
                  {r.members > 1 && ` · ${r.members} ideas homologadas`}
                </p>
                <p className="mt-1 text-sm font-bold text-brand-dark">{r.total} pts</p>
              </div>
            ))}
          </div>
        )}
        {ranking.length > 0 && (
          <div className="mt-4">
            <BarChart bars={ranking.map((r) => ({ label: r.label, value: r.total, colorClass: "bg-brand" }))} unit=" pts" />
          </div>
        )}
      </div>

      <div className="mx-auto mt-6 grid max-w-[1400px] gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Ideas sin agrupar</h2>
          <p className="mb-3 text-xs text-muted">Todas las ideas que escribió el equipo, tal como llegaron.</p>
          {ungrouped.length === 0 ? (
            <p className="text-sm text-muted">
              {ideas.length === 0 ? "Aún no hay ideas registradas." : "Todas las ideas ya quedaron homologadas 🎉"}
            </p>
          ) : (
            <div className="space-y-2">
              {ungrouped.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-black/[0.015] p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground" title={c.text}>
                      {c.text}
                    </p>
                    <p className="text-xs text-muted">
                      {c.author} · {votesFor(c.id)} pts
                    </p>
                  </div>
                  <select
                    className="shrink-0 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40"
                    value=""
                    onChange={(e) => handleAssign(c.id, e.target.value)}
                  >
                    <option value="" disabled>
                      Homologar…
                    </option>
                    <option value="__new__">🆕 Nuevo grupo</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        ➕ {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Ideas homologadas</h2>
          <p className="mb-3 text-xs text-muted">Ideas parecidas unificadas — conservan los votos de todas las que agrupan.</p>
          {groups.length === 0 ? (
            <p className="text-sm text-muted">Todavía no has homologado ninguna idea.</p>
          ) : (
            <div className="space-y-3">
              {groups.map((g, gi) => {
                const members = g.memberIds.map((id) => ideaById.get(id)).filter((c): c is Candidate => Boolean(c));
                const total = members.reduce((a, c) => a + votesFor(c.id), 0);
                return (
                  <div key={g.id} className="rounded-lg border-l-4 bg-black/[0.015] p-3" style={{ borderLeftColor: axisColor(gi) }}>
                    <div className="flex items-center gap-2">
                      <input
                        className={inputCls}
                        defaultValue={g.label}
                        onBlur={(e) => e.target.value.trim() && renameGroup(g.id, e.target.value.trim())}
                        placeholder="Idea unificada…"
                      />
                      <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand-dark">{total} pts</span>
                      <DeleteButton label="deshacer grupo" onConfirm={() => deleteGroup(g.id)} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {members.map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-1 text-xs text-foreground shadow-sm">
                          &ldquo;{c.text}&rdquo; <span className="text-muted">— {c.author}</span>
                          <button className="text-muted hover:text-red-600" title="Quitar del grupo" onClick={() => removeMember(g.id, c.id)}>
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
