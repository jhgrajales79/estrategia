"use client";

import { useEffect, useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { supabase } from "@/lib/supabase";
import { fetchActivityById } from "@/lib/data";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { isPresenter } from "@/lib/presenter";
import { ActivityComponentProps, inputCls, btnGhost, btnDanger, btnPrimary, SaveIndicator, PostIt, PresenterHint, PinToggle, ToggleSwitch, uid } from "./shared";
import EjemploParedon from "./EjemploParedon";

interface RatifiedStrategy {
  id: string;
  text: string;
  aspName: string;
}

interface Card {
  id: string;
  perspective: string;
  aspiration_id: number | null;
  author: string;
  text: string;
  leads_to: string[];
  highlighted?: boolean;
}
interface Content extends Record<string, unknown> {
  cards: Card[];
  showOnlyHighlighted: boolean;
}

export default function MapaEstrategico({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const perspectives = (activity.config.perspectives as { key: string; label: string }[]) ?? [];
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    { cards: [], showOnlyHighlighted: false }
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [showExample, setShowExample] = useState(false);

  // Estrategias ya ratificadas por consenso en el Cierre (config.inputsFrom[0]): antes solo se
  // veían como referencia pasiva en el panel de insumos — ahora cada una trae un botón por
  // perspectiva para crear de una vez el objetivo de partida, en vez de retipear la estrategia a
  // mano. Los nombres de los campos se leen del config de esa actividad (no se asumen "estrategia"/
  // "aspiracion" fijos), igual que hace TarjetaEstructurada con sus propios registros.
  const strategiesFrom = (activity.config.strategiesFrom as number | undefined) ?? (activity.config.inputsFrom as number[] | undefined)?.[0];
  const [ratifiedStrategies, setRatifiedStrategies] = useState<RatifiedStrategy[]>([]);
  useEffect(() => {
    if (!strategiesFrom) return;
    let cancelled = false;
    async function load() {
      const sourceActivity = await fetchActivityById(strategiesFrom!);
      const fields = (sourceActivity?.config.fields as { key: string }[] | undefined) ?? [];
      const { data } = await supabase.from("submissions").select("content").eq("activity_id", strategiesFrom!).is("aspiration_id", null).maybeSingle();
      const entries = ((data?.content as { entries?: Record<string, unknown>[] } | null)?.entries ?? []).filter((e) => !e.ejemplo);
      const list: RatifiedStrategy[] = entries
        .map((e) => ({
          id: e.id as string,
          text: (fields[0] ? (e[fields[0].key] as string) : "") ?? "",
          aspName: (fields[1] ? (e[fields[1].key] as string) : "") ?? "",
        }))
        .filter((e) => e.text.trim());
      if (!cancelled) setRatifiedStrategies(list);
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`paredon-estrategias-${strategiesFrom}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${strategiesFrom}` }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [strategiesFrom]);

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  function addCard(perspectiveKey: string) {
    const text = (draft[perspectiveKey] ?? "").trim();
    if (!text) return;
    const card: Card = {
      id: uid(),
      perspective: perspectiveKey,
      aspiration_id: participant.aspiration_id,
      author: participant.name,
      text,
      leads_to: [],
    };
    save(
      { ...content, cards: [...content.cards, card] },
      { eventType: "objetivo", summary: `${participant.name} agregó un objetivo en el mapa estratégico` }
    );
    setDraft((d) => ({ ...d, [perspectiveKey]: "" }));
  }
  function addCardFromStrategy(perspectiveKey: string, strategy: RatifiedStrategy) {
    const matchedAsp = aspirations.find((a) => a.name === strategy.aspName);
    const card: Card = {
      id: uid(),
      perspective: perspectiveKey,
      aspiration_id: matchedAsp?.id ?? null,
      author: participant.name,
      text: strategy.text,
      leads_to: [],
    };
    save(
      { ...content, cards: [...content.cards, card] },
      { eventType: "objetivo", summary: `${participant.name} creó un objetivo desde una estrategia ratificada en el Cierre` }
    );
  }
  function removeCard(id: string) {
    save({ ...content, cards: content.cards.filter((c) => c.id !== id).map((c) => ({ ...c, leads_to: c.leads_to.filter((l) => l !== id) })) });
  }
  function toggleLeadsTo(fromId: string, toId: string) {
    save({
      ...content,
      cards: content.cards.map((c) =>
        c.id === fromId ? { ...c, leads_to: c.leads_to.includes(toId) ? c.leads_to.filter((l) => l !== toId) : [...c.leads_to, toId] } : c
      ),
    });
  }
  function toggleHighlight(id: string) {
    save({ ...content, cards: content.cards.map((c) => (c.id === id ? { ...c, highlighted: !c.highlighted } : c)) });
  }

  // orden de abajo hacia arriba: última perspectiva de la lista es la base
  const orderedPerspectives = [...perspectives].reverse();

  return (
    <div className="space-y-4">
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
          <PresenterHint />
          <div className="flex items-center gap-3">
            <ToggleSwitch
              checked={content.showOnlyHighlighted}
              onChange={(next) => save({ ...content, showOnlyHighlighted: next })}
              label="Mostrar solo destacadas"
            />
            {Boolean(activity.config.boardRoute) && (
              <button
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 transition-colors"
                title="Ver el paredón estratégico en una pestaña nueva"
                onClick={() => window.open(`/${activity.config.boardRoute}/${activity.id}`, "_blank", "noopener,noreferrer")}
              >
                ⛶ Ver tablero
              </button>
            )}
          </div>
        </div>
      )}
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
      {showExample && <EjemploParedon onClose={() => setShowExample(false)} />}
      {ratifiedStrategies.length > 0 && (
        <div className="rounded-lg border border-dashed border-brand/40 bg-brand/5 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-dark">
            🏷️ Estrategias ratificadas en el Cierre — clic en una perspectiva para crear ahí el objetivo de partida
          </p>
          <div className="space-y-2">
            {ratifiedStrategies.map((s) => (
              <div key={s.id} className="rounded-md border border-border bg-card p-2">
                <p className="text-sm text-foreground">{s.text}</p>
                {s.aspName && <p className="mt-0.5 text-xs text-muted">{s.aspName}</p>}
                {!presenter && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {perspectives.map((p) => (
                      <button key={p.key} className={btnGhost + " !px-2 !py-1 text-xs"} onClick={() => addCardFromStrategy(p.key, s)}>
                        + {p.label.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-muted">Perspectivas de abajo hacia arriba, tal como en el paredón estratégico.</p>
      <div className="space-y-3">
        {orderedPerspectives.map((p) => {
          const allCardsIn = content.cards.filter((c) => c.perspective === p.key);
          const cardsIn = content.showOnlyHighlighted ? allCardsIn.filter((c) => c.highlighted) : allCardsIn;
          const cardsAbove = content.cards.filter((c) => {
            const idxThis = perspectives.findIndex((x) => x.key === p.key);
            const idxCard = perspectives.findIndex((x) => x.key === c.perspective);
            return idxCard === idxThis + 1;
          });
          return (
            <div key={p.key} className="rounded-lg border border-border bg-card p-3">
              <h4 className="mb-2 text-sm font-semibold text-foreground">{p.label}</h4>
              <div className="mb-2 flex flex-wrap gap-2">
                {cardsIn.map((c, i) => {
                  const asp = findAspiration(aspirations, c.aspiration_id);
                  const cls = aspClasses(asp?.number);
                  return (
                    <PostIt key={c.id} bgClass={asp ? cls.bgSoft : undefined} index={i} highlighted={c.highlighted} className="w-48">
                      <p className="text-foreground">{c.text}</p>
                      {cardsAbove.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {cardsAbove.map((above) => (
                            <ToggleSwitch
                              key={above.id}
                              checked={c.leads_to.includes(above.id)}
                              onChange={() => toggleLeadsTo(c.id, above.id)}
                              label={`lleva a: ${above.text.slice(0, 24)}`}
                            />
                          ))}
                        </div>
                      )}
                      <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-muted">
                        {presenter && <PinToggle pinned={Boolean(c.highlighted)} onClick={() => toggleHighlight(c.id)} />}
                        {c.author === participant.name && (
                          <button className={btnDanger} onClick={() => removeCard(c.id)}>
                            ✕
                          </button>
                        )}
                      </div>
                    </PostIt>
                  );
                })}
              </div>
              {!presenter && (
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    placeholder="Nuevo objetivo estratégico…"
                    value={draft[p.key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [p.key]: e.target.value }))}
                  />
                  <button className={btnPrimary} onClick={() => addCard(p.key)}>
                    Agregar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
