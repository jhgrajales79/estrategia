"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import QuadrantPoint from "@/components/charts/QuadrantPoint";
import { ActivityComponentProps, inputCls, textareaCls, btnPrimary, btnDanger, SaveIndicator, PresenterHint, uid } from "./shared";

interface Item {
  id: string;
  key?: string;
  label: string;
  score: number;
  note?: string;
  axis?: "FF" | "VC" | "EE" | "FI";
}
interface Content extends Record<string, unknown> {
  items: Item[];
}

const AXIS_LABEL: Record<string, string> = {
  FF: "Fortaleza financiera",
  VC: "Ventaja competitiva",
  EE: "Estabilidad del entorno",
  FI: "Fortaleza de la industria",
};

export default function RuedaEvaluacion({ activity, session, participant }: ActivityComponentProps) {
  const scaleMax = (activity.config.scaleMax as number) ?? 5;
  const dynamicItems = Boolean(activity.config.dynamicItems);
  const peeaMode = Boolean(activity.config.peeaMode);
  const fixedItems = (activity.config.items as Item[]) ?? [];
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { items: dynamicItems ? [] : fixedItems.map((f) => ({ ...f, id: f.key ?? uid(), score: 0, note: "" })) }
  );
  const [newLabel, setNewLabel] = useState("");

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  function setItem(id: string, patch: Partial<Item>) {
    save({ items: content.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  }
  function addItem() {
    if (!newLabel.trim()) return;
    save({ items: [...content.items, { id: uid(), label: newLabel.trim(), score: 0, note: "" }] });
    setNewLabel("");
  }
  function removeItem(id: string) {
    save({ items: content.items.filter((i) => i.id !== id) });
  }

  let posture: string | null = null;
  let vector: { x: number; y: number } | null = null;
  if (peeaMode && content.items.length > 0) {
    const byAxis = (axis: string) => content.items.filter((i) => i.axis === axis).reduce((a, i) => a + i.score, 0);
    const x = byAxis("VC") * -1 + byAxis("FI"); // ventaja competitiva es negativa por convención PEEA, industria positiva
    const y = byAxis("FF") + byAxis("EE") * -1;
    vector = { x, y };
    if (x >= 0 && y >= 0) posture = "Agresiva";
    else if (x < 0 && y >= 0) posture = "Conservadora";
    else if (x < 0 && y < 0) posture = "Defensiva";
    else posture = "Competitiva";
  }

  return (
    <div className="space-y-3">
      {presenter && <PresenterHint />}
      {presenter && content.items.length === 0 && (
        <p className="text-sm text-muted">Aún no hay capacidades registradas. Cada equipo las agrega desde su propia sesión.</p>
      )}
      <div className="space-y-2">
        {content.items.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {item.label}
                {item.axis && <span className="ml-2 text-xs text-muted">({AXIS_LABEL[item.axis]})</span>}
              </p>
              {presenter ? (
                item.note && <p className="mt-1 text-xs text-muted">{item.note}</p>
              ) : (
                <input
                  className={textareaCls + " mt-1"}
                  placeholder="Sustento / nota…"
                  value={item.note ?? ""}
                  onChange={(e) => setItem(item.id, { note: e.target.value })}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              {presenter ? (
                <span className="text-sm font-semibold">{item.score}</span>
              ) : (
                <>
                  <input
                    type="range"
                    min={0}
                    max={scaleMax}
                    value={item.score}
                    onChange={(e) => setItem(item.id, { score: Number(e.target.value) })}
                  />
                  <span className="w-6 text-center text-sm font-semibold">{item.score}</span>
                  {dynamicItems && (
                    <button className={btnDanger} onClick={() => removeItem(item.id)}>
                      quitar
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {dynamicItems && !presenter && (
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder="Nueva capacidad a evaluar…"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <button className={btnPrimary} onClick={addItem}>
            + Agregar
          </button>
        </div>
      )}
      {posture && vector && (
        <div className="flex flex-wrap items-center gap-4 rounded-md bg-black/[0.03] p-3 text-sm">
          <QuadrantPoint x={vector.x} y={vector.y} range={scaleMax} />
          <p>
            <span className="font-medium">Postura estratégica (PEEA): </span>
            {posture}
          </p>
        </div>
      )}
      <SaveIndicator saving={saving} updatedAt={updatedAt} />
    </div>
  );
}
