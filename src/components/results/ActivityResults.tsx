"use client";

import { useState } from "react";
import BarChart from "@/components/charts/BarChart";
import RadarChartView from "@/components/RadarChartView";
import IdeaCloudView from "@/components/IdeaCloudView";
import NotesBoardView from "@/components/NotesBoardView";
import { aspAbbrev, aspClasses, findAspiration } from "@/lib/aspirationStyle";
import type { ActivityRow, Aspiration } from "@/lib/types";

interface SubmissionLike {
  aspiration_id: number | null;
  content: Record<string, unknown>;
  updated_at: string;
}

function AspTag({ aspirations, id }: { aspirations: Aspiration[]; id: number | null }) {
  const abbrev = aspAbbrev(aspirations, id);
  const asp = findAspiration(aspirations, id);
  const cls = aspClasses(asp?.number);
  if (!abbrev) return null;
  return <span className={`mr-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${cls.bgSoft} ${cls.text}`}>{abbrev}</span>;
}

function Empty() {
  return <p className="text-sm text-muted">Sin resultados registrados todavía.</p>;
}

function MediaGrid({
  media,
  externalLink,
  externalLinkLabel,
  large = false,
}: {
  media: string[];
  externalLink: string;
  externalLinkLabel?: string;
  large?: boolean;
}) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  if (media.length === 0 && !externalLink) return null;
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        {media.map((url) => (
          <button
            key={url}
            className={`overflow-hidden rounded-md border border-border ${large ? "h-24 w-24" : "h-16 w-16"}`}
            title="Ampliar foto"
            onClick={() => setLightboxUrl(url)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Foto de la actividad" className="h-full w-full object-cover" />
          </button>
        ))}
        {externalLink && (
          <a href={externalLink} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">
            🔗 {externalLinkLabel || "Enlace externo"}
          </a>
        )}
      </div>
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-6"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
            onClick={() => setLightboxUrl(null)}
          >
            ✕ Cerrar
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Foto ampliada"
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function renderContent(activity: ActivityRow, content: Record<string, unknown>, aspirations: Aspiration[], large = false) {
  const config = activity.config as Record<string, unknown>;

  switch (activity.activity_type) {
    case "notas": {
      const categories = asArray<{ key: string; label: string }>(config.categories);
      const rawNotes = asArray<Record<string, unknown>>(content.notes);
      const media = asArray<string>(content.media);
      const externalLink = str(content.external_link);
      const externalLinkLabel = str(config.externalLinkLabel);
      if (rawNotes.length === 0 && media.length === 0 && !externalLink) return <Empty />;
      // Mismo tablero de post-its que ve el facilitador (y que se proyecta en /notas).
      const notes = rawNotes.map((n) => ({
        id: str(n.id),
        category: str(n.category),
        aspiration_id: (n.aspiration_id as number) ?? null,
        author: str(n.author),
        text: str(n.text),
        impact: n.impact as "alto" | "medio" | "bajo" | undefined,
        highlighted: Boolean(n.highlighted),
      }));
      return (
        <div>
          {rawNotes.length > 0 && <NotesBoardView categories={categories} notes={notes} aspirations={aspirations} large={large} />}
          <MediaGrid media={media} externalLink={externalLink} externalLinkLabel={externalLinkLabel} large={large} />
        </div>
      );
    }

    case "matriz_ponderada": {
      if (config.mode === "qspm") {
        const strategies = asArray<Record<string, unknown>>(content.strategies);
        const factors = asArray<Record<string, unknown>>(content.factors);
        const ratings = asRecord(content.ratings);
        if (strategies.length === 0) return <Empty />;
        const totals = strategies.map((s) => {
          const total = factors.reduce((acc, f) => {
            const row = asRecord(ratings[str(f.id)]);
            return acc + Number(f.peso ?? 0) * Number(row[str(s.id)] ?? 0);
          }, 0);
          return { label: str(s.name), value: Number(total.toFixed(2)) };
        });
        return <BarChart bars={totals.sort((a, b) => b.value - a.value).map((t) => ({ ...t, colorClass: "bg-brand" }))} />;
      }
      const rows = asArray<Record<string, unknown>>(content.rows);
      if (rows.length === 0) return <Empty />;
      const total = rows.reduce((a, r) => a + Number(r.peso ?? 0) * Number(r.calificacion ?? 0), 0);
      return (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>
                <AspTag aspirations={aspirations} id={(r.aspiration_id as number) ?? null} />
                {str(r.factor)}
              </span>
              <span className="text-muted">
                {str(r.peso)} × {str(r.calificacion)} = {(Number(r.peso ?? 0) * Number(r.calificacion ?? 0)).toFixed(2)}
              </span>
            </div>
          ))}
          <p className="pt-1 text-xs font-semibold text-foreground">Total: {total.toFixed(2)}</p>
        </div>
      );
    }

    case "matriz_cuadrantes": {
      const quadrants = asArray<{ key: string; label: string }>(config.quadrants);
      const cards = asArray<Record<string, unknown>>(content.cards);
      if (cards.length === 0) return <Empty />;
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {quadrants.map((q) => {
            const inQ = cards.filter((c) => c.quadrant === q.key);
            if (inQ.length === 0) return null;
            return (
              <div key={q.key}>
                <p className="mb-1 text-xs font-semibold text-muted">{q.label}</p>
                <ul className="space-y-1">
                  {inQ.map((c, i) => (
                    <li key={i} className="text-sm text-foreground">
                      {c.star ? "⭐ " : ""}
                      <AspTag aspirations={aspirations} id={(c.aspiration_id as number) ?? null} />
                      {str(c.text)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      );
    }

    case "rueda_evaluacion": {
      const items = asArray<Record<string, unknown>>(content.items);
      if (items.length === 0) return <Empty />;
      const scaleMax = Number(config.scaleMax ?? 5);
      return (
        <BarChart
          bars={items.map((it) => ({ label: str(it.label), value: Number(it.score ?? 0), colorClass: "bg-brand" }))}
          unit={`/${scaleMax}`}
        />
      );
    }

    case "votacion_fichas": {
      const candidates = asArray<Record<string, unknown>>(content.candidates);
      const votes = asArray<Record<string, unknown>>(content.votes);
      if (candidates.length === 0) return <Empty />;
      if (config.cloudView) {
        // Misma nube de ideas que ve el facilitador (y que se proyecta en /ideas).
        const ideas = candidates.map((c) => ({
          id: str(c.id),
          text: str(c.text),
          votes: votes.filter((v) => v.candidate_id === c.id).reduce((a, v) => a + Number(v.points ?? 0), 0),
        }));
        return (
          <div style={{ height: large ? 560 : 320 }}>
            <IdeaCloudView ideas={ideas} large={large} />
          </div>
        );
      }
      const totals = candidates
        .map((c) => ({
          label: str(c.text),
          value: votes.filter((v) => v.candidate_id === c.id).reduce((a, v) => a + Number(v.points ?? 0), 0),
        }))
        .sort((a, b) => b.value - a.value);
      return <BarChart bars={totals.map((t) => ({ ...t, colorClass: "bg-brand" }))} unit=" pts" />;
    }

    case "tarjeta_estructurada": {
      const fields = asArray<{ key: string; label: string }>(config.fields);
      if (config.repeatable) {
        const entries = asArray<Record<string, unknown>>(content.entries);
        if (entries.length === 0) return <Empty />;
        return (
          <div className="space-y-3">
            {entries.map((entry, i) => (
              <div key={i} className="rounded-md bg-black/[0.03] p-2 text-sm">
                <AspTag aspirations={aspirations} id={(entry.aspiration_id as number) ?? null} />
                {fields.map((f) => (
                  <div key={f.key}>
                    <span className="font-semibold text-muted">{f.label}: </span>
                    <span className="text-foreground">{str(entry[f.key]) || "—"}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      }
      const values = asRecord(content.values);
      const hasAny = fields.some((f) => str(values[f.key]));
      if (!hasAny) return <Empty />;
      return (
        <div className="space-y-1 text-sm">
          {fields.map((f) => (
            <div key={f.key}>
              <span className="font-semibold text-muted">{f.label}: </span>
              <span className="text-foreground">{str(values[f.key]) || "—"}</span>
            </div>
          ))}
        </div>
      );
    }

    case "mapa_estrategico": {
      const perspectives = asArray<{ key: string; label: string }>(config.perspectives);
      const cards = asArray<Record<string, unknown>>(content.cards);
      if (cards.length === 0) return <Empty />;
      return (
        <div className="space-y-2">
          {[...perspectives].reverse().map((p) => {
            const inP = cards.filter((c) => c.perspective === p.key);
            if (inP.length === 0) return null;
            return (
              <div key={p.key}>
                <p className="mb-1 text-xs font-semibold text-muted">{p.label}</p>
                <ul className="space-y-1">
                  {inP.map((c, i) => (
                    <li key={i} className="text-sm text-foreground">
                      <AspTag aspirations={aspirations} id={(c.aspiration_id as number) ?? null} />
                      {str(c.text)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      );
    }

    case "tablero_proyectos": {
      const fields = asArray<{ key: string; label: string }>(config.fields);
      const projects = asArray<Record<string, unknown>>(content.projects);
      if (projects.length === 0) return <Empty />;
      return (
        <div className="space-y-3">
          {projects.map((p, i) => (
            <div key={i} className="rounded-md bg-black/[0.03] p-2 text-sm">
              {fields.map((f) => (
                <div key={f.key}>
                  <span className="font-semibold text-muted">{f.label}: </span>
                  <span className="text-foreground">{str(p[f.key]) || "—"}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }

    case "ficha_kpi": {
      const kpis = asArray<Record<string, unknown>>(content.kpis);
      if (kpis.length === 0) return <Empty />;
      return (
        <div className="space-y-2">
          {kpis.map((k, i) => (
            <div key={i} className="rounded-md bg-black/[0.03] p-2 text-sm">
              <AspTag aspirations={aspirations} id={(k.aspiration_id as number) ?? null} />
              <span className="font-semibold text-foreground">{str(k.nombre)}</span>
              <p className="text-xs text-muted">
                {str(k.formula)} · línea base {str(k.linea_base)} · meta 2027 {str(k.meta_2027)} · {str(k.frecuencia)} ·{" "}
                {str(k.responsable)}
              </p>
            </div>
          ))}
        </div>
      );
    }

    case "radar_contexto": {
      const axes = asArray<{ key: string; label: string }>(config.axes);
      const rings = asArray<string>(config.rings);
      const rawSignals = asArray<Record<string, unknown>>(content.signals);
      const votes = asArray<Record<string, unknown>>(content.votes);
      if (rawSignals.length === 0) return <Empty />;
      const signals = rawSignals.map((s) => ({
        id: str(s.id),
        axis: str(s.axis),
        ring: Number(s.ring ?? 0),
        round: Number(s.round ?? 0),
        text: str(s.text),
        author: str(s.author),
        aspiration_id: (s.aspiration_id as number) ?? null,
      }));
      const voteTotal: Record<string, number> = {};
      for (const v of votes) {
        const id = str(v.signal_id);
        voteTotal[id] = (voteTotal[id] ?? 0) + Number(v.points ?? 0);
      }
      const winnerByAxis: Record<string, (typeof signals)[number] | undefined> = {};
      for (const a of axes) {
        const inAxis = signals.filter((s) => s.axis === a.key);
        let best: (typeof signals)[number] | undefined;
        let bestVotes = -1;
        for (const s of inAxis) {
          const v = voteTotal[s.id] ?? 0;
          if (v > bestVotes) {
            best = s;
            bestVotes = v;
          }
        }
        winnerByAxis[a.key] = bestVotes > 0 ? best : undefined;
      }
      return (
        <div className="flex flex-col items-center gap-4">
          {/* Mismo radar (poligono de la mas votada por dimension) que ve el facilitador. */}
          <RadarChartView axes={axes} winnerByAxis={winnerByAxis} voteTotal={voteTotal} size={large ? 560 : 340} />
          <div className="w-full space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Todas las señales</p>
            {axes.map((a) => {
              const inAxis = signals.filter((s) => s.axis === a.key);
              if (inAxis.length === 0) return null;
              return (
                <div key={a.key}>
                  <p className="mb-1 text-xs font-semibold text-muted">{a.label}</p>
                  <ul className="space-y-1">
                    {inAxis
                      .sort((x, y) => (voteTotal[y.id] ?? 0) - (voteTotal[x.id] ?? 0))
                      .map((s) => (
                        <li key={s.id} className="text-sm text-foreground">
                          {s.text} <span className="text-xs text-muted">· {rings[s.ring] ?? ""} · {voteTotal[s.id] ?? 0} votos</span>
                        </li>
                      ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    default:
      return <Empty />;
  }
}

export function ResultsBody({
  activity,
  submissions,
  aspirations,
  large = false,
}: {
  activity: ActivityRow;
  submissions: SubmissionLike[];
  aspirations: Aspiration[];
  large?: boolean;
}) {
  const hasAny = submissions.length > 0;
  return (
    <div className="space-y-4">
      {!hasAny && <Empty />}
      {submissions.map((s, i) => {
        const perAspiration = Boolean((activity.config as Record<string, unknown>).perAspiration);
        const asp = perAspiration ? findAspiration(aspirations, s.aspiration_id) : null;
        return (
          <div key={i}>
            {perAspiration && asp && <p className={`mb-2 text-xs font-bold ${aspClasses(asp.number).text}`}>Aspiración {asp.number}</p>}
            {renderContent(activity, s.content, aspirations, large)}
          </div>
        );
      })}
    </div>
  );
}

export default function ActivityResults({
  activity,
  submissions,
  aspirations,
}: {
  activity: ActivityRow;
  submissions: SubmissionLike[];
  aspirations: Aspiration[];
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const hasAny = submissions.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-3">
        <button className="flex flex-1 items-center justify-between gap-3 text-left" onClick={() => setOpen((o) => !o)}>
          <span className="text-sm font-semibold text-foreground">{activity.title}</span>
          <span className="flex items-center gap-2">
            {!hasAny && <span className="text-xs text-muted">sin datos</span>}
            <span className="text-muted">{open ? "▲" : "▼"}</span>
          </span>
        </button>
        {hasAny && (
          <button
            className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-black/5"
            title="Ampliar para ver mejor"
            onClick={() => setExpanded(true)}
          >
            ⛶ Ampliar
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-border px-4 py-4">
          <ResultsBody activity={activity} submissions={submissions} aspirations={aspirations} />
        </div>
      )}

      {expanded && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background/98 p-6">
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{activity.title}</h2>
              <button className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={() => setExpanded(false)}>
                ✕ Cerrar
              </button>
            </div>
            <ResultsBody activity={activity} submissions={submissions} aspirations={aspirations} large />
          </div>
        </div>
      )}
    </div>
  );
}
