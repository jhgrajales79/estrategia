"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSubmission, fetchLatestContent } from "@/lib/useSubmission";
import { isPresenter } from "@/lib/presenter";
import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import { ActivityComponentProps, inputCls, btnGhost, SaveIndicator, PresenterHint, ToggleSwitch, DeleteButton, uid } from "./shared";

// Factor tal como lo deja la Matriz EFI (fortaleza/debilidad) o EFE (oportunidad/amenaza) —
// mismo shape que ambas usan en su `content.rows[]`.
interface SourceFactor {
  id: string;
  factor: string;
  category: "fortaleza" | "debilidad" | "oportunidad" | "amenaza";
  aspiration_id: number | null;
}

interface Selection {
  // Para un cruce AUTOGENERADO, id es determinístico `${quadrant}:${factorAId}:${factorBId}` —
  // así marcar/desmarcar el mismo cruce desde dos navegadores a la vez no crea duplicados. Para
  // una opción PERSONALIZADA (ver `custom`), es un uid() normal: no referencia ningún factor de
  // la EFI/EFE, así que no hay con qué coincidir.
  id: string;
  quadrant: "FO" | "DO" | "FA" | "DA";
  factorAId: string;
  factorBId: string;
  note?: string;
  // Cruce escrito a mano por el equipo, además de los que se generan automáticamente — guarda
  // su propio texto en vez de buscarlo en la lista de factores de la EFI/EFE.
  custom?: { textA: string; textB: string };
}
interface Content extends Record<string, unknown> {
  selections: Selection[];
}

const QUADRANT_META: Record<Selection["quadrant"], { label: string; a: string; b: string }> = {
  FO: { label: "FO — Fortalezas + Oportunidades", a: "fortaleza", b: "oportunidad" },
  DO: { label: "DO — Debilidades + Oportunidades", a: "debilidad", b: "oportunidad" },
  FA: { label: "FA — Fortalezas + Amenazas", a: "fortaleza", b: "amenaza" },
  DA: { label: "DA — Debilidades + Amenazas", a: "debilidad", b: "amenaza" },
};

// DOFA cruzado con generación automática: en vez de escribir cada estrategia a mano, se cruzan
// TODAS las fortalezas/debilidades (EFI) con TODAS las oportunidades/amenazas (EFE) de la
// aspiración activa, y el equipo solo marca con un check cuáles cruces valen la pena perseguir
// — con un campo opcional para redactar la estrategia resultante una vez marcado.
export default function DofaCruzado({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const presenter = isPresenter(participant);
  const efiFrom = activity.config.efiFrom as number;
  const efeFrom = activity.config.efeFrom as number;
  // Tabs locales por aspiración (igual que MatrizPonderada/TarjetaEstructurada): no hay
  // asignación real de aspiración por participante, así que cada subgrupo elige su pestaña.
  const [activeAspId, setActiveAspId] = useState<number | null>(() => aspirations[0]?.id ?? null);
  useEffect(() => {
    if (activeAspId === null && aspirations.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveAspId(aspirations[0].id);
    }
  }, [aspirations, activeAspId]);

  const emptyContent: Content = { selections: [] };
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    activeAspId,
    participant,
    emptyContent
  );
  const [factors, setFactors] = useState<SourceFactor[]>([]);
  const [factorsLoaded, setFactorsLoaded] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Borrador de la opción personalizada en curso, por cuadrante — dos campos de texto libre
  // (uno por lado del cruce) que no dependen de ningún factor ya cargado en la EFI/EFE.
  const [customDraft, setCustomDraft] = useState<Record<string, { textA: string; textB: string }>>({});

  useEffect(() => {
    if (activeAspId === null) return;
    let cancelled = false;
    async function loadFactors() {
      setFactorsLoaded(false);
      const [efi, efe] = await Promise.all([
        supabase.from("submissions").select("content").eq("activity_id", efiFrom).eq("aspiration_id", activeAspId).maybeSingle(),
        supabase.from("submissions").select("content").eq("activity_id", efeFrom).eq("aspiration_id", activeAspId).maybeSingle(),
      ]);
      if (cancelled) return;
      const efiRows = ((efi.data?.content as { rows?: SourceFactor[] } | null)?.rows ?? []).filter(
        (r) => r.category === "fortaleza" || r.category === "debilidad"
      );
      const efeRows = ((efe.data?.content as { rows?: SourceFactor[] } | null)?.rows ?? []).filter(
        (r) => r.category === "oportunidad" || r.category === "amenaza"
      );
      setFactors([...efiRows, ...efeRows]);
      setFactorsLoaded(true);
    }
    loadFactors();
    const channel = supabase
      .channel(`dofa-cruzado-fuentes-${activity.id}-${activeAspId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${efiFrom}` }, () => loadFactors())
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${efeFrom}` }, () => loadFactors())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeAspId, efiFrom, efeFrom, activity.id]);

  if (!loaded || !factorsLoaded) return <p className="text-sm text-muted">Cargando…</p>;

  // Varias personas de la misma aspiración pueden marcar cruces casi al mismo tiempo — releer
  // la fila más reciente antes de guardar evita que un check se pierda si dos marcan a la vez.
  async function mutateContent(fn: (latest: Content) => Content, opts?: { eventType?: string; summary?: string }) {
    const latest = await fetchLatestContent<Content>(activity.id, activeAspId, emptyContent);
    await save(fn(latest), opts);
  }

  function toggleSelection(sel: Omit<Selection, "note">) {
    mutateContent((latest) => {
      const exists = latest.selections.some((s) => s.id === sel.id);
      return {
        selections: exists ? latest.selections.filter((s) => s.id !== sel.id) : [...latest.selections, sel],
      };
    }, { eventType: "cruce", summary: `${participant.name} marcó un cruce ${sel.quadrant} en "${activity.title}"` });
  }

  function addCustom(q: Selection["quadrant"]) {
    const draft = customDraft[q];
    const textA = (draft?.textA ?? "").trim();
    const textB = (draft?.textB ?? "").trim();
    if (!textA || !textB) return;
    const sel: Selection = { id: uid(), quadrant: q, factorAId: "", factorBId: "", custom: { textA, textB } };
    mutateContent((latest) => ({ selections: [...latest.selections, sel] }), {
      eventType: "cruce",
      summary: `${participant.name} agregó una opción personalizada ${q} en "${activity.title}"`,
    });
    setCustomDraft((d) => ({ ...d, [q]: { textA: "", textB: "" } }));
  }
  function removeCustom(selectionId: string) {
    mutateContent((latest) => ({ selections: latest.selections.filter((s) => s.id !== selectionId) }));
  }

  function commitNote(selectionId: string) {
    const value = drafts[selectionId];
    if (value === undefined) return;
    setDrafts((d) => {
      const next = { ...d };
      delete next[selectionId];
      return next;
    });
    mutateContent((latest) => ({
      selections: latest.selections.map((s) => (s.id === selectionId ? { ...s, note: value } : s)),
    }));
  }

  const selectedIds = new Set(content.selections.map((s) => s.id));
  const totalSelected = content.selections.length;

  return (
    <div className="space-y-4">
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PresenterHint />
          {Boolean(activity.config.boardRoute) && (
            <button
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 transition-colors"
              title="Ver los cruces marcados en una pestaña nueva"
              onClick={() => window.open(`/${activity.config.boardRoute}/${activity.id}`, "_blank", "noopener,noreferrer")}
            >
              ⛶ Ver tablero
            </button>
          )}
        </div>
      )}
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
      <p className="text-xs text-muted">
        {totalSelected} {totalSelected === 1 ? "cruce marcado" : "cruces marcados"} de esta aspiración — generados automáticamente desde las
        Matrices EFI y EFE, solo marca los que valgan la pena.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(QUADRANT_META) as Selection["quadrant"][]).map((q) => {
          const meta = QUADRANT_META[q];
          const sideA = factors.filter((f) => f.category === meta.a);
          const sideB = factors.filter((f) => f.category === meta.b);
          const crosses = sideA.flatMap((a) => sideB.map((b) => ({ a, b, id: `${q}:${a.id}:${b.id}` })));
          const customSelections = content.selections.filter((s) => s.quadrant === q && s.custom);
          const draft = customDraft[q] ?? { textA: "", textB: "" };
          return (
            <div key={q} className="rounded-lg border border-border bg-card p-3">
              <h4 className="mb-1 text-sm font-semibold text-foreground">{meta.label}</h4>
              <p className="mb-2 text-[11px] text-muted">
                {sideA.length} × {sideB.length} = {crosses.length} {crosses.length === 1 ? "cruce posible" : "cruces posibles"}
              </p>
              {crosses.length === 0 && customSelections.length === 0 ? (
                <p className="text-xs italic text-muted">
                  Faltan factores de {sideA.length === 0 ? "la EFI" : "la EFE"} para esta aspiración — agrega una opción personalizada abajo.
                </p>
              ) : (
                <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                  {crosses.map(({ a, b, id }) => {
                    const checked = selectedIds.has(id);
                    const selection = content.selections.find((s) => s.id === id);
                    return (
                      <div key={id} className={`rounded-md border p-2 text-xs ${checked ? "border-brand/50 bg-brand/5" : "border-border"}`}>
                        <div className="flex items-start gap-2">
                          <span className={presenter ? "pointer-events-none opacity-70" : ""}>
                            <ToggleSwitch checked={checked} onChange={() => toggleSelection({ id, quadrant: q, factorAId: a.id, factorBId: b.id })} />
                          </span>
                          <span className="pt-0.5 text-foreground">
                            <b>{a.factor}</b> + <b>{b.factor}</b>
                          </span>
                        </div>
                        {checked && !presenter && (
                          <input
                            className={inputCls + " mt-1.5 text-xs"}
                            placeholder="Estrategia resultante (opcional)…"
                            value={drafts[id] ?? selection?.note ?? ""}
                            onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
                            onBlur={() => commitNote(id)}
                            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          />
                        )}
                        {checked && selection?.note && presenter && <p className="mt-1 italic text-muted">{selection.note}</p>}
                      </div>
                    );
                  })}
                  {customSelections.map((s) => (
                    <div key={s.id} className="rounded-md border border-brand/50 bg-brand/5 p-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-foreground">
                          <b>{s.custom!.textA}</b> + <b>{s.custom!.textB}</b>
                          <span className="ml-1.5 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold text-muted">personalizada</span>
                        </span>
                        {!presenter && <DeleteButton onConfirm={() => removeCustom(s.id)} />}
                      </div>
                      {!presenter && (
                        <input
                          className={inputCls + " mt-1.5 text-xs"}
                          placeholder="Estrategia resultante (opcional)…"
                          value={drafts[s.id] ?? s.note ?? ""}
                          onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                          onBlur={() => commitNote(s.id)}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        />
                      )}
                      {s.note && presenter && <p className="mt-1 italic text-muted">{s.note}</p>}
                    </div>
                  ))}
                </div>
              )}
              {!presenter && (
                <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">+ Opción personalizada</p>
                  <input
                    className={inputCls + " text-xs"}
                    placeholder={`${meta.a[0].toUpperCase()}${meta.a.slice(1)}…`}
                    value={draft.textA}
                    onChange={(e) => setCustomDraft((d) => ({ ...d, [q]: { ...draft, textA: e.target.value } }))}
                  />
                  <input
                    className={inputCls + " text-xs"}
                    placeholder={`${meta.b[0].toUpperCase()}${meta.b.slice(1)}…`}
                    value={draft.textB}
                    onChange={(e) => setCustomDraft((d) => ({ ...d, [q]: { ...draft, textB: e.target.value } }))}
                  />
                  <button className={btnGhost} onClick={() => addCustom(q)}>
                    + Agregar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} sticky />
    </div>
  );
}
