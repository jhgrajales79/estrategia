"use client";

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
  const rows = content.rows;
  function addRow() {
    save({ ...content, rows: [...rows, { id: uid(), factor: "", peso: 0, calificacion: 1, aspiration_id: participant.aspiration_id }] });
  }
  function setRow(id: string, patch: Partial<SimpleRow>) {
    save({ ...content, rows: rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }
  function removeRow(id: string) {
    save({ ...content, rows: rows.filter((r) => r.id !== id) });
  }
  const pesoTotal = rows.reduce((a, r) => a + (Number(r.peso) || 0), 0);
  const total = rows.reduce((a, r) => a + (Number(r.peso) || 0) * (Number(r.calificacion) || 0), 0);

  return (
    <div className="space-y-3">
      {presenter && <PresenterHint />}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-black/[0.03]">
            <tr>
              <th className="p-2 text-left font-medium">Factor</th>
              <th className="p-2 text-left font-medium">Aspiración</th>
              <th className="p-2 text-left font-medium w-24">Peso</th>
              <th className="p-2 text-left font-medium w-28">Calificación</th>
              <th className="p-2 text-left font-medium w-24">Ponderado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const asp = findAspiration(aspirations, r.aspiration_id);
              const cls = aspClasses(asp?.number);
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2">
                    <input className={inputCls} value={r.factor} disabled={presenter} onChange={(e) => setRow(r.id, { factor: e.target.value })} />
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
                      className={inputCls}
                      value={r.peso}
                      disabled={presenter}
                      onChange={(e) => setRow(r.id, { peso: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={1}
                      max={scaleMax}
                      className={inputCls}
                      value={r.calificacion}
                      disabled={presenter}
                      onChange={(e) => setRow(r.id, { calificacion: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td className={`p-2 font-medium ${cls.text}`}>{(r.peso * r.calificacion).toFixed(2)}</td>
                  <td className="p-2">
                    {!presenter && (
                      <button className={btnDanger} onClick={() => removeRow(r.id)}>
                        quitar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-border bg-black/[0.03] font-semibold">
              <td className="p-2" colSpan={2}>
                Totales
              </td>
              <td className="p-2">{pesoTotal.toFixed(2)}</td>
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
      {interpretHint && <p className="text-xs text-muted">{interpretHint}</p>}
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
