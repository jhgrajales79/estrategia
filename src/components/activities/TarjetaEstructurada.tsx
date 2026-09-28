"use client";

import { useEffect, useState } from "react";
import { useSubmission } from "@/lib/useSubmission";
import { aspClasses, findAspiration, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import { isPresenter } from "@/lib/presenter";
import { ActivityComponentProps, inputCls, textareaCls, btnPrimary, btnDanger, SaveIndicator, PresenterHint, uid } from "./shared";

interface FieldDef {
  key: string;
  label: string;
  // "aspiration_name" es un campo derivado de solo lectura: no guarda nada propio, siempre
  // muestra el enunciado vigente de la aspiración de la pestaña activa (tabla `aspirations`) —
  // para que el equipo tenga el texto actual a la vista sin tener que copiarlo de memoria ni
  // saltar de pantalla a buscarlo.
  type: "text" | "textarea" | "date" | "aspiration_name";
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
  onBlur,
  readOnly,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  // Se dispara al salir del campo (o Enter, en los de una sola línea) — es el único momento en
  // que el valor se guarda de verdad. Mientras se escribe, `onChange` solo actualiza un borrador
  // local (ver `drafts`/`entryDrafts` más abajo): nada viaja a la base de datos tecla por tecla.
  onBlur?: () => void;
  readOnly?: boolean;
}) {
  if (readOnly || field.type === "aspiration_name") {
    return <p className="rounded-md bg-black/[0.03] px-3 py-1.5 text-sm text-foreground min-h-8">{value || "—"}</p>;
  }
  return (
    <>
      {field.type === "textarea" ? (
        <textarea className={textareaCls} placeholder={field.label} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      ) : (
        <input
          type={field.type === "date" ? "date" : "text"}
          className={inputCls}
          placeholder={field.label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
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
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { entries: [], values: {} }
  );
  // Borrador local por campo: mientras se escribe no se guarda nada, solo al salir del campo
  // (blur) o con Enter en los de una línea se persiste — mismo patrón que MatrizPonderada.tsx
  // para Factor/Peso. Evita por completo la carga de red de guardar en cada tecla, y de paso
  // impide cualquier condición de carrera entre guardados que se cruzan al escribir rápido.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [entryDrafts, setEntryDrafts] = useState<Record<string, Record<string, string>>>({});

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
    function draftValue(key: string) {
      return drafts[key] ?? content.values[key] ?? "";
    }
    function updateDraft(key: string, v: string) {
      setDrafts((d) => ({ ...d, [key]: v }));
    }
    function commitValue(key: string) {
      const value = drafts[key];
      if (value === undefined) return;
      setDrafts((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
      if (value !== (content.values[key] ?? "")) {
        save({ ...content, values: { ...content.values, [key]: value } });
      }
    }
    const activeAspiration = findAspiration(aspirations, activeAspId);
    return (
      <div className="space-y-3">
        {presenter && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PresenterHint />
            {perAspiration && (
              <button
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 transition-colors"
                title="Ver el tablero de resultados en una pestaña nueva"
                onClick={() => window.open(`/aspiraciones/${activity.id}`, "_blank", "noopener,noreferrer")}
              >
                ⛶ Ver tablero
              </button>
            )}
          </div>
        )}
        {aspirationTabs}
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={f.type === "textarea" || f.type === "aspiration_name" ? "sm:col-span-2" : ""}>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                {f.label}
                {/* Mientras el borrador difiere de lo ya guardado: recordatorio de que falta salir
                    del campo (clic afuera o Enter) para que el cambio se persista de verdad. */}
                {drafts[f.key] !== undefined && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">sin guardar</span>
                )}
              </label>
              <FieldInput
                field={f}
                value={f.type === "aspiration_name" ? (activeAspiration?.name ?? "") : draftValue(f.key)}
                onChange={(v) => updateDraft(f.key, v)}
                onBlur={() => commitValue(f.key)}
                readOnly={presenter}
              />
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
  function entryDraftValue(entry: Entry, key: string) {
    return entryDrafts[entry.id]?.[key] ?? (entry[key] as string) ?? "";
  }
  function updateEntryDraft(entryId: string, key: string, v: string) {
    setEntryDrafts((d) => ({ ...d, [entryId]: { ...d[entryId], [key]: v } }));
  }
  function commitEntryField(entryId: string, key: string) {
    const value = entryDrafts[entryId]?.[key];
    if (value === undefined) return;
    setEntryDrafts((d) => {
      if (!d[entryId]) return d;
      const inner = { ...d[entryId] };
      delete inner[key];
      return { ...d, [entryId]: inner };
    });
    const entry = content.entries.find((e) => e.id === entryId);
    if (entry && value !== ((entry[key] as string) ?? "")) {
      save({ ...content, entries: content.entries.map((e) => (e.id === entryId ? { ...e, [key]: value } : e)) });
    }
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
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    {f.label}
                    {entryDrafts[entry.id]?.[f.key] !== undefined && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">sin guardar</span>
                    )}
                  </label>
                  <FieldInput
                    field={f}
                    value={entryDraftValue(entry, f.key)}
                    onChange={(v) => updateEntryDraft(entry.id, f.key, v)}
                    onBlur={() => commitEntryField(entry.id, f.key)}
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
