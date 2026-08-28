"use client";

import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { isPresenter } from "@/lib/presenter";
import { ActivityComponentProps, inputCls, textareaCls, btnPrimary, btnDanger, SaveIndicator, PresenterHint, uid } from "./shared";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "date";
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
  if (field.type === "textarea") {
    return <textarea className={textareaCls} placeholder={field.label} value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <input
      type={field.type === "date" ? "date" : "text"}
      className={inputCls}
      placeholder={field.label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function TarjetaEstructurada({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const fields = (activity.config.fields as FieldDef[]) ?? [];
  const repeatable = Boolean(activity.config.repeatable);
  const repeatLabel = (activity.config.repeatLabel as string) ?? "Registro";
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { entries: [], values: {} }
  );

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  if (!repeatable) {
    function setValue(key: string, v: string) {
      save({ ...content, values: { ...content.values, [key]: v } });
    }
    return (
      <div className="space-y-3">
        {presenter && <PresenterHint />}
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
              <label className="mb-1 block text-xs font-medium text-muted">{f.label}</label>
              <FieldInput field={f} value={content.values[f.key] ?? ""} onChange={(v) => setValue(f.key, v)} readOnly={presenter} />
            </div>
          ))}
        </div>
        <SaveIndicator saving={saving} updatedAt={updatedAt} />
      </div>
    );
  }

  function addEntry() {
    const entry: Entry = { id: uid(), aspiration_id: participant.aspiration_id };
    save({ ...content, entries: [...content.entries, entry] }, { eventType: "registro", summary: `${participant.name} agregó "${repeatLabel}" en "${activity.title}"` });
  }
  function setEntryField(id: string, key: string, v: string) {
    save({ ...content, entries: content.entries.map((e) => (e.id === id ? { ...e, [key]: v } : e)) });
  }
  function removeEntry(id: string) {
    save({ ...content, entries: content.entries.filter((e) => e.id !== id) });
  }

  return (
    <div className="space-y-3">
      {presenter && <PresenterHint />}
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
      <SaveIndicator saving={saving} updatedAt={updatedAt} />
    </div>
  );
}
