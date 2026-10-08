"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useSubmission } from "@/lib/useSubmission";
import { supabase } from "@/lib/supabase";
import { aspClasses, findAspiration, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import { isPresenter } from "@/lib/presenter";
import { ActivityComponentProps, inputCls, textareaCls, btnPrimary, btnGhost, btnDanger, SaveIndicator, PresenterHint, uid } from "./shared";
import BscSocyaDiagram from "./BscSocyaDiagram";
import EjemploAdaptacionPerspectivas from "./EjemploAdaptacionPerspectivas";

// Diagramas estáticos de apoyo que una actividad "tarjeta_estructurada" puede pedir con
// config.diagram — un registro simple en vez de un dispatch de componente completo, porque son
// solo contenido visual fijo, no un modo de interacción distinto.
const DIAGRAMS: Record<string, ComponentType> = {
  bsc_socya_perspectives: BscSocyaDiagram,
};
// Mismo principio para el modal "💡 Ver ejemplo" (config.example) — igual patrón que EjemploQSPM
// dentro de PriorizacionQSPM.tsx: ventana flotante en la propia actividad, nunca otra pestaña.
const EXAMPLES: Record<string, ComponentType<{ onClose: () => void }>> = {
  adaptacion_perspectivas: EjemploAdaptacionPerspectivas,
};

// Meta candidata tal como la deja la Subasta de nuevas metas (VotacionFichas) — solo nos
// interesan las que ya ganaron fichas (puntos > 0), filtradas a la aspiración activa.
interface MetaCandidate {
  id: string;
  text: string;
  author: string;
  owner?: string;
  target_date?: string;
  aspiration_id?: number | null;
}
interface MetaVote {
  candidate_id: string;
  points: number;
}
interface MetaSourceContent {
  candidates?: MetaCandidate[];
  votes?: MetaVote[];
}
// Estrategia tal como la deja la Priorización QSPM (PriorizacionQSPM.tsx) — solo nos interesan
// el nombre y la descripción para precargar el registro del consenso final.
interface QspmStrategy {
  id: string;
  name: string;
  description?: string;
}

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
  // Meta de la Subasta (config.metasFrom) de la que nace este registro — opcional: un registro
  // creado con el botón genérico "+ {repeatLabel}" no queda ligado a ninguna. Varios registros
  // pueden compartir la misma meta_id (una meta puede dar más de un objetivo SMART).
  meta_id?: string;
  // Estrategia de la Priorización QSPM (config.qspmFrom) importada a este registro — se usa solo
  // para no duplicarla si se vuelve a pulsar "Importar" después de crear más estrategias en QSPM.
  qspm_strategy_id?: string;
  // Marca un registro como ejemplo ilustrativo precargado (p. ej. en "Cierre: pilares y valores
  // en acción") — se distingue con una insignia, pero el equipo lo puede editar o borrar igual
  // que cualquier otro.
  ejemplo?: boolean;
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
  const [draggingMetaId, setDraggingMetaId] = useState<string | null>(null);
  // Deben quedar ANTES del "if (!repeatable) return" de abajo — un hook después de un return
  // condicional cambia la cantidad de hooks entre modos y React revienta con el error #310 (ver
  // el mismo bug ya corregido en PriorizacionQSPM.tsx).
  const [unifying, setUnifying] = useState(false);
  const [unifyError, setUnifyError] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);

  // Metas de la Subasta (config.metasFrom, p. ej. "De aspiración a objetivos SMART" las toma de
  // "Subasta de nuevas metas"): se leen en vivo de esa otra submission compartida (aspiration_id
  // null, igual que SintesisEntorno.tsx lee el POAM) para poder arrastrarlas o seleccionarlas al
  // crear un registro nuevo.
  const metasFrom = activity.config.metasFrom as number | undefined;
  const [metaCandidates, setMetaCandidates] = useState<MetaCandidate[]>([]);
  const [metaVotes, setMetaVotes] = useState<MetaVote[]>([]);
  useEffect(() => {
    if (!metasFrom) return;
    let cancelled = false;
    async function fetchMetas() {
      const { data } = await supabase.from("submissions").select("content").eq("activity_id", metasFrom!).is("aspiration_id", null).maybeSingle();
      if (cancelled) return;
      const c = (data?.content as MetaSourceContent | null) ?? {};
      setMetaCandidates(c.candidates ?? []);
      setMetaVotes(c.votes ?? []);
    }
    fetchMetas();
    const channel = supabase
      .channel(`metas-${metasFrom}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${metasFrom}` }, () => fetchMetas())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [metasFrom]);
  const metaPoints = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const v of metaVotes) totals[v.candidate_id] = (totals[v.candidate_id] ?? 0) + v.points;
    return totals;
  }, [metaVotes]);

  // Estrategias de la Priorización QSPM (config.qspmFrom): se leen en vivo, una consulta por
  // aspiración (allí viven en submissions separadas, no en una compartida como las metas de la
  // Subasta), para poder importarlas de un clic como punto de partida del consenso final.
  const qspmFrom = activity.config.qspmFrom as number | undefined;
  const [qspmByAsp, setQspmByAsp] = useState<{ aspId: number; strategies: QspmStrategy[] }[]>([]);
  useEffect(() => {
    if (!qspmFrom || aspirations.length === 0) return;
    let cancelled = false;
    async function load() {
      const results = await Promise.all(
        aspirations.map(async (a) => {
          const { data } = await supabase.from("submissions").select("content").eq("activity_id", qspmFrom!).eq("aspiration_id", a.id).maybeSingle();
          const strategies = ((data?.content as { strategies?: QspmStrategy[] } | null)?.strategies ?? []).filter((s) => s.name?.trim());
          return { aspId: a.id, strategies };
        })
      );
      if (!cancelled) setQspmByAsp(results);
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`qspm-import-${qspmFrom}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${qspmFrom}` }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [qspmFrom, aspirations]);
  // Solo las metas que ya ganaron fichas (puntos > 0) y de la aspiración activa — una meta sin
  // votos no es todavía una meta oficial, no debería poder convertirse en objetivo SMART.
  const availableMetas = metaCandidates.filter((c) => c.aspiration_id === activeAspId && (metaPoints[c.id] ?? 0) > 0);
  function findMeta(id: string | undefined) {
    return id ? metaCandidates.find((c) => c.id === id) : undefined;
  }

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
        {Boolean(activity.config.example) && (
          <div className="flex justify-end">
            <button
              className="inline-flex items-center gap-1.5 rounded-md border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand-dark hover:bg-brand/20"
              onClick={() => setShowExample(true)}
            >
              💡 Ver ejemplo: cómo debería quedar
            </button>
          </div>
        )}
        {(() => {
          const Diagram = activity.config.diagram ? DIAGRAMS[activity.config.diagram as string] : undefined;
          return Diagram ? <Diagram /> : null;
        })()}
        {showExample &&
          (() => {
            const Example = EXAMPLES[activity.config.example as string];
            return Example ? <Example onClose={() => setShowExample(false)} /> : null;
          })()}
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

  function addEntry(metaId?: string) {
    const entry: Entry = { id: uid(), aspiration_id: submissionAspId };
    if (metaId) entry.meta_id = metaId;
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
  function importFromQspm() {
    const alreadyImported = new Set(content.entries.map((e) => e.qspm_strategy_id).filter(Boolean));
    const newEntries: Entry[] = [];
    for (const { aspId, strategies } of qspmByAsp) {
      const asp = aspirations.find((a) => a.id === aspId);
      for (const s of strategies) {
        if (alreadyImported.has(s.id)) continue;
        const entry: Entry = { id: uid(), aspiration_id: aspId, qspm_strategy_id: s.id };
        if (fields[0]) entry[fields[0].key] = s.description ? `${s.name}\n\n${s.description}` : s.name;
        if (fields[1]) entry[fields[1].key] = asp?.name ?? "";
        newEntries.push(entry);
      }
    }
    if (newEntries.length === 0) return;
    save(
      { ...content, entries: [...content.entries, ...newEntries] },
      { eventType: "registro", summary: `${participant.name} importó ${newEntries.length} estrategia(s) desde QSPM en "${activity.title}"` }
    );
  }

  // Unificar en un solo párrafo las estrategias ya ratificadas (config.allowUnify): un camino
  // automático sin IA (plantilla determinística, instantánea) y otro que redacta con un modelo de
  // lenguaje de verdad (vía /api/unificar-estrategia) — ambos guardan el resultado en el mismo
  // campo de texto, que el equipo puede editar a mano después.
  const UNIFIED_KEY = "unificada";
  function strategyInputsFromEntries(entries: Entry[]) {
    return entries.map((e) => ({
      aspiracion: fields[1] ? ((e[fields[1].key] as string) ?? "") : "",
      estrategia: fields[0] ? ((e[fields[0].key] as string) ?? "") : "",
    }));
  }
  function buildTemplateSummary(entries: Entry[]): string {
    const parts = strategyInputsFromEntries(entries)
      .filter((s) => s.estrategia.trim())
      .map((s) => `en ${s.aspiracion || "una de sus aspiraciones"}, mediante ${s.estrategia.trim().replace(/\.+$/, "").toLowerCase()}`);
    if (parts.length === 0) return "";
    return `La organización avanzará de forma simultánea en sus aspiraciones estratégicas: ${parts.join("; ")}.`;
  }
  function saveUnified(text: string) {
    setDrafts((d) => ({ ...d, [UNIFIED_KEY]: text }));
    save({ ...content, values: { ...content.values, [UNIFIED_KEY]: text } });
  }
  function applyTemplateSummary() {
    const text = buildTemplateSummary(realEntries);
    if (text) saveUnified(text);
  }
  async function unifyWithAI() {
    setUnifying(true);
    setUnifyError(null);
    try {
      const strategies = strategyInputsFromEntries(realEntries);
      const res = await fetch("/api/unificar-estrategia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategies }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      saveUnified(data.text as string);
    } catch (err) {
      setUnifyError(err instanceof Error ? err.message : "No se pudo generar el párrafo.");
    } finally {
      setUnifying(false);
    }
  }

  // Los registros marcados `ejemplo` (precargados, p. ej. en "Cierre: pilares y valores en
  // acción") se muestran aparte, como insignias compactas arriba de todo — no cuentan para el
  // mínimo ni se mezclan con los registros reales del equipo en la lista editable de abajo.
  const exampleEntries = content.entries.filter((e) => e.ejemplo);
  const realEntries = content.entries.filter((e) => !e.ejemplo);
  const minEntries = activity.config.minEntries as number | undefined;
  const metMinimum = minEntries !== undefined && realEntries.length >= minEntries;
  // Pluralizar "Objetivo SMART" agregando una "s" al final daría "objetivo smarts" — con
  // etiquetas de más de una palabra no basta una regla mecánica, así que la actividad puede
  // fijar el plural correcto explícitamente; a falta de eso, se usa el genérico "registros".
  const minEntriesLabel = (activity.config.minEntriesLabel as string) ?? "registros";
  const alreadyImportedIds = new Set(content.entries.map((e) => e.qspm_strategy_id).filter(Boolean));
  const pendingQspmCount = qspmByAsp.reduce((a, g) => a + g.strategies.filter((s) => !alreadyImportedIds.has(s.id)).length, 0);

  return (
    <div className="space-y-3">
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PresenterHint />
          <div className="flex flex-wrap items-center gap-2">
            {Boolean(qspmFrom) && (
              <button
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 transition-colors disabled:opacity-50"
                title="Traer como registros de partida las estrategias ya creadas en la Priorización QSPM"
                disabled={pendingQspmCount === 0}
                onClick={importFromQspm}
              >
                ⬇ Importar de QSPM{pendingQspmCount > 0 ? ` (${pendingQspmCount})` : ""}
              </button>
            )}
            {Boolean(activity.config.boardRoute) && (
              <button
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 transition-colors"
                title="Ver el tablero de resultados en una pestaña nueva"
                onClick={() => window.open(`/${activity.config.boardRoute}/${activity.id}`, "_blank", "noopener,noreferrer")}
              >
                ⛶ Ver tablero
              </button>
            )}
          </div>
        </div>
      )}
      {aspirationTabs}
      {exampleEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {exampleEntries.map((entry) => {
            const asp = findAspiration(aspirations, (entry.aspiration_id as number) ?? null);
            const cls = aspClasses(asp?.number);
            const titleValue = fields[0] ? (entry[fields[0].key] as string) : undefined;
            const bodyValue = fields[1] ? (entry[fields[1].key] as string) : undefined;
            return (
              <div key={entry.id} className={`max-w-[230px] rounded-lg border px-3 py-2 ${cls.border} ${cls.bgSoft}`}>
                <p className={`text-xs font-bold ${cls.text}`}>🧩 {titleValue || repeatLabel}</p>
                {bodyValue && <p className="mt-0.5 line-clamp-2 text-[11px] italic text-muted">{bodyValue}</p>}
              </div>
            );
          })}
        </div>
      )}
      {minEntries !== undefined && (
        <p className={`text-xs font-semibold ${metMinimum ? "text-brand-dark" : "text-muted"}`}>
          {realEntries.length} de {minEntries} {minEntriesLabel} {metMinimum ? "✅" : "— faltan por completar"}
        </p>
      )}
      {presenter && realEntries.length === 0 && (
        <p className="text-sm text-muted">Aún no hay registros. Cada equipo los agrega desde su propia sesión.</p>
      )}
      {metasFrom && !presenter && (
        <div className="rounded-lg border border-dashed border-brand/40 bg-brand/5 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-dark">
            🏷️ Metas de la Subasta con puntos — arrastra una sobre &quot;+ {repeatLabel}&quot;, o tócala para crear el objetivo directo
          </p>
          {availableMetas.length === 0 ? (
            <p className="text-xs text-muted">Todavía no hay metas con puntos para esta aspiración.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableMetas.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", m.id);
                    setDraggingMetaId(m.id);
                  }}
                  onDragEnd={() => setDraggingMetaId(null)}
                  onClick={() => addEntry(m.id)}
                  className="max-w-xs cursor-grab rounded-md border border-brand/40 bg-card px-3 py-2 text-left text-xs shadow-sm transition-transform hover:scale-[1.02] active:cursor-grabbing"
                  title="Arrastra sobre el botón de abajo, o toca para crear un objetivo con esta meta"
                >
                  <span className="block truncate font-semibold text-foreground">{m.text}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {metaPoints[m.id]} {metaPoints[m.id] === 1 ? "punto" : "puntos"}
                    {m.owner ? ` · ${m.owner}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {realEntries.map((entry) => {
        const asp = findAspiration(aspirations, (entry.aspiration_id as number) ?? null);
        const cls = aspClasses(asp?.number);
        const meta = findMeta(entry.meta_id);
        return (
          <div key={entry.id} className={`rounded-lg border-l-4 ${cls.border} border border-border bg-card p-3`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-muted">{repeatLabel}</span>
                {entry.ejemplo && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    🧩 Ejemplo
                  </span>
                )}
                {asp && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls.bgSoft} ${cls.text}`}>
                    Aspiración {asp.number}
                  </span>
                )}
              </div>
              {!presenter && (
                <button className={btnDanger} onClick={() => removeEntry(entry.id)}>
                  eliminar
                </button>
              )}
            </div>
            {meta && (
              <p className="mb-2 rounded-md bg-black/[0.03] px-2 py-1.5 text-xs text-muted">
                🏷️ Meta de la subasta: <span className="font-medium text-foreground">{meta.text}</span>
              </p>
            )}
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
        <button
          className={`${btnPrimary} ${draggingMetaId ? "ring-2 ring-brand ring-offset-2" : ""}`}
          onClick={() => addEntry()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("text/plain");
            addEntry(id || undefined);
            setDraggingMetaId(null);
          }}
        >
          + {repeatLabel}
        </button>
      )}

      {presenter && Boolean(activity.config.allowUnify) && (
        <div className="rounded-lg border border-dashed border-brand/40 bg-brand/5 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">🌐 Estrategia corporativa unificada</p>
            <div className="flex flex-wrap gap-2">
              <button className={btnGhost} disabled={realEntries.length === 0} onClick={applyTemplateSummary} title="Arma un borrador instantáneo sin IA, uniendo las estrategias con una estructura fija">
                📝 Borrador automático
              </button>
              <button className={btnPrimary} disabled={realEntries.length === 0 || unifying} onClick={unifyWithAI} title="Redacta un párrafo con un modelo de lenguaje real, a partir de las estrategias ratificadas">
                {unifying ? "Redactando…" : "🪄 Unificar con IA"}
              </button>
            </div>
          </div>
          {realEntries.length === 0 && <p className="mb-2 text-xs text-muted">Agrega al menos una estrategia ratificada para poder unificarlas.</p>}
          {unifyError && <p className="mb-2 text-xs text-red-600">{unifyError}</p>}
          <textarea
            className={textareaCls + " min-h-24"}
            placeholder="Pulsa uno de los botones de arriba, o redacta aquí mismo el párrafo unificado…"
            value={drafts[UNIFIED_KEY] ?? content.values[UNIFIED_KEY] ?? ""}
            onChange={(e) => setDrafts((d) => ({ ...d, [UNIFIED_KEY]: e.target.value }))}
            onBlur={() => {
              const value = drafts[UNIFIED_KEY];
              if (value === undefined) return;
              if (value !== (content.values[UNIFIED_KEY] ?? "")) save({ ...content, values: { ...content.values, [UNIFIED_KEY]: value } });
            }}
          />
        </div>
      )}

      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
