"use client";

import { useState } from "react";
import { useSubmission, effectiveAspirationId } from "@/lib/useSubmission";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { isPresenter } from "@/lib/presenter";
import { ActivityComponentProps, textareaCls, inputCls, btnPrimary, SaveIndicator, PostIt, PresenterHint, PinToggle, ToggleSwitch, uid } from "./shared";
import DofaCruzado from "./DofaCruzado";
import MatrizIE from "./MatrizIE";

interface StakeholderType {
  key: string;
  label: string;
  icon?: string;
}
interface Card {
  id: string;
  quadrant: string;
  text: string;
  aspiration_id: number | null;
  author: string;
  author_id?: string;
  star?: boolean;
  highlighted?: boolean;
  stakeholderType?: string;
}
interface Content extends Record<string, unknown> {
  cards: Card[];
  showOnlyHighlighted: boolean;
}

export default function MatrizCuadrantes(props: ActivityComponentProps) {
  // El DOFA cruzado (S4 "Tres DOFA cruzados") genera automáticamente TODOS los cruces posibles
  // entre las Matrices EFI y EFE de la aspiración activa, en vez de que cada equipo escriba las
  // tarjetas a mano — es un modo de interacción totalmente distinto, así que vive en su propio
  // componente (DofaCruzado.tsx) y solo se activa si la actividad declara ambas fuentes. El
  // Mapa de aliados y la Matriz Interna-Externa, que no las declaran, siguen exactamente igual.
  if (props.activity.config.efiFrom && props.activity.config.efeFrom) {
    return <DofaCruzado {...props} />;
  }
  // La Matriz Interna-Externa declara `inputsFrom: [efiId, efeId]` — a diferencia del DOFA
  // cruzado, aquí no se generan combinaciones para marcar con check, sino una única posición
  // calculada (Crecer/Mantener/Cosechar) por aspiración.
  if (Array.isArray(props.activity.config.inputsFrom) && props.activity.config.inputsFrom.length >= 2) {
    return <MatrizIE {...props} />;
  }
  return <MatrizCuadrantesClasica {...props} />;
}

function MatrizCuadrantesClasica({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const quadrants = (activity.config.quadrants as { key: string; label: string }[]) ?? [];
  const allowStar = Boolean(activity.config.allowStar);
  const starLabel = (activity.config.starLabel as string) ?? "Destacar";
  // Opcional (ver Mapa de aliados, S3): si la actividad trae `stakeholderTypes`, cada tarjeta
  // debe indicar de qué tipo de interesado se trata (comunidades, junta, donantes...) antes de
  // poder agregarse — así el cuadrante deja de mezclar interesados muy distintos sin distinción.
  const stakeholderTypes = (activity.config.stakeholderTypes as StakeholderType[]) ?? [];
  const stakeholderByKey = Object.fromEntries(stakeholderTypes.map((s) => [s.key, s]));
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
  const [stakeholderChoice, setStakeholderChoice] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  function addCard(quadrantKey: string) {
    const text = (draft[quadrantKey] ?? "").trim();
    if (!text) return;
    const chosenType = stakeholderChoice[quadrantKey];
    if (stakeholderTypes.length > 0 && !chosenType) return;
    const card: Card = {
      id: uid(),
      quadrant: quadrantKey,
      text,
      aspiration_id: participant.aspiration_id,
      author: participant.name,
      author_id: participant.id,
      stakeholderType: stakeholderTypes.length > 0 ? chosenType : undefined,
    };
    save(
      { ...content, cards: [...content.cards, card] },
      { eventType: "tarjeta", summary: `${participant.name} agregó una tarjeta en "${activity.title}"` }
    );
    setDraft((d) => ({ ...d, [quadrantKey]: "" }));
  }
  function toggleStar(id: string) {
    save({ ...content, cards: content.cards.map((c) => (c.id === id ? { ...c, star: !c.star } : c)) });
  }
  function toggleHighlight(id: string) {
    save({ ...content, cards: content.cards.map((c) => (c.id === id ? { ...c, highlighted: !c.highlighted } : c)) });
  }
  function removeCard(id: string) {
    save({ ...content, cards: content.cards.filter((c) => c.id !== id) });
  }
  // Igual que en el PCI: borrar una tarjeta es irreversible, así que exige un segundo clic
  // dentro de los siguientes 3s en vez de borrar directo al primer clic.
  function handleDeleteClick(id: string) {
    if (confirmDeleteId === id) {
      removeCard(id);
      setConfirmDeleteId(null);
      return;
    }
    setConfirmDeleteId(id);
    setTimeout(() => setConfirmDeleteId((cur) => (cur === id ? null : cur)), 3000);
  }

  const cols = quadrants.length <= 3 ? quadrants.length : 2;

  return (
    <div className="space-y-4">
      {presenter && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
          <PresenterHint />
          <div className="flex flex-wrap items-center gap-2">
            <ToggleSwitch
              checked={content.showOnlyHighlighted}
              onChange={(next) => save({ ...content, showOnlyHighlighted: next })}
              label="Mostrar solo destacadas"
            />
            <button
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 transition-colors"
              title="Ver el tablero consolidado en una pestaña nueva"
              onClick={() => window.open(`/aliados/${activity.id}`, "_blank", "noopener,noreferrer")}
            >
              ⛶ Ver tablero
            </button>
          </div>
        </div>
      )}
      <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {quadrants.map((q) => {
          const allCardsIn = content.cards.filter((c) => c.quadrant === q.key);
          const cardsIn = content.showOnlyHighlighted ? allCardsIn.filter((c) => c.highlighted) : allCardsIn;
          return (
            <div key={q.key} className="rounded-lg border border-border bg-card p-3">
              <h4 className="mb-2 text-sm font-semibold text-foreground">{q.label}</h4>
              <div className="mb-3 flex max-h-56 flex-wrap gap-2 overflow-y-auto p-1">
                {cardsIn.map((c, i) => {
                  const asp = findAspiration(aspirations, c.aspiration_id);
                  const cls = aspClasses(asp?.number);
                  const canDelete = c.author_id ? c.author_id === participant.id : c.author === participant.name;
                  const confirming = confirmDeleteId === c.id;
                  return (
                    <PostIt key={c.id} bgClass={asp ? cls.bgSoft : undefined} index={i} highlighted={c.highlighted} className="w-36">
                      {c.stakeholderType && stakeholderByKey[c.stakeholderType] && (
                        <span
                          className="mb-1 block max-w-full truncate rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-bold text-foreground"
                          title={stakeholderByKey[c.stakeholderType].label}
                        >
                          {stakeholderByKey[c.stakeholderType].icon} {stakeholderByKey[c.stakeholderType].label}
                        </span>
                      )}
                      <p className="break-words text-foreground">
                        {c.star && "⭐ "}
                        {c.text}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                        <span className="truncate">{c.author}</span>
                        <span className="flex shrink-0 items-center gap-0.5">
                          {presenter && <PinToggle pinned={Boolean(c.highlighted)} onClick={() => toggleHighlight(c.id)} />}
                          {allowStar && !presenter && (
                            <button
                              className="rounded p-1 hover:bg-black/10"
                              title={starLabel}
                              onClick={() => toggleStar(c.id)}
                            >
                              ⭐
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className={`rounded p-1 text-xs ${confirming ? "font-semibold text-red-600" : "hover:bg-black/10 hover:text-red-600"}`}
                              title={confirming ? "Clic de nuevo para confirmar" : "Eliminar"}
                              onClick={() => handleDeleteClick(c.id)}
                            >
                              {confirming ? "¿Sí?" : "✕"}
                            </button>
                          )}
                        </span>
                      </div>
                    </PostIt>
                  );
                })}
              </div>
              {!presenter && (
                <>
                  {stakeholderTypes.length > 0 && (
                    <select
                      className={inputCls + " mb-2"}
                      value={stakeholderChoice[q.key] ?? ""}
                      onChange={(e) => setStakeholderChoice((s) => ({ ...s, [q.key]: e.target.value }))}
                    >
                      <option value="">Tipo de interesado…</option>
                      {stakeholderTypes.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.icon} {s.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <textarea
                    className={textareaCls}
                    placeholder="Agregar tarjeta…"
                    value={draft[q.key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [q.key]: e.target.value }))}
                  />
                  <button
                    className={btnPrimary + " mt-2"}
                    disabled={stakeholderTypes.length > 0 && !stakeholderChoice[q.key]}
                    title={stakeholderTypes.length > 0 && !stakeholderChoice[q.key] ? "Elige primero el tipo de interesado" : undefined}
                    onClick={() => addCard(q.key)}
                  >
                    Agregar
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} sticky />
    </div>
  );
}
