"use client";

import { useState } from "react";
import BarChart from "@/components/charts/BarChart";
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

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function renderContent(activity: ActivityRow, content: Record<string, unknown>, aspirations: Aspiration[]) {
  const config = activity.config as Record<string, unknown>;

  switch (activity.activity_type) {
    case "notas": {
      const categories = asArray<{ key: string; label: string }>(config.categories);
      const notes = asArray<Record<string, unknown>>(content.notes);
      if (notes.length === 0) return <Empty />;
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((cat) => {
            const inCat = notes.filter((n) => n.category === cat.key);
            if (inCat.length === 0) return null;
            return (
              <div key={cat.key}>
                <p className="mb-1 text-xs font-semibold text-muted">{cat.label}</p>
                <ul className="space-y-1">
                  {inCat.map((n, i) => (
                    <li key={i} className="text-sm text-foreground">
                      <AspTag aspirations={aspirations} id={(n.aspiration_id as number) ?? null} />
                      {str(n.text)}
                      {n.impact ? <span className="text-xs text-muted"> · {str(n.impact)}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
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
      const signals = asArray<Record<string, unknown>>(content.signals);
      const votes = asArray<Record<string, unknown>>(content.votes);
      if (signals.length === 0) return <Empty />;
      const voteTotal = (id: string) => votes.filter((v) => v.signal_id === id).reduce((a, v) => a + Number(v.points ?? 0), 0);
      return (
        <div className="space-y-2">
          {axes.map((a) => {
            const inAxis = signals.filter((s) => s.axis === a.key);
            if (inAxis.length === 0) return null;
            return (
              <div key={a.key}>
                <p className="mb-1 text-xs font-semibold text-muted">{a.label}</p>
                <ul className="space-y-1">
                  {inAxis
                    .sort((x, y) => voteTotal(str(y.id)) - voteTotal(str(x.id)))
                    .map((s, i) => (
                      <li key={i} className="text-sm text-foreground">
                        {str(s.text)}{" "}
                        <span className="text-xs text-muted">
                          · {rings[Number(s.ring ?? 0)] ?? ""} · {voteTotal(str(s.id))} votos
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            );
          })}
        </div>
      );
    }

    default:
      return <Empty />;
  }
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
  const hasAny = submissions.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setOpen((o) => !o)}>
        <span className="text-sm font-semibold text-foreground">{activity.title}</span>
        <span className="flex items-center gap-2">
          {!hasAny && <span className="text-xs text-muted">sin datos</span>}
          <span className="text-muted">{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4">
          {!hasAny && <Empty />}
          {submissions.map((s, i) => {
            const perAspiration = Boolean((activity.config as Record<string, unknown>).perAspiration);
            const asp = perAspiration ? findAspiration(aspirations, s.aspiration_id) : null;
            return (
              <div key={i}>
                {perAspiration && asp && (
                  <p className={`mb-2 text-xs font-bold ${aspClasses(asp.number).text}`}>Aspiración {asp.number}</p>
                )}
                {renderContent(activity, s.content, aspirations)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
