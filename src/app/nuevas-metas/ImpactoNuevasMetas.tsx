"use client";

import { aspClasses } from "@/lib/aspirationStyle";
import { aspHex } from "../estrategia/strategyTree";
import type { MetaNode, MetaTag, StrategyTree } from "../estrategia/strategyTree";
import { HijoChip, TagChip } from "./chips";

type Tone = ReturnType<typeof aspClasses>;

function Connector() {
  return (
    <div className="flex w-7 shrink-0 items-center justify-center text-muted" aria-hidden>
      <span className="text-sm">→</span>
    </div>
  );
}

function EmptyChip({ text }: { text: string }) {
  return <span className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] italic text-muted">{text}</span>;
}

function BadgeRow({ tag, tone }: { tag: MetaTag; tone: Tone }) {
  const hijos = tag.children ?? [];
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex w-52 shrink-0 items-center">
        <div className={`w-full rounded-md border px-2.5 py-1.5 ${tone.border} bg-card`}>
          <TagChip tag={tag} />
          {tag.subtitle && <p className="mt-0.5 text-[10px] text-muted">{tag.subtitle}</p>}
        </div>
      </div>
      <Connector />
      <div className="flex flex-1 flex-wrap items-center gap-1.5 py-1">
        {hijos.length === 0 ? <EmptyChip text="Sin hijos" /> : hijos.map((h) => <HijoChip key={h.id} hijo={h} />)}
      </div>
    </div>
  );
}

function MetaRow({ meta, tone }: { meta: MetaNode; tone: Tone }) {
  const tags = meta.tags ?? [];
  const recursos = meta.recursos ?? [];
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex w-52 shrink-0 items-center">
        <div className={`w-full rounded-md border-2 px-2.5 py-1.5 ${tone.border} bg-card`}>
          <p className="text-xs font-semibold text-foreground">{meta.title}</p>
        </div>
      </div>
      <Connector />
      <div className="flex flex-1 flex-col gap-1.5 py-1">
        {tags.length === 0 ? <EmptyChip text="Sin badges" /> : tags.map((t) => <BadgeRow key={t.id} tag={t} tone={tone} />)}
      </div>
      {/* Recursos: un solo bloque que abarca la altura de todos los badges de la meta. */}
      <div className="flex w-56 shrink-0 flex-col gap-1.5 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 px-2.5 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">🧰 Recursos necesarios</span>
        {recursos.length === 0 ? (
          <span className="text-[11px] italic text-muted">Sin recursos</span>
        ) : (
          recursos.map((t) => (
            <div key={t.id} className="flex flex-col items-start gap-0.5">
              <TagChip tag={t} />
              {(t.children ?? []).length > 0 && (
                <span className="flex flex-wrap gap-0.5 pl-3">
                  {t.children!.map((c) => (
                    <HijoChip key={c.id} hijo={c} />
                  ))}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const LANE_CONNECTOR =
  "relative flex items-center gap-2 pl-7 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0 before:border-l-2 before:border-border after:absolute after:left-0 after:top-1/2 after:h-0 after:w-7 after:border-t-2 after:border-border first:before:top-1/2 last:before:bottom-1/2 only:before:hidden";

// Mapa de impacto de las nuevas metas: propósito → aspiración → meta → badge → hijos, con los
// recursos de cada meta a la derecha abarcando todos sus badges.
export default function ImpactoNuevasMetas({ tree }: { tree: StrategyTree }) {
  if (tree.aspiraciones.length === 0) {
    return <p className="text-sm text-muted">Aún no hay datos para mostrar en el mapa de impacto.</p>;
  }
  return (
    <div>
      <p className="mb-1 text-sm text-muted">
        Lectura de mapa de impacto: de dónde partimos (propósito) → quién actúa (aspiración) → por qué (meta) → cómo
        (badges y sus hijos) → con qué (recursos necesarios).
      </p>
      <p className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <span>Propósito</span>
        <span>→</span>
        <span>Aspiración</span>
        <span>→</span>
        <span>Meta</span>
        <span>→</span>
        <span>Badge</span>
        <span>→</span>
        <span>Hijos</span>
        <span>·</span>
        <span>Recursos</span>
      </p>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[1180px] items-stretch gap-2">
          <div className="flex w-48 shrink-0 items-center">
            <div className="w-full rounded-lg border-2 border-brand bg-brand/10 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-brand-dark">🧭 Propósito superior</p>
              <p className="text-xs font-medium text-foreground">{tree.proposito}</p>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-5">
            {tree.aspiraciones.map((asp) => {
              const tone = aspClasses(asp.number);
              return (
                <div key={asp.id} className={LANE_CONNECTOR}>
                  <div className={`flex-1 rounded-lg border-l-4 bg-card p-3 shadow-sm ${tone.border}`}>
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                        style={{ background: aspHex(asp.number) }}
                      >
                        Asp. {asp.number}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{asp.archetype}</span>
                      <span className="text-xs text-muted">· {asp.name}</span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {asp.metas.length === 0 ? <EmptyChip text="Sin metas" /> : asp.metas.map((m) => <MetaRow key={m.id} meta={m} tone={tone} />)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
