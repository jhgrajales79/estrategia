"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId, fetchLatestContent } from "@/lib/useSubmission";
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
  const emptyContent: Content = { kpis: [] };
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    emptyContent
  );
  // Borrador local por campo: mientras se escribe no se guarda nada, solo al salir del campo
  // (blur) se persiste — antes `setField` guardaba en cada tecla (una escritura a la base de
  // datos por letra). Mismo patrón que TarjetaEstructurada.tsx.
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, Record<string, string>>>({});

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  // Varios equipos pueden tener KPIs distintos activos a la vez — releer la fila más reciente
  // antes de aplicar cada cambio evita que un guardado pise en silencio el de otra persona
  // (mismo patrón que TableroProyectos.tsx / VotacionFichas.tsx).
  async function mutateContent(fn: (latest: Content) => Content, opts?: { eventType?: string; summary?: string }) {
    const latest = await fetchLatestContent<Content>(activity.id, submissionAspId, emptyContent);
    await save(fn(latest), opts);
  }

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
    mutateContent((latest) => ({ kpis: [...latest.kpis, kpi] }), { eventType: "kpi", summary: `${participant.name} agregó un indicador` });
  }
  function draftValue(kpiId: string, key: keyof Kpi, fallback: string) {
    return fieldDrafts[kpiId]?.[key] ?? fallback;
  }
  function updateDraft(kpiId: string, key: keyof Kpi, value: string) {
    setFieldDrafts((d) => ({ ...d, [kpiId]: { ...d[kpiId], [key]: value } }));
  }
  function commitField(kpiId: string, key: keyof Kpi) {
    const value = fieldDrafts[kpiId]?.[key];
    if (value === undefined) return;
    setFieldDrafts((d) => {
      if (!d[kpiId]) return d;
      const inner = { ...d[kpiId] };
      delete inner[key];
      return { ...d, [kpiId]: inner };
    });
    mutateContent((latest) => ({ kpis: latest.kpis.map((k) => (k.id === kpiId ? { ...k, [key]: value } : k)) }));
  }
  function removeKpi(id: string) {
    mutateContent((latest) => ({ kpis: latest.kpis.filter((k) => k.id !== id) }));
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
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PresenterHint />
          {Boolean(activity.config.boardRoute) && (
            <button
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 transition-colors"
              title="Ver el tablero de indicadores en una pestaña nueva"
              onClick={() => window.open(`/${activity.config.boardRoute}/${activity.id}`, "_blank", "noopener,noreferrer")}
            >
              ⛶ Ver tablero
            </button>
          )}
        </div>
      )}
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
                    <input
                      className={inputCls}
                      value={draftValue(k.id, f.key, k[f.key] as string)}
                      onChange={(e) => updateDraft(k.id, f.key, e.target.value)}
                      onBlur={() => commitField(k.id, f.key)}
                    />
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
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
