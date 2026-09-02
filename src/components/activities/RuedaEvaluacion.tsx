"use client";

import { useEffect, useState } from "react";
import { useSubmission } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
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

export default function RuedaEvaluacion({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const scaleMax = (activity.config.scaleMax as number) ?? 5;
  const dynamicItems = Boolean(activity.config.dynamicItems);
  const peeaMode = Boolean(activity.config.peeaMode);
  const perAspiration = Boolean(activity.config.perAspiration);
  const fixedItems = (activity.config.items as Item[]) ?? [];
  const presenter = isPresenter(participant);
  const [activeAspId, setActiveAspId] = useState<number | null>(
    () => participant.aspiration_id ?? aspirations[0]?.id ?? null
  );
  useEffect(() => {
    // El facilitador no tiene aspiración propia: si las aspiraciones aún no habían
    // cargado al montar, se selecciona la primera apenas estén disponibles.
    if (activeAspId === null && aspirations.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveAspId(aspirations[0].id);
    }
  }, [aspirations, activeAspId]);
  const submissionAspId = perAspiration ? activeAspId : null;
  // Cada quien solo edita el tablero de su propia aspiración; las demás pestañas
  // se pueden mirar (para seguir el avance de los otros equipos) pero en solo lectura.
  const canEdit = perAspiration ? !presenter && activeAspId === participant.aspiration_id : !presenter;
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { items: dynamicItems ? [] : fixedItems.map((f) => ({ ...f, id: f.key ?? uid(), score: 0, note: "" })) }
  );
  const [newLabel, setNewLabel] = useState("");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  function setItem(id: string, patch: Partial<Item>) {
    save({ items: content.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  }
  function commitNote(item: Item) {
    const text = (noteDraft[item.id] ?? item.note ?? "").trim();
    setNoteDraft((d) => {
      const next = { ...d };
      delete next[item.id];
      return next;
    });
    if (text !== (item.note ?? "")) setItem(item.id, { note: text });
  }
  function step(item: Item, delta: number) {
    const next = Math.max(0, Math.min(scaleMax, item.score + delta));
    if (next !== item.score) setItem(item.id, { score: next });
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
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PresenterHint />
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5"
            title="Ver la rueda en una pestaña nueva"
            onClick={() => window.open(`/rueda/${activity.id}`, "_blank", "noopener,noreferrer")}
          >
            ⛶ Ver tablero
          </button>
        </div>
      )}
      {perAspiration && aspirations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {aspirations.map((a) => {
            const cls = aspClasses(a.number);
            const active = activeAspId === a.id;
            const isMine = a.id === participant.aspiration_id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setActiveAspId(a.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active ? `border-transparent ${cls.bg} text-dark` : `${cls.border} ${cls.text} bg-card hover:bg-black/5`
                }`}
              >
                Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
                {isMine && <span className="ml-1">· tu equipo</span>}
              </button>
            );
          })}
        </div>
      )}
      {presenter && content.items.length === 0 && (
        <p className="text-sm text-muted">Aún no hay capacidades registradas. Cada equipo las agrega desde su propia sesión.</p>
      )}
      {perAspiration && !canEdit && !presenter && content.items.length === 0 && (
        <p className="text-sm text-muted">Este equipo aún no ha registrado capacidades.</p>
      )}
      <div className="space-y-2">
        {content.items.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {item.label}
                {item.axis && <span className="ml-2 text-xs text-muted">({AXIS_LABEL[item.axis]})</span>}
              </p>
              {canEdit ? (
                <input
                  className={textareaCls + " mt-1"}
                  placeholder="Sustento / nota…"
                  value={noteDraft[item.id] ?? item.note ?? ""}
                  onChange={(e) => setNoteDraft((d) => ({ ...d, [item.id]: e.target.value }))}
                  onBlur={() => commitNote(item)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
              ) : (
                item.note && <p className="mt-1 text-xs text-muted">{item.note}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  type="button"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-sm hover:bg-black/5 disabled:opacity-40"
                  disabled={item.score <= 0}
                  onClick={() => step(item, -1)}
                  aria-label="Bajar calificación"
                >
                  −
                </button>
              )}
              <div className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-300 ease-out"
                  style={{ width: `${(item.score / scaleMax) * 100}%` }}
                />
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-sm hover:bg-black/5 disabled:opacity-40"
                  disabled={item.score >= scaleMax}
                  onClick={() => step(item, 1)}
                  aria-label="Subir calificación"
                >
                  +
                </button>
              )}
              <span className="w-10 shrink-0 text-center text-sm font-semibold text-foreground">
                {item.score}/{scaleMax}
              </span>
              {dynamicItems && canEdit && (
                <button className={btnDanger} onClick={() => removeItem(item.id)}>
                  quitar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {dynamicItems && canEdit && (
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
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
