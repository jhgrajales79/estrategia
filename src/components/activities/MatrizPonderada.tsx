"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { isPresenter } from "@/lib/presenter";
import BarChart from "@/components/charts/BarChart";
import { ActivityComponentProps, inputCls, btnPrimary, btnDanger, SaveIndicator, PresenterHint, uid } from "./shared";

interface SimpleRow {
  id: string;
  factor: string;
  peso: number;
  calificacion: number;
  aspiration_id: number | null;
}
interface RatingLabel {
  value: number;
  label: string;
}
const WEIGHT_TARGET = 1;
const WEIGHT_TOLERANCE = 0.02;

function parseThreshold(hint?: string): number | null {
  if (!hint) return null;
  const m = hint.match(/([\d.]+)/);
  return m ? Number(m[1]) : null;
}
interface QspmStrategy {
  id: string;
  name: string;
}
interface QspmFactor {
  id: string;
  name: string;
  peso: number;
}
interface Content extends Record<string, unknown> {
  rows: SimpleRow[];
  strategies: QspmStrategy[];
  factors: QspmFactor[];
  ratings: Record<string, Record<string, number>>;
}

export default function MatrizPonderada({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const mode = (activity.config.mode as string) ?? "simple";
  const scaleMax = (activity.config.scaleMax as number) ?? 4;
  const interpretHint = activity.config.interpretHint as string | undefined;
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { rows: [], strategies: [], factors: [], ratings: {} }
  );

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  if (mode === "qspm") {
    const strategies = content.strategies;
    const factors = content.factors;

    function addStrategy() {
      save({ ...content, strategies: [...strategies, { id: uid(), name: `Estrategia ${strategies.length + 1}` }] });
    }
    function addFactor() {
      save({ ...content, factors: [...factors, { id: uid(), name: "Nuevo factor", peso: 0 }] });
    }
    function setFactor(id: string, patch: Partial<QspmFactor>) {
      save({ ...content, factors: factors.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
    }
    function setStrategy(id: string, name: string) {
      save({ ...content, strategies: strategies.map((s) => (s.id === id ? { ...s, name } : s)) });
    }
    function setRating(factorId: string, strategyId: string, value: number) {
      const ratings = { ...content.ratings, [factorId]: { ...(content.ratings[factorId] ?? {}), [strategyId]: value } };
      save({ ...content, ratings });
    }
    function removeFactor(id: string) {
      const rest = { ...content.ratings };
      delete rest[id];
      save({ ...content, factors: factors.filter((f) => f.id !== id), ratings: rest });
    }
    function removeStrategy(id: string) {
      const ratings: typeof content.ratings = {};
      for (const [fid, row] of Object.entries(content.ratings)) {
        const rest = { ...row };
        delete rest[id];
        ratings[fid] = rest;
      }
      save({ ...content, strategies: strategies.filter((s) => s.id !== id), ratings });
    }

    const totals = strategies.map((s) => {
      const total = factors.reduce((acc, f) => acc + f.peso * (content.ratings[f.id]?.[s.id] ?? 0), 0);
      return { id: s.id, total };
    });
    const ranked = [...totals].sort((a, b) => b.total - a.total);

    return (
      <div className="space-y-3">
        {presenter && <PresenterHint />}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-black/[0.03]">
              <tr>
                <th className="p-2 text-left font-medium">Factor clave</th>
                <th className="p-2 text-left font-medium w-24">Peso</th>
                {strategies.map((s) => (
                  <th key={s.id} className="p-2 text-left font-medium min-w-40">
                    <input className={inputCls} value={s.name} disabled={presenter} onChange={(e) => setStrategy(s.id, e.target.value)} />
                    {!presenter && (
                      <button className={btnDanger} onClick={() => removeStrategy(s.id)}>
                        quitar
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {factors.map((f) => (
                <tr key={f.id} className="border-t border-border">
                  <td className="p-2">
                    <input className={inputCls} value={f.name} disabled={presenter} onChange={(e) => setFactor(f.id, { name: e.target.value })} />
                    {!presenter && (
                      <button className={btnDanger} onClick={() => removeFactor(f.id)}>
                        quitar
                      </button>
                    )}
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      className={inputCls}
                      value={f.peso}
                      disabled={presenter}
                      onChange={(e) => setFactor(f.id, { peso: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  {strategies.map((s) => (
                    <td key={s.id} className="p-2">
                      <input
                        type="number"
                        min={1}
                        max={scaleMax}
                        className={inputCls}
                        value={content.ratings[f.id]?.[s.id] ?? ""}
                        disabled={presenter}
                        onChange={(e) => setRating(f.id, s.id, parseFloat(e.target.value) || 0)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-border bg-black/[0.03] font-semibold">
                <td className="p-2" colSpan={2}>
                  Puntaje total ponderado
                </td>
                {strategies.map((s) => (
                  <td key={s.id} className="p-2">
                    {(totals.find((t) => t.id === s.id)?.total ?? 0).toFixed(2)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {!presenter && (
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={addFactor}>
              + Factor
            </button>
            <button className={btnPrimary} onClick={addStrategy}>
              + Estrategia
            </button>
          </div>
        )}
        {ranked.length > 0 && (
          <div className="rounded-md bg-black/[0.03] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Ranking QSPM</p>
            <BarChart
              bars={ranked.map((r) => ({
                label: strategies.find((s) => s.id === r.id)?.name ?? "",
                value: Number(r.total.toFixed(2)),
                colorClass: "bg-brand",
              }))}
            />
          </div>
        )}
        <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
      </div>
    );
  }

  // modo simple (EFI / EFE)
  return (
    <SimpleMatrix
      activity={activity}
      aspirations={aspirations}
      participant={participant}
      presenter={presenter}
      scaleMax={scaleMax}
      interpretHint={interpretHint}
      content={content}
      save={save}
      saving={saving}
      updatedAt={updatedAt}
      saveError={saveError}
    />
  );
}

function SimpleMatrix({
  activity,
  aspirations,
  participant,
  presenter,
  scaleMax,
  interpretHint,
  content,
  save,
  saving,
  updatedAt,
  saveError,
}: {
  activity: ActivityComponentProps["activity"];
  aspirations: ActivityComponentProps["aspirations"];
  participant: ActivityComponentProps["participant"];
  presenter: boolean;
  scaleMax: number;
  interpretHint?: string;
  content: Content;
  save: (next: Content, opts?: { eventType?: string; summary?: string }) => void;
  saving: boolean;
  updatedAt: string | null;
  saveError: string | null;
}) {
  const ratingLabels = activity.config.ratingLabels as RatingLabel[] | undefined;
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  // Factor y Peso se escriben en cada tecleo pero solo se guardan al salir del campo
  // (blur/Enter): guardar en cada tecla saturaba la red y afectaba el rendimiento.
  const [drafts, setDrafts] = useState<Record<string, { factor?: string; peso?: string }>>({});
  const rows = content.rows;

  function addRow() {
    save({ ...content, rows: [...rows, { id: uid(), factor: "", peso: 0, calificacion: 1, aspiration_id: participant.aspiration_id }] });
  }
  function setRow(id: string, patch: Partial<SimpleRow>) {
    save({ ...content, rows: rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }
  function removeRow(id: string) {
    save({ ...content, rows: rows.filter((r) => r.id !== id) });
    setConfirmRemove(null);
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  }
  function requestRemove(r: SimpleRow) {
    if (!r.factor.trim()) {
      removeRow(r.id);
    } else {
      setConfirmRemove(r.id);
    }
  }

  function draftFactor(r: SimpleRow) {
    return drafts[r.id]?.factor ?? r.factor;
  }
  function draftPesoStr(r: SimpleRow) {
    return drafts[r.id]?.peso ?? String(r.peso);
  }
  function draftPesoNum(r: SimpleRow) {
    const d = drafts[r.id]?.peso;
    return d !== undefined ? Number(d) || 0 : r.peso;
  }
  function commitFactor(r: SimpleRow) {
    const value = draftFactor(r);
    if (value !== r.factor) setRow(r.id, { factor: value });
    setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id], factor: undefined } }));
  }
  function commitPeso(r: SimpleRow) {
    const value = draftPesoNum(r);
    if (value !== r.peso) setRow(r.id, { peso: value });
    setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id], peso: undefined } }));
  }

  const pesoTotal = rows.reduce((a, r) => a + draftPesoNum(r), 0);
  const total = rows.reduce((a, r) => a + draftPesoNum(r) * (Number(r.calificacion) || 0), 0);
  const pesoDiff = pesoTotal - WEIGHT_TARGET;
  const pesoOk = Math.abs(pesoDiff) <= WEIGHT_TOLERANCE;
  const threshold = parseThreshold(interpretHint);
  const isStrong = threshold !== null ? total > threshold : null;

  const sortedRows = [...rows].sort((a, b) => {
    const na = findAspiration(aspirations, a.aspiration_id)?.number ?? 99;
    const nb = findAspiration(aspirations, b.aspiration_id)?.number ?? 99;
    return na - nb;
  });

  return (
    <div className="space-y-4">
      {presenter && <PresenterHint />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wide text-muted">Peso total</span>
            <span className={`font-bold ${pesoOk ? "text-brand-dark" : "text-red-600"}`}>
              {pesoTotal.toFixed(2)} / {WEIGHT_TARGET.toFixed(2)}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/10">
            <div
              className={`h-full rounded-full transition-all ${pesoOk ? "bg-brand" : pesoDiff > 0 ? "bg-red-500" : "bg-amber-500"}`}
              style={{ width: `${Math.min((pesoTotal / WEIGHT_TARGET) * 100, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {pesoOk
              ? "✓ Los pesos suman 1.00, como exige la metodología."
              : pesoDiff > 0
                ? `⚠ Excede por ${pesoDiff.toFixed(2)} — reduce algún peso.`
                : `⚠ Falta ${Math.abs(pesoDiff).toFixed(2)} para llegar a 1.00.`}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wide text-muted">Puntaje ponderado total</span>
            <span className="font-bold text-foreground">{total.toFixed(2)}</span>
          </div>
          {isStrong !== null ? (
            <p className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isStrong ? "bg-brand/10 text-brand-dark" : "bg-amber-50 text-amber-700"}`}>
              {isStrong ? "🟢 Posición relativamente fuerte" : "🟠 Posición relativamente débil"}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-muted">Agrega factores para calcular la interpretación.</p>
          )}
          {interpretHint && <p className="mt-1 text-[11px] text-muted">{interpretHint}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {aspirations.map((a) => {
          const count = rows.filter((r) => r.aspiration_id === a.id).length;
          const cls = aspClasses(a.number);
          return (
            <span
              key={a.id}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                count > 0 ? `${cls.bgSoft} ${cls.text}` : "border border-dashed border-border text-muted"
              }`}
            >
              {count === 0 && "⚠ "}
              Aspiración {a.number}: {count} {count === 1 ? "factor" : "factores"}
            </span>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-black/[0.03]">
            <tr>
              <th className="p-2 text-left font-medium">Factor</th>
              <th className="p-2 text-left font-medium">Aspiración</th>
              <th className="p-2 text-left font-medium w-24">Peso</th>
              <th className="p-2 text-left font-medium w-44">Calificación</th>
              <th className="p-2 text-left font-medium w-24">Ponderado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => {
              const asp = findAspiration(aspirations, r.aspiration_id);
              const cls = aspClasses(asp?.number);
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2">
                    <input
                      className={inputCls}
                      value={draftFactor(r)}
                      disabled={presenter}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id], factor: e.target.value } }))}
                      onBlur={() => commitFactor(r)}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    />
                  </td>
                  <td className="p-2">
                    <select
                      className={inputCls}
                      value={r.aspiration_id ?? ""}
                      disabled={presenter}
                      onChange={(e) => setRow(r.id, { aspiration_id: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">—</option>
                      {aspirations.map((a) => (
                        <option key={a.id} value={a.id}>
                          Asp. {a.number}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={1}
                      className={inputCls}
                      value={draftPesoStr(r)}
                      disabled={presenter}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id], peso: e.target.value } }))}
                      onBlur={() => commitPeso(r)}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    />
                  </td>
                  <td className="p-2">
                    {ratingLabels ? (
                      <select
                        className={inputCls}
                        value={r.calificacion}
                        disabled={presenter}
                        onChange={(e) => setRow(r.id, { calificacion: Number(e.target.value) })}
                      >
                        {ratingLabels.map((rl) => (
                          <option key={rl.value} value={rl.value}>
                            {rl.value} — {rl.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        max={scaleMax}
                        className={inputCls}
                        value={r.calificacion}
                        disabled={presenter}
                        onChange={(e) => setRow(r.id, { calificacion: parseFloat(e.target.value) || 0 })}
                      />
                    )}
                  </td>
                  <td className={`p-2 font-medium ${cls.text}`}>{(draftPesoNum(r) * r.calificacion).toFixed(2)}</td>
                  <td className="p-2">
                    {!presenter &&
                      (confirmRemove === r.id ? (
                        <div className="flex items-center gap-2 text-xs">
                          <button className="font-medium text-red-600 hover:underline" onClick={() => removeRow(r.id)}>
                            Confirmar
                          </button>
                          <button className="text-muted hover:underline" onClick={() => setConfirmRemove(null)}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button className={btnDanger} onClick={() => requestRemove(r)}>
                          quitar
                        </button>
                      ))}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-border bg-black/[0.03] font-semibold">
              <td className="p-2" colSpan={2}>
                Totales
              </td>
              <td className={`p-2 ${pesoOk ? "" : "text-red-600"}`}>{pesoTotal.toFixed(2)}</td>
              <td className="p-2" />
              <td className="p-2">{total.toFixed(2)}</td>
              <td className="p-2" />
            </tr>
          </tbody>
        </table>
      </div>
      {!presenter && (
        <button className={btnPrimary} onClick={addRow}>
          + Factor
        </button>
      )}
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
