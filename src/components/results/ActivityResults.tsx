"use client";

import { useState } from "react";
import BarChart from "@/components/charts/BarChart";
import IdeaCloudView from "@/components/IdeaCloudView";
import NotesBoardView from "@/components/NotesBoardView";
import ConnectionsWebView from "@/components/ConnectionsWebView";
import RadarContextoResults from "@/components/results/RadarContextoResults";
import { axisColor } from "@/components/RadarChartView";
import { Avatar } from "@/components/activities/shared";
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
  return (
    <div className="flex flex-col items-center gap-1.5 py-6 text-center">
      <span className="text-xl opacity-40">🗒️</span>
      <p className="text-sm text-muted">Sin resultados registrados todavía.</p>
    </div>
  );
}

export const ACTIVITY_TYPE_ICON: Record<string, string> = {
  tejido_conexiones: "🧶",
  crazy8: "⚡",
  compromiso_personal: "✍️",
  notas: "🗒️",
  notas_matriz: "🧩",
  matriz_ponderada: "⚖️",
  matriz_cuadrantes: "🧭",
  rueda_evaluacion: "🎡",
  votacion_fichas: "🗳️",
  tarjeta_estructurada: "🗂️",
  mapa_estrategico: "🗺️",
  tablero_proyectos: "📁",
  ficha_kpi: "📌",
  radar_contexto: "📡",
};

// Cálculo aproximado (mejor esfuerzo) de "cuántos aportes" tiene una actividad, para mostrar
// un contador junto al título sin tener que abrirla. Cada tipo guarda su colección bajo una
// clave distinta; si no se reconoce el tipo o no hay nada, simplemente no se muestra número.
const ENTRY_KEY_BY_TYPE: Record<string, string> = {
  tejido_conexiones: "threads",
  compromiso_personal: "commitments",
  notas: "notes",
  notas_matriz: "notes",
  matriz_cuadrantes: "cards",
  rueda_evaluacion: "items",
  votacion_fichas: "candidates",
  mapa_estrategico: "cards",
  tablero_proyectos: "projects",
  ficha_kpi: "kpis",
  radar_contexto: "signals",
};

function countEntries(activity: ActivityRow, submissions: SubmissionLike[]): number {
  const key: string | undefined = ENTRY_KEY_BY_TYPE[activity.activity_type];
  if (activity.activity_type === "crazy8") {
    return submissions.reduce((a, s) => a + asArray<Record<string, unknown>>(s.content.candidates).filter((c) => c.starred).length, 0);
  }
  if (activity.activity_type === "matriz_ponderada") {
    const cfg = activity.config as Record<string, unknown>;
    const k = cfg.mode === "qspm" ? "strategies" : "rows";
    return submissions.reduce((a, s) => a + asArray(s.content[k]).length, 0);
  }
  if (activity.activity_type === "tarjeta_estructurada") {
    const cfg = activity.config as Record<string, unknown>;
    if (cfg.repeatable) return submissions.reduce((a, s) => a + asArray(s.content.entries).length, 0);
    const fields = asArray<{ key: string }>(cfg.fields);
    return submissions.filter((s) => fields.some((f) => str(asRecord(s.content.values)[f.key]))).length;
  }
  if (!key) return 0;
  return submissions.reduce((a, s) => a + asArray(s.content[key]).length, 0);
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

// Grilla de definición (label arriba en mayúscula pequeña, valor abajo) en vez de líneas
// apiladas "Label: valor" — más fácil de escanear con varios campos por tarjeta.
function FieldGrid({ fields, values }: { fields: { key: string; label: string }[]; values: Record<string, unknown> }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
      {fields.map((f) => (
        <div key={f.key} className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{f.label}</p>
          <p className="truncate text-sm text-foreground" title={str(values[f.key])}>
            {str(values[f.key]) || "—"}
          </p>
        </div>
      ))}
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
    case "tejido_conexiones": {
      const rawThreads = asArray<Record<string, unknown>>(content.threads);
      const media = asArray<string>(content.media);
      const externalLink = str(content.external_link);
      const externalLinkLabel = str(config.externalLinkLabel);
      if (rawThreads.length === 0 && media.length === 0 && !externalLink) return <Empty />;
      const threads = rawThreads.map((t) => ({ id: str(t.id), author: str(t.author), text: str(t.text) }));
      return (
        <div>
          {rawThreads.length > 0 && <ConnectionsWebView threads={threads} large={large} />}
          <MediaGrid media={media} externalLink={externalLink} externalLinkLabel={externalLinkLabel} large={large} />
        </div>
      );
    }

    case "crazy8": {
      const candidates = asArray<Record<string, unknown>>(content.candidates);
      const votes = asArray<Record<string, unknown>>(content.votes);
      const shortlisted = candidates.filter((c) => c.starred && str(c.text));
      if (shortlisted.length === 0) return <Empty />;
      const ideas = shortlisted.map((c) => ({
        id: str(c.id),
        text: str(c.text),
        author: str(c.author),
        votes: votes.filter((v) => v.candidate_id === c.id).reduce((a, v) => a + Number(v.points ?? 0), 0),
      }));
      const topIds = [...ideas]
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 3)
        .filter((i) => i.votes > 0)
        .map((i) => i.id);
      return (
        <div style={{ height: large ? 480 : 300 }}>
          <IdeaCloudView ideas={ideas} large={large} topIds={topIds} />
        </div>
      );
    }

    case "compromiso_personal": {
      const commitments = asArray<Record<string, unknown>>(content.commitments);
      if (commitments.length === 0) return <Empty />;
      return (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {commitments.map((c, i) => {
            const asp = findAspiration(aspirations, (c.aspiration_id as number) ?? null);
            return (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                <Avatar name={str(c.author)} bgClass={aspClasses(asp?.number).bg} isFacilitador={c.role === "facilitador"} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{str(c.author)}</p>
                  <p className="mt-0.5 text-sm italic text-muted">&ldquo;{str(c.text)}&rdquo;</p>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

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

    case "notas_matriz": {
      const categories = asArray<{ key: string; label: string }>(config.categories);
      const rawNotes = asArray<Record<string, unknown>>(content.notes);
      const externalLink = str(content.external_link);
      const externalLinkLabel = str(config.externalLinkLabel);
      if (rawNotes.length === 0 && !externalLink) return <Empty />;
      // Mismo tablero de post-its que "notas", pero la aspiración viene en cada nota
      // (fila de la matriz) en vez de en la submission.
      const notes = rawNotes.map((n) => ({
        id: str(n.id),
        category: str(n.category),
        aspiration_id: (n.aspiration_id as number) ?? null,
        author: str(n.author),
        text: str(n.text),
        impact: n.impact as "alto" | "medio" | "bajo" | undefined,
      }));
      return (
        <div>
          {rawNotes.length > 0 && <NotesBoardView categories={categories} notes={notes} aspirations={aspirations} large={large} />}
          <MediaGrid media={[]} externalLink={externalLink} externalLinkLabel={externalLinkLabel} large={large} />
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
      const withScore = rows.map((r) => {
        const peso = Number(r.peso ?? 0);
        const calificacion = Number(r.calificacion ?? 0);
        return {
          factor: str(r.factor),
          aspiration_id: (r.aspiration_id as number) ?? null,
          peso,
          calificacion,
          contrib: peso * calificacion,
        };
      });
      const total = withScore.reduce((a, r) => a + r.contrib, 0);
      const maxContrib = Math.max(0.0001, ...withScore.map((r) => r.contrib));
      const interpretHint = str(config.interpretHint);
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            {[...withScore]
              .sort((a, b) => b.contrib - a.contrib)
              .map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="flex min-w-0 flex-1 items-center gap-1 truncate">
                    <AspTag aspirations={aspirations} id={r.aspiration_id} />
                    {r.factor}
                  </span>
                  <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-black/5">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(r.contrib / maxContrib) * 100}%` }} />
                  </div>
                  <span className="w-28 shrink-0 text-right text-xs text-muted">
                    {r.peso} × {r.calificacion} = {r.contrib.toFixed(2)}
                  </span>
                </div>
              ))}
          </div>
          <div className="rounded-md bg-brand/5 px-3 py-2">
            <p className="text-sm font-bold text-brand-dark">Total: {total.toFixed(2)}</p>
            {interpretHint && <p className="mt-0.5 text-xs text-muted">{interpretHint}</p>}
          </div>
        </div>
      );
    }

    case "matriz_cuadrantes": {
      const quadrants = asArray<{ key: string; label: string }>(config.quadrants);
      const cards = asArray<Record<string, unknown>>(content.cards);
      if (cards.length === 0) return <Empty />;
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {quadrants.map((q, qi) => {
            const inQ = cards.filter((c) => c.quadrant === q.key);
            if (inQ.length === 0) return null;
            const color = axisColor(qi);
            return (
              <div key={q.key} className="rounded-lg border-l-4 bg-black/[0.015] p-2.5" style={{ borderLeftColor: color }}>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color }}>
                  {q.label}
                  <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold text-muted">{inQ.length}</span>
                </p>
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
          <div className="space-y-2.5">
            {entries.map((entry, i) => (
              <div key={i} className="rounded-lg border border-border bg-black/[0.015] p-3">
                {(entry.aspiration_id as number) != null && (
                  <div className="mb-1.5">
                    <AspTag aspirations={aspirations} id={(entry.aspiration_id as number) ?? null} />
                  </div>
                )}
                <FieldGrid fields={fields} values={entry} />
              </div>
            ))}
          </div>
        );
      }
      const values = asRecord(content.values);
      const hasAny = fields.some((f) => str(values[f.key]));
      if (!hasAny) return <Empty />;
      return (
        <div className="rounded-lg border border-border bg-black/[0.015] p-3">
          <FieldGrid fields={fields} values={values} />
        </div>
      );
    }

    case "mapa_estrategico": {
      const perspectives = asArray<{ key: string; label: string }>(config.perspectives);
      const cards = asArray<Record<string, unknown>>(content.cards);
      if (cards.length === 0) return <Empty />;
      const reversed = [...perspectives].reverse();
      return (
        <div className="space-y-2">
          {reversed.map((p, i) => {
            const inP = cards.filter((c) => c.perspective === p.key);
            if (inP.length === 0) return null;
            // Banda de color de base (verde, cimiento) a cúspide (dorado, resultado),
            // para que se lea como pirámide/mapa de perspectivas y no como una lista plana.
            const hue = 150 - (i / Math.max(reversed.length - 1, 1)) * 105;
            return (
              <div key={p.key} className="rounded-lg border-l-4 bg-black/[0.015] p-2.5" style={{ borderLeftColor: `hsl(${hue} 55% 42%)` }}>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: `hsl(${hue} 55% 32%)` }}>
                  {p.label}
                </p>
                <ul className="space-y-1">
                  {inP.map((c, ci) => (
                    <li key={ci} className="text-sm text-foreground">
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
        <div className="space-y-2.5">
          {projects.map((p, i) => (
            <div key={i} className="rounded-lg border border-border bg-black/[0.015] p-3">
              <FieldGrid fields={fields} values={p} />
            </div>
          ))}
        </div>
      );
    }

    case "ficha_kpi": {
      const kpis = asArray<Record<string, unknown>>(content.kpis);
      if (kpis.length === 0) return <Empty />;
      return (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {kpis.map((k, i) => (
            <div key={i} className="rounded-lg border border-border bg-black/[0.015] p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <AspTag aspirations={aspirations} id={(k.aspiration_id as number) ?? null} />
                <span className="text-sm font-semibold text-foreground">{str(k.nombre) || "—"}</span>
              </div>
              {str(k.formula) && <p className="mb-2 text-xs italic text-muted">{str(k.formula)}</p>}
              <div className="flex items-center gap-2 rounded-md bg-brand/5 px-2.5 py-1.5 text-xs">
                <span className="font-semibold text-foreground">{str(k.linea_base) || "—"}</span>
                <span className="text-muted">→</span>
                <span className="font-bold text-brand-dark">{str(k.meta_2027) || "—"}</span>
                <span className="ml-auto shrink-0 text-muted">{str(k.frecuencia)}</span>
              </div>
              {str(k.responsable) && <p className="mt-1.5 text-[11px] text-muted">👤 {str(k.responsable)}</p>}
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
      const rawHomolog = asArray<Record<string, unknown>>((content.homologacion as Record<string, unknown> | undefined)?.signals);
      const homologSignals = rawHomolog.map((s) => ({
        id: str(s.id),
        axis: str(s.axis),
        ring: Number(s.ring ?? 0),
        text: str(s.text),
        score: Number(s.score ?? 0),
      }));
      return (
        <RadarContextoResults
          axes={axes}
          rings={rings}
          signals={signals}
          voteTotal={voteTotal}
          winnerByAxis={winnerByAxis}
          homologSignals={homologSignals}
          large={large}
        />
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
  const icon = ACTIVITY_TYPE_ICON[activity.activity_type] ?? "📄";
  const entryCount = hasAny ? countEntries(activity, submissions) : 0;

  return (
    <div className="group rounded-lg border border-border bg-card transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3">
        <button className="flex flex-1 items-center justify-between gap-3 text-left" onClick={() => setOpen((o) => !o)}>
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-base leading-none" aria-hidden>
              {icon}
            </span>
            <span className="truncate text-sm font-semibold text-foreground">{activity.title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {!hasAny && <span className="text-xs text-muted">sin datos</span>}
            {hasAny && entryCount > 0 && (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand-dark">
                {entryCount} {entryCount === 1 ? "aporte" : "aportes"}
              </span>
            )}
            <span className={`text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
          </span>
        </button>
        {hasAny && (
          <button
            className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:bg-black/5"
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
