"use client";

import { useEffect, useRef, useState } from "react";
import { useSubmission, fetchLatestContent } from "@/lib/useSubmission";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import { isPresenter } from "@/lib/presenter";
import { supabase } from "@/lib/supabase";
import BarChart from "@/components/charts/BarChart";
import {
  ActivityComponentProps,
  inputCls,
  textareaCls,
  btnPrimary,
  SaveIndicator,
  PresenterHint,
  ToggleSwitch,
  DeleteButton,
  uid,
} from "./shared";

interface SourceRow {
  id: string;
  factor: string;
  peso: number;
  aspiration_id: number | null;
}
interface DofaSelection {
  id: string;
  quadrant: "FO" | "DO" | "FA" | "DA";
  factorAId: string;
  factorBId: string;
  custom?: { textA: string; textB: string };
}
interface CustomFactor {
  id: string;
  factor: string;
  peso: number;
}
interface Strategy {
  id: string;
  name: string;
  // Texto de los factores y/o cruces DOFA con los que se creó — solo para mostrar "Basada en…"
  // en la tabla de calificación y evitar que la gente se confunda calificando sin saber de dónde
  // salió cada estrategia. No afecta el cálculo (igual se califica frente a todos los factores
  // activos, como exige la metodología QSPM).
  originLabels?: string[];
}
interface Content extends Record<string, unknown> {
  activeKeys: string[];
  customFactors: CustomFactor[];
  strategies: Strategy[];
  ratings: Record<string, Record<string, number>>;
}

const DEFAULT_RATING_LABELS = [
  { value: 1, label: "No atractiva" },
  { value: 2, label: "Algo atractiva" },
  { value: 3, label: "Razonablemente atractiva" },
  { value: 4, label: "Altamente atractiva" },
];

const QUADRANT_LABEL: Record<DofaSelection["quadrant"], string> = {
  FO: "FO",
  DO: "DO",
  FA: "FA",
  DA: "DA",
};

// La priorización QSPM ya no se llena a mano desde cero: los factores clave (EFI/EFE) y las
// estrategias candidatas (cruces del DOFA cruzado) ya existen en otras actividades de esta misma
// aspiración — aquí solo se activan (igual que el check del DOFA cruzado) y, por cada factor o
// cruce activado, se puede crear de inmediato la estrategia correspondiente para calificarla.
export default function PriorizacionQSPM({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const [efiFrom, efeFrom, dofaFrom] = (activity.config.inputsFrom as number[]) ?? [];
  const scaleMax = (activity.config.scaleMax as number) ?? 4;
  const ratingLabels = (activity.config.ratingLabels as { value: number; label: string }[] | undefined) ?? DEFAULT_RATING_LABELS;
  const presenter = isPresenter(participant);
  const [activeAspId, setActiveAspId] = useState<number | null>(() => aspirations[0]?.id ?? null);
  useEffect(() => {
    if (activeAspId === null && aspirations.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveAspId(aspirations[0].id);
    }
  }, [aspirations, activeAspId]);

  const [efiRows, setEfiRows] = useState<SourceRow[]>([]);
  const [efeRows, setEfeRows] = useState<SourceRow[]>([]);
  const [dofaSelections, setDofaSelections] = useState<DofaSelection[]>([]);
  const [dofaFactorText, setDofaFactorText] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (activeAspId === null) return;
    async function load() {
      const [efi, efe, dofa] = await Promise.all([
        supabase.from("submissions").select("content").eq("activity_id", efiFrom).eq("aspiration_id", activeAspId).maybeSingle(),
        supabase.from("submissions").select("content").eq("activity_id", efeFrom).eq("aspiration_id", activeAspId).maybeSingle(),
        dofaFrom
          ? supabase.from("submissions").select("content").eq("activity_id", dofaFrom).eq("aspiration_id", activeAspId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const efiR = ((efi.data?.content as { rows?: SourceRow[] } | null)?.rows ?? []).filter((r) => r.factor.trim());
      const efeR = ((efe.data?.content as { rows?: SourceRow[] } | null)?.rows ?? []).filter((r) => r.factor.trim());
      setEfiRows(efiR);
      setEfeRows(efeR);
      setDofaFactorText(new Map([...efiR, ...efeR].map((r) => [r.id, r.factor])));
      setDofaSelections(((dofa?.data?.content as { selections?: DofaSelection[] } | null)?.selections ?? []));
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`qspm-fuentes-${activity.id}-${activeAspId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${efiFrom}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${efeFrom}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${dofaFrom}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeAspId, efiFrom, efeFrom, dofaFrom, activity.id]);

  const emptyContent: Content = { activeKeys: [], customFactors: [], strategies: [], ratings: {} };
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    activeAspId,
    participant,
    emptyContent
  );
  const [newFactorDraft, setNewFactorDraft] = useState({ factor: "", peso: "" });
  const [newStrategyName, setNewStrategyName] = useState("");
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [focusStrategyId, setFocusStrategyId] = useState<string | null>(null);
  // Selección temporal (solo de este navegador, no se guarda) para armar UNA estrategia a partir
  // de uno o varios factores/cruces marcados — separa "elegir con qué se arma la estrategia" de
  // "activar un factor para que cuente en la calificación", que antes vivían en el mismo botón y
  // generaban confusión sobre qué se estaba haciendo.
  const [selectedFactorKeys, setSelectedFactorKeys] = useState<Set<string>>(new Set());
  const [selectedDofaIds, setSelectedDofaIds] = useState<Set<string>>(new Set());
  // Modo alterno: en vez de marcar primero y crear al final, se crea la estrategia (vacía)
  // primero y queda como "destino" — cada check que marques después se vincula de una vez a ESA
  // estrategia, y puedes repetir el ciclo (otra estrategia vacía, volver a marcar) varias veces.
  const [targetStrategyId, setTargetStrategyId] = useState<string | null>(null);
  const strategyInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  // Dos clics casi simultáneos (p. ej. doble clic sin querer en "+ Crear estrategia") disparaban
  // dos lecturas concurrentes del mismo estado "latest", y el segundo guardado podía pisar al
  // primero — se encadenan todas las mutaciones de este cliente para que cada una lea el
  // resultado de la anterior en vez de partir del mismo punto de partida obsoleto.
  const mutateChain = useRef<Promise<void>>(Promise.resolve());

  // Debe quedar ANTES del "if (!loaded) return" de abajo — un hook después de un return
  // condicional cambia la cantidad de hooks entre el render de "Cargando…" y el real, y React
  // revienta con el error #310 (rompió toda la página en producción).
  useEffect(() => {
    if (!focusStrategyId) return;
    const el = strategyInputRefs.current[focusStrategyId];
    if (el) {
      el.focus();
      el.select();
      setFocusStrategyId(null);
    }
  }, [focusStrategyId, content.strategies]);

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  function mutateContent(fn: (latest: Content) => Content) {
    const run = mutateChain.current.then(async () => {
      const latest = await fetchLatestContent<Content>(activity.id, activeAspId, emptyContent);
      await save(fn(latest));
    });
    mutateChain.current = run.catch(() => {});
    return run;
  }

  function toggleFactor(key: string) {
    mutateContent((latest) => ({
      ...latest,
      activeKeys: latest.activeKeys.includes(key) ? latest.activeKeys.filter((k) => k !== key) : [...latest.activeKeys, key],
    }));
  }
  function addCustomFactor() {
    const factor = newFactorDraft.factor.trim();
    const peso = Number(newFactorDraft.peso) || 0;
    if (!factor) return;
    const id = uid();
    mutateContent((latest) => ({
      ...latest,
      customFactors: [...latest.customFactors, { id, factor, peso }],
      activeKeys: [...latest.activeKeys, `custom:${id}`],
    }));
    setNewFactorDraft({ factor: "", peso: "" });
  }
  function removeCustomFactor(id: string) {
    mutateContent((latest) => {
      const ratings = { ...latest.ratings };
      delete ratings[`custom:${id}`];
      return {
        ...latest,
        customFactors: latest.customFactors.filter((f) => f.id !== id),
        activeKeys: latest.activeKeys.filter((k) => k !== `custom:${id}`),
        ratings,
      };
    });
  }
  function createStrategy(name: string, originLabels?: string[]) {
    const id = uid();
    mutateContent((latest) => ({ ...latest, strategies: [...latest.strategies, { id, name: name.trim(), originLabels }] }));
    // El nombre autogenerado (desde un factor o un cruce DOFA) es solo un punto de partida, no
    // una redacción final de estrategia — se enfoca y selecciona todo el texto para invitar a
    // reescribirlo de una vez, en vez de obligar a borrarlo a mano antes de poder escribir.
    setFocusStrategyId(id);
    return id;
  }
  function addStrategy(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    createStrategy(trimmed);
  }
  // Modo alterno a "marcar y crear": una estrategia vacía queda como destino, y cada check que
  // marques después se vincula de inmediato a ella — útil cuando el equipo primero acuerda el
  // nombre de la estrategia y luego revisa qué factores la justifican.
  function addEmptyStrategyAsTarget() {
    const id = createStrategy("", []);
    setTargetStrategyId(id);
  }
  function toggleItemForTarget(label: string) {
    if (!targetStrategyId) return;
    mutateContent((latest) => ({
      ...latest,
      strategies: latest.strategies.map((s) => {
        if (s.id !== targetStrategyId) return s;
        const origins = s.originLabels ?? [];
        return { ...s, originLabels: origins.includes(label) ? origins.filter((o) => o !== label) : [...origins, label] };
      }),
    }));
  }
  function toggleFactorSelection(key: string) {
    setSelectedFactorKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  function toggleDofaSelection(id: string) {
    setSelectedDofaIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function dofaSuggestionText(s: DofaSelection) {
    const textA = s.custom ? s.custom.textA : dofaFactorText.get(s.factorAId) ?? "—";
    const textB = s.custom ? s.custom.textB : dofaFactorText.get(s.factorBId) ?? "—";
    return `${textA} + ${textB}`;
  }
  function createStrategyFromSelection() {
    const factorLabels = allFactors.filter((f) => selectedFactorKeys.has(f.key)).map((f) => f.factor);
    const dofaLabels = dofaSelections.filter((s) => selectedDofaIds.has(s.id)).map(dofaSuggestionText);
    const originLabels = [...factorLabels, ...dofaLabels];
    if (originLabels.length === 0) return;
    const name = factorLabels.length === 0 && dofaLabels.length === 1 ? dofaLabels[0] : `Estrategia para: ${originLabels.join(" + ")}`;
    createStrategy(name, originLabels);
    setSelectedFactorKeys(new Set());
    setSelectedDofaIds(new Set());
  }
  function renameStrategy(id: string, name: string) {
    mutateContent((latest) => ({ ...latest, strategies: latest.strategies.map((s) => (s.id === id ? { ...s, name } : s)) }));
  }
  function commitStrategyName(s: Strategy) {
    const value = nameDrafts[s.id];
    setNameDrafts((d) => {
      const next = { ...d };
      delete next[s.id];
      return next;
    });
    if (value !== undefined && value !== s.name) renameStrategy(s.id, value);
  }
  function removeStrategy(id: string) {
    mutateContent((latest) => {
      const ratings: Content["ratings"] = {};
      for (const [fk, row] of Object.entries(latest.ratings)) {
        const rest = { ...row };
        delete rest[id];
        ratings[fk] = rest;
      }
      return { ...latest, strategies: latest.strategies.filter((s) => s.id !== id), ratings };
    });
    setTargetStrategyId((cur) => (cur === id ? null : cur));
  }
  function setRating(factorKey: string, strategyId: string, value: number) {
    mutateContent((latest) => ({
      ...latest,
      ratings: { ...latest.ratings, [factorKey]: { ...(latest.ratings[factorKey] ?? {}), [strategyId]: value } },
    }));
  }

  const allFactors = [
    ...efiRows.map((r) => ({ key: `efi:${r.id}`, factor: r.factor, peso: r.peso, origin: "EFI", custom: false })),
    ...efeRows.map((r) => ({ key: `efe:${r.id}`, factor: r.factor, peso: r.peso, origin: "EFE", custom: false })),
    ...content.customFactors.map((c) => ({ key: `custom:${c.id}`, factor: c.factor, peso: c.peso, origin: "Personalizado", custom: true, customId: c.id })),
  ];
  const activeFactors = allFactors.filter((f) => content.activeKeys.includes(f.key));
  const totals = content.strategies.map((s) => ({
    id: s.id,
    name: s.name,
    total: activeFactors.reduce((a, f) => a + f.peso * (content.ratings[f.key]?.[s.id] ?? 0), 0),
  }));
  const ranked = [...totals].sort((a, b) => b.total - a.total);
  const canEdit = !presenter;
  const targetStrategy = content.strategies.find((s) => s.id === targetStrategyId) ?? null;
  function isChecked(label: string, selectionHas: boolean) {
    return targetStrategy ? (targetStrategy.originLabels ?? []).includes(label) : selectionHas;
  }
  function onCheckChange(label: string, toggleSelection: () => void) {
    if (targetStrategy) toggleItemForTarget(label);
    else toggleSelection();
  }

  return (
    <div className="space-y-4">
      {presenter && <PresenterHint />}

      {aspirations.length > 0 && (
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
      )}

      <div className="rounded-lg border border-border bg-black/[0.02] p-3 text-xs text-muted">
        <p className="font-semibold text-foreground">¿Cómo funciona?</p>
        <p className="mt-1">
          1) Activa (interruptor) los factores clave (EFI/EFE) que de verdad definen si una estrategia es viable — eso es
          independiente de crear estrategias. 2) Dos formas de crear una estrategia: (a) marca con el check ☑ uno o varios
          factores/cruces DOFA y pulsa <b>&quot;Crear estrategia con la selección&quot;</b>, o (b) pulsa{" "}
          <b>&quot;+ Nueva estrategia&quot;</b> primero, escribe el nombre, y luego marca los factores que la justifican —
          puedes repetir cualquiera de las dos cuantas veces necesites. 3) Califica qué tan atractiva es cada estrategia
          frente a cada factor activo (1 a {scaleMax}). El puntaje ponderado (peso × calificación) arma el ranking final.
        </p>
        <p className="mt-1 italic">
          Ejemplo: si el factor <b>&quot;Alianzas territoriales consolidadas&quot;</b> (peso 0.15) es clave para la estrategia{" "}
          <b>&quot;Fortalecer alianzas con cooperación internacional&quot;</b> y la calificas como Altamente atractiva (4), aporta
          0.15 × 4 = 0.60 al puntaje de esa estrategia.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Factores clave (EFI / EFE)</p>
        <div className="space-y-1.5">
          {allFactors
            .filter((f) => !f.custom)
            .map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card p-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {content.activeKeys.includes(f.key) && (
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-brand"
                      checked={isChecked(f.factor, selectedFactorKeys.has(f.key))}
                      onChange={() => onCheckChange(f.factor, () => toggleFactorSelection(f.key))}
                      title={targetStrategy ? `Vincular a "${targetStrategy.name || "(sin nombre)"}"` : "Marcar para incluir en la próxima estrategia"}
                    />
                  )}
                  <span className="mr-1.5 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-bold text-muted">{f.origin}</span>
                  <span className="text-sm text-foreground">{f.factor}</span>
                  <span className="ml-1.5 text-xs text-muted">(peso {f.peso.toFixed(2)})</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ToggleSwitch checked={content.activeKeys.includes(f.key)} onChange={() => toggleFactor(f.key)} label="Activar" />
                </div>
              </div>
            ))}
          {allFactors.filter((f) => !f.custom).length === 0 && (
            <p className="text-sm text-muted">Aún no hay factores en la Matriz EFI/EFE de esta aspiración.</p>
          )}
        </div>

        {content.customFactors.length > 0 && (
          <div className="space-y-1.5">
            {content.customFactors.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card p-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-brand"
                    checked={isChecked(c.factor, selectedFactorKeys.has(`custom:${c.id}`))}
                    onChange={() => onCheckChange(c.factor, () => toggleFactorSelection(`custom:${c.id}`))}
                    title={targetStrategy ? `Vincular a "${targetStrategy.name || "(sin nombre)"}"` : "Marcar para incluir en la próxima estrategia"}
                  />
                  <span className="mr-1.5 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-bold text-muted">Personalizado</span>
                  <span className="text-sm text-foreground">{c.factor}</span>
                  <span className="ml-1.5 text-xs text-muted">(peso {c.peso.toFixed(2)})</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canEdit && <DeleteButton label="quitar" onConfirm={() => removeCustomFactor(c.id)} />}
                </div>
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border p-2">
            <input
              className={inputCls + " flex-1"}
              placeholder="Otro factor clave… (p. ej. Reputación institucional)"
              value={newFactorDraft.factor}
              onChange={(e) => setNewFactorDraft((d) => ({ ...d, factor: e.target.value }))}
            />
            <input
              type="number"
              step="0.01"
              min={0}
              max={1}
              className={inputCls + " w-24"}
              placeholder="Peso"
              value={newFactorDraft.peso}
              onChange={(e) => setNewFactorDraft((d) => ({ ...d, peso: e.target.value }))}
            />
            <button className={btnPrimary} onClick={addCustomFactor}>
              + Agregar factor
            </button>
          </div>
        )}
      </div>

      {dofaSelections.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">Cruces del DOFA cruzado (sugerencias de estrategia)</p>
          <div className="flex flex-wrap gap-2">
            {dofaSelections.map((s) => {
              const suggestion = dofaSuggestionText(s);
              const checked = isChecked(suggestion, selectedDofaIds.has(s.id));
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`flex max-w-xs items-start gap-2 rounded-lg border p-2 text-left text-xs transition-colors ${
                    checked ? "border-brand bg-brand/10" : "border-border bg-card hover:bg-black/5"
                  }`}
                  title={targetStrategy ? `Vincular a "${targetStrategy.name || "(sin nombre)"}"` : "Marcar para incluir en la próxima estrategia"}
                  onClick={() => onCheckChange(suggestion, () => toggleDofaSelection(s.id))}
                >
                  <input type="checkbox" readOnly checked={checked} className="mt-0.5 h-4 w-4 shrink-0 accent-brand" />
                  <span>
                    <span className="mr-1 rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-dark">
                      {QUADRANT_LABEL[s.quadrant]}
                    </span>
                    {suggestion}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {canEdit && targetStrategy && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand bg-brand/10 p-3">
          <span className="text-sm font-semibold text-brand-dark">
            Vinculando checks a: &quot;{targetStrategy.name || "(sin nombre)"}&quot; · {(targetStrategy.originLabels ?? []).length}{" "}
            {(targetStrategy.originLabels ?? []).length === 1 ? "vinculado" : "vinculados"}
          </span>
          <button className="text-xs font-semibold text-brand-dark hover:underline" onClick={() => setTargetStrategyId(null)}>
            terminar y dejar de vincular
          </button>
        </div>
      )}

      {canEdit && !targetStrategy && (selectedFactorKeys.size > 0 || selectedDofaIds.size > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand bg-brand/10 p-3">
          <span className="text-sm font-semibold text-brand-dark">
            {selectedFactorKeys.size + selectedDofaIds.size} {selectedFactorKeys.size + selectedDofaIds.size === 1 ? "elemento marcado" : "elementos marcados"}
          </span>
          <button className={btnPrimary} onClick={createStrategyFromSelection}>
            + Crear estrategia con la selección
          </button>
          <button
            className="text-xs text-muted hover:underline"
            onClick={() => {
              setSelectedFactorKeys(new Set());
              setSelectedDofaIds(new Set());
            }}
          >
            limpiar selección
          </button>
        </div>
      )}

      {canEdit && !targetStrategy && selectedFactorKeys.size === 0 && selectedDofaIds.size === 0 && (
        <div>
          <button className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5" onClick={addEmptyStrategyAsTarget}>
            + Nueva estrategia (y marcar sus factores después)
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Estrategias y calificación</p>
        {activeFactors.length === 0 ? (
          <p className="text-sm text-muted">Activa al menos un factor arriba para poder calificar estrategias.</p>
        ) : content.strategies.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay estrategias. Marca uno o varios factores/cruces arriba y crea la primera.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-black/[0.03]">
                <tr>
                  <th className="p-2 text-left font-medium">Factor (peso)</th>
                  {content.strategies.map((s) => (
                    <th key={s.id} className="p-2 text-left font-medium min-w-72">
                      {canEdit ? (
                        <textarea
                          ref={(el) => {
                            strategyInputRefs.current[s.id] = el;
                          }}
                          className={textareaCls + " min-h-12 text-sm font-normal"}
                          rows={2}
                          value={nameDrafts[s.id] ?? s.name}
                          placeholder="p. ej. Fortalecer alianzas territoriales (FO)"
                          onChange={(e) => setNameDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                          onBlur={() => commitStrategyName(s)}
                        />
                      ) : (
                        <span className="text-foreground">{s.name}</span>
                      )}
                      {s.originLabels && s.originLabels.length > 0 && (
                        <p className="mt-1 truncate text-[11px] font-normal italic text-muted" title={s.originLabels.join(" + ")}>
                          Basada en: {s.originLabels.join(" + ")}
                        </p>
                      )}
                      {canEdit && (
                        <div className="mt-1 flex items-center gap-2">
                          <button
                            className={`text-xs hover:underline ${targetStrategyId === s.id ? "font-semibold text-brand-dark" : "text-muted"}`}
                            onClick={() => setTargetStrategyId(targetStrategyId === s.id ? null : s.id)}
                          >
                            {targetStrategyId === s.id ? "✓ vinculando…" : "🔗 vincular factores"}
                          </button>
                          <DeleteButton label="quitar" onConfirm={() => removeStrategy(s.id)} />
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeFactors.map((f) => (
                  <tr key={f.key} className="border-t border-border">
                    <td className="p-2">
                      <span className="mr-1 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-bold text-muted">{f.origin}</span>
                      {f.factor} <span className="text-xs text-muted">({f.peso.toFixed(2)})</span>
                    </td>
                    {content.strategies.map((s) => (
                      <td key={s.id} className="p-2">
                        <select
                          className={inputCls}
                          disabled={presenter}
                          value={content.ratings[f.key]?.[s.id] ?? ""}
                          onChange={(e) => setRating(f.key, s.id, Number(e.target.value))}
                        >
                          <option value="">—</option>
                          {ratingLabels.map((rl) => (
                            <option key={rl.value} value={rl.value}>
                              {rl.value} — {rl.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-border bg-black/[0.03] font-semibold">
                  <td className="p-2">Puntaje total ponderado</td>
                  {content.strategies.map((s) => (
                    <td key={s.id} className="p-2">
                      {(totals.find((t) => t.id === s.id)?.total ?? 0).toFixed(2)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {canEdit && (
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="Agregar otra estrategia a mano…"
              value={newStrategyName}
              onChange={(e) => setNewStrategyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addStrategy(newStrategyName);
                  setNewStrategyName("");
                }
              }}
            />
            <button
              className={btnPrimary}
              onClick={() => {
                addStrategy(newStrategyName);
                setNewStrategyName("");
              }}
            >
              + Agregar
            </button>
          </div>
        )}
      </div>

      {ranked.length > 0 && (
        <div className="rounded-md bg-black/[0.03] p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Ranking</p>
          <BarChart bars={ranked.map((r) => ({ label: r.name || "(sin nombre)", value: Number(r.total.toFixed(2)), colorClass: "bg-brand" }))} />
        </div>
      )}

      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} sticky />
    </div>
  );
}
