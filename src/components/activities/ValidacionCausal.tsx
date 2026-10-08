"use client";

import { useEffect, useState } from "react";
import { useSubmission, effectiveAspirationId, fetchLatestContent } from "@/lib/useSubmission";
import { supabase } from "@/lib/supabase";
import { aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { isPresenter } from "@/lib/presenter";
import { ActivityComponentProps, textareaCls, SaveIndicator, PostIt, PresenterHint } from "./shared";
import EjemploValidacionCausalidad from "./EjemploValidacionCausalidad";

// Tarjeta tal como la deja "El paredón estratégico" (MapaEstrategico.tsx) — solo nos interesan
// `text`, `aspiration_id` y `leads_to` para reconstruir las relaciones causa-efecto ya trazadas.
interface SourceCard {
  id: string;
  aspiration_id: number | null;
  text: string;
  leads_to: string[];
}

interface Relation {
  key: string;
  from: string;
  fromAspId: number | null;
  to: string;
  toAspId: number | null;
}

type Judgment = { status: "valida" | "ajuste"; ajuste?: string; by?: string };

interface Content extends Record<string, unknown> {
  judgments: Record<string, Judgment>;
}

// Variante de "notas" (ver dispatcher en NotasColectivas.tsx) para "Validación cruzada de
// causalidad": en vez de escribir el cuestionamiento y la relación desde cero, trae en vivo las
// relaciones causa-efecto que el grupo ya trazó en `causalFrom` (el paredón) y el trabajo pasa a
// ser solo marcar cada una como válida o que necesita ajuste — con el texto del ajuste solo si
// aplica. Es un tablero único y compartido (no se separa por aspiración): el objetivo es que
// cualquier subgrupo, distinto al autor, pueda cuestionar cualquier relación, sin importar de
// qué aspiración venga.
export default function ValidacionCausal({ activity, session, aspirations, participant }: ActivityComponentProps) {
  const causalFrom = activity.config.causalFrom as number | undefined;
  const presenter = isPresenter(participant);
  const submissionAspId = effectiveAspirationId(activity, participant);
  const emptyContent: Content = { judgments: {} };
  const { content, save, saving, updatedAt, saveError, loaded } = useSubmission<Content>(
    activity,
    session,
    submissionAspId,
    participant,
    emptyContent
  );
  async function mutateContent(fn: (latest: Content) => Content) {
    const latest = await fetchLatestContent<Content>(activity.id, submissionAspId, emptyContent);
    await save(fn(latest));
  }
  const [cards, setCards] = useState<SourceCard[]>([]);
  const [ajusteDrafts, setAjusteDrafts] = useState<Record<string, string>>({});
  const [showExample, setShowExample] = useState(false);

  useEffect(() => {
    if (!causalFrom) return;
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("submissions")
        .select("content")
        .eq("activity_id", causalFrom!)
        .is("aspiration_id", null)
        .maybeSingle();
      const list = ((data?.content as { cards?: SourceCard[] } | null)?.cards) ?? [];
      if (!cancelled) setCards(list);
    }
    load().catch(console.error);
    const channel = supabase
      .channel(`validacion-causal-fuente-${causalFrom}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${causalFrom}` }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [causalFrom]);

  if (!loaded) return <p className="text-sm text-muted">Cargando…</p>;

  const byId = new Map(cards.map((c) => [c.id, c]));
  const relations: Relation[] = cards.flatMap((c) =>
    c.leads_to
      .map((toId) => byId.get(toId))
      .filter((to): to is SourceCard => Boolean(to))
      .map((to) => ({
        key: `${c.id}->${to.id}`,
        from: c.text,
        fromAspId: c.aspiration_id,
        to: to.text,
        toAspId: to.aspiration_id,
      }))
  );

  function setJudgment(key: string, status: Judgment["status"]) {
    mutateContent((latest) => ({
      ...latest,
      judgments: { ...latest.judgments, [key]: { status, by: participant.name } },
    }));
  }

  function commitAjuste(key: string) {
    const text = (ajusteDrafts[key] ?? "").trim();
    mutateContent((latest) => ({
      ...latest,
      judgments: { ...latest.judgments, [key]: { status: "ajuste", ajuste: text, by: participant.name } },
    }));
  }

  return (
    <div className="space-y-4">
      {presenter && (
        <div className="rounded-lg border border-border bg-card p-3">
          <PresenterHint />
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
      {showExample && <EjemploValidacionCausalidad onClose={() => setShowExample(false)} />}
      {!causalFrom ? (
        <p className="text-sm text-muted">Esta actividad no tiene configurado el origen de relaciones causales.</p>
      ) : relations.length === 0 ? (
        <p className="text-sm text-muted">Aún no hay relaciones causales trazadas en "El paredón estratégico" para validar.</p>
      ) : (
        <div className="space-y-3">
          {relations.map((r) => {
            const judgment = content.judgments[r.key];
            const fromAsp = findAspiration(aspirations, r.fromAspId);
            const toAsp = findAspiration(aspirations, r.toAspId);
            const fromCls = aspClasses(fromAsp?.number);
            const toCls = aspClasses(toAsp?.number);
            return (
              <div key={r.key} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-3 flex flex-col items-center gap-1.5 sm:flex-row sm:items-stretch sm:justify-center">
                  <PostIt bgClass={fromAsp ? fromCls.bgSoft : undefined} className="w-56">
                    <p className="text-foreground">{r.from}</p>
                  </PostIt>
                  <span className="self-center px-2 text-lg text-muted" aria-hidden>
                    →
                  </span>
                  <PostIt bgClass={toAsp ? toCls.bgSoft : undefined} className="w-56">
                    <p className="text-foreground">{r.to}</p>
                  </PostIt>
                </div>
                {!presenter && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        judgment?.status === "valida"
                          ? "border-brand bg-brand/10 text-brand-dark"
                          : "border-border text-muted hover:bg-black/5"
                      }`}
                      onClick={() => setJudgment(r.key, "valida")}
                    >
                      ✅ Válida
                    </button>
                    <button
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        judgment?.status === "ajuste"
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-border text-muted hover:bg-black/5"
                      }`}
                      onClick={() => setJudgment(r.key, "ajuste")}
                    >
                      ✏️ Necesita ajuste
                    </button>
                  </div>
                )}
                {judgment?.status === "ajuste" && (
                  <div className="mt-2">
                    {presenter ? (
                      judgment.ajuste ? (
                        <p className="text-sm text-foreground">{judgment.ajuste}</p>
                      ) : (
                        <p className="text-xs text-muted">Aún sin ajuste escrito.</p>
                      )
                    ) : (
                      <textarea
                        className={textareaCls}
                        placeholder="Escribe el ajuste acordado…"
                        value={ajusteDrafts[r.key] ?? judgment.ajuste ?? ""}
                        onChange={(e) => setAjusteDrafts((d) => ({ ...d, [r.key]: e.target.value }))}
                        onBlur={() => commitAjuste(r.key)}
                      />
                    )}
                    {judgment.by && <p className="mt-1 text-right text-[11px] text-muted">— {judgment.by}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <SaveIndicator saving={saving} updatedAt={updatedAt} error={saveError} />
    </div>
  );
}
