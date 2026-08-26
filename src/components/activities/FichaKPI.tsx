"use client";

import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { isPresenter } from "@/lib/presenter";
import { ActivityComponentProps, inputCls, btnPrimary, btnDanger, SaveIndicator, PresenterHint, uid } from "./shared";

interface Kpi {
  id: string;
  aspiration_id: number | null;
  nombre: string;
  formula: string;
  linea_base: string;
  meta_2027: string;
  frecuencia: string;
  responsable: string;
}
interface Content extends Record<string, unknown> {
  kpis: Kpi[];
}

export default function FichaKPI({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { kpis: [] }
  );

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  function addKpi() {
    const kpi: Kpi = {
      id: uid(),
      aspiration_id: participant.aspiration_id,
      nombre: "",
      formula: "",
      linea_base: "",
      meta_2027: "",
      frecuencia: "",
      responsable: "",
    };
    save({ kpis: [...content.kpis, kpi] }, { eventType: "kpi", summary: `${participant.name} agregó un indicador` });
  }
  function setField(id: string, key: keyof Kpi, value: string) {
    save({ kpis: content.kpis.map((k) => (k.id === id ? { ...k, [key]: value } : k)) });
  }
  function removeKpi(id: string) {
    save({ kpis: content.kpis.filter((k) => k.id !== id) });
  }

  const fields: { key: keyof Kpi; label: string }[] = [
    { key: "nombre", label: "Nombre del indicador" },
    { key: "formula", label: "Fórmula" },
    { key: "linea_base", label: "Línea base" },
    { key: "meta_2027", label: "Meta 2027" },
    { key: "frecuencia", label: "Frecuencia" },
    { key: "responsable", label: "Responsable" },
  ];

  return (
    <div className="space-y-3">
      {presenter && <PresenterHint />}
      {content.kpis.map((k) => {
        const asp = findAspiration(aspirations, k.aspiration_id);
        const cls = aspClasses(asp?.number);
        return (
          <div key={k.id} className={`rounded-lg border-l-4 ${cls.border} border border-border bg-card p-3`}>
            {!presenter && (
              <div className="mb-2 flex justify-end">
                <button className={btnDanger} onClick={() => removeKpi(k.id)}>
                  eliminar
                </button>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-xs font-medium text-muted">{f.label}</label>
                  {presenter ? (
                    <p className="rounded-md bg-black/[0.03] px-3 py-1.5 text-sm text-foreground min-h-8">{k[f.key] || "—"}</p>
                  ) : (
                    <input className={inputCls} value={k[f.key] as string} onChange={(e) => setField(k.id, f.key, e.target.value)} />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {!presenter && (
        <button className={btnPrimary} onClick={addKpi}>
          + Indicador
        </button>
      )}
      <SaveIndicator saving={saving} updatedAt={updatedAt} />
    </div>
  );
}
