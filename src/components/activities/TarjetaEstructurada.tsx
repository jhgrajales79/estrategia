"use client";

import { useEffect, useState } from "react";
import { useSubmission } from "@/lib/useSubmission";
import { aspClasses, findAspiration, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import { isPresenter } from "@/lib/presenter";
import { ActivityComponentProps, inputCls, textareaCls, btnPrimary, btnDanger, SaveIndicator, PresenterHint, uid } from "./shared";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "date";
  // Texto de apoyo bajo el campo — para dar una guía concreta (p. ej. desglosar qué hace
  // "SMART" a un objetivo) sin inventar un tipo de actividad nuevo solo para eso.
  helper?: string;
  // Valor con el que arranca cada registro NUEVO (p. ej. un plazo que casi siempre es el mismo
  // en todas las entradas de esta actividad) — el equipo lo puede editar si su caso es distinto.
  default?: string;
}
interface Entry extends Record<string, unknown> {
  id: string;
  aspiration_id?: number | null;
}
interface Content extends Record<string, unknown> {
  entries: Entry[];
  values: Record<string, string>;
}

function FieldInput({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return <p className="rounded-md bg-black/[0.03] px-3 py-1.5 text-sm text-foreground min-h-8">{value || "—"}</p>;
  }
  return (
    <>
      {field.type === "textarea" ? (
        <textarea className={textareaCls} placeholder={field.label} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          type={field.type === "date" ? "date" : "text"}
          className={inputCls}
          placeholder={field.label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.helper && <p className="mt-1 text-xs text-muted">{field.helper}</p>}
    </>
  );
}

export default function TarjetaEstructurada({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const fields = (activity.config.fields as FieldDef[]) ?? [];
  const repeatable = Boolean(activity.config.repeatable);
  const repeatLabel = (activity.config.repeatLabel as string) ?? "Registro";
  const presenter = isPresenter(participant);
  const perAspiration = Boolean(activity.config.perAspiration);
  // Igual que en MatrizPonderada: no hay (todavía) una asignación real de aspiración por
  // participante, así que cada equipo elige su pestaña libremente en vez de depender de su
  // identidad — así 3 aspiraciones caben en un mismo taller como 3 equipos independientes.
  const [activeAspId, setActiveAspId] = useState<number | null>(() => aspirations[0]?.id ?? null);
  useEffect(() => {
    if (activeAspId === null && aspirations.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveAspId(aspirations[0].id);
    }
  }, [aspirations, activeAspId]);
  const submissionAspId = perAspiration ? activeAspId : null;
  const { content, setContent, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { entries: [], values: {} }
  );

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  const aspirationTabs = perAspiration && aspirations.length > 0 && (
    <div className="flex flex-wrap gap-1.5">
      {aspirations.map((a) => {
        const cls = aspClasses(a.number);
        const active = activeAspId === a.id;
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
          </button>
        );
      })}
    </div>
  );

  if (!repeatable) {
    // `setContent` actualiza el estado local de inmediato y solo guarda 700ms después de la
    // última tecla — a diferencia de `save()`, que dispara la escritura en cada tecla sin tocar
    // el estado local: si dos guardados se cruzan (típico al escribir rápido), el que responde
    // último pisa al otro con un `content` desactualizado, perdiendo caracteres ya tecleados.
    function setValue(key: string, v: string) {
      setContent({ ...content, values: { ...content.values, [key]: v } });
    }
    return (
      <div className="space-y-3">
        {presenter && <PresenterHint />}
        {aspirationTabs}
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
              <label className="mb-1 block text-xs font-medium text-muted">{f.label}</label>
              <FieldInput field={f} value={content.values[f.key] ?? ""} onChange={(v) => setValue(f.key, v)} readOnly={presenter} />
            </div>
          ))}
        </div>
        <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
      </div>
    );
  }

  function addEntry() {
    const entry: Entry = { id: uid(), aspiration_id: submissionAspId };
    for (const f of fields) if (f.default) entry[f.key] = f.default;
    save({ ...content, entries: [...content.entries, entry] }, { eventType: "registro", summary: `${participant.name} agregó "${repeatLabel}" en "${activity.title}"` });
  }
  function setEntryField(id: string, key: string, v: string) {
    setContent({ ...content, entries: content.entries.map((e) => (e.id === id ? { ...e, [key]: v } : e)) });
  }
  function removeEntry(id: string) {
    save({ ...content, entries: content.entries.filter((e) => e.id !== id) });
  }

  const minEntries = activity.config.minEntries as number | undefined;
  const metMinimum = minEntries !== undefined && content.entries.length >= minEntries;
  // Pluralizar "Objetivo SMART" agregando una "s" al final daría "objetivo smarts" — con
  // etiquetas de más de una palabra no basta una regla mecánica, así que la actividad puede
  // fijar el plural correcto explícitamente; a falta de eso, se usa el genérico "registros".
  const minEntriesLabel = (activity.config.minEntriesLabel as string) ?? "registros";

  return (
    <div className="space-y-3">
      {presenter && <PresenterHint />}
      {aspirationTabs}
      {minEntries !== undefined && (
        <p className={`text-xs font-semibold ${metMinimum ? "text-brand-dark" : "text-muted"}`}>
          {content.entries.length} de {minEntries} {minEntriesLabel} {metMinimum ? "✅" : "— faltan por completar"}
        </p>
      )}
      {presenter && content.entries.length === 0 && (
        <p className="text-sm text-muted">Aún no hay registros. Cada equipo los agrega desde su propia sesión.</p>
      )}
      {content.entries.map((entry) => {
        const asp = findAspiration(aspirations, (entry.aspiration_id as number) ?? null);
        const cls = aspClasses(asp?.number);
        return (
          <div key={entry.id} className={`rounded-lg border-l-4 ${cls.border} border border-border bg-card p-3`}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">{repeatLabel}</span>
              {!presenter && (
                <button className={btnDanger} onClick={() => removeEntry(entry.id)}>
                  eliminar
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                  <label className="mb-1 block text-xs font-medium text-muted">{f.label}</label>
                  <FieldInput
                    field={f}
                    value={(entry[f.key] as string) ?? ""}
                    onChange={(v) => setEntryField(entry.id, f.key, v)}
                    readOnly={presenter}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {!presenter && (
        <button className={btnPrimary} onClick={addEntry}>
          + {repeatLabel}
        </button>
      )}
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
