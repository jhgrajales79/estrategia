"use client";

import { formatMoney } from "@/lib/budget";
import { aspClasses } from "@/lib/aspirationStyle";
import { aspHex } from "./strategyTree";
import type { ActividadNode, MetaNode, ProyectoEstrategicoNode, StrategyTree } from "./strategyTree";

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

function ActividadChip({ actividad, tone }: { actividad: ActividadNode; tone: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${tone.border} bg-card text-foreground`}>
      🗓️ {actividad.name}
      <span className="text-muted">{formatMoney(actividad.budget)}</span>
    </span>
  );
}

function ProyectoRow({ proyecto, tone }: { proyecto: ProyectoEstrategicoNode; tone: Tone }) {
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex w-52 shrink-0 items-center">
        <div className={`w-full rounded-md border px-2.5 py-1.5 ${tone.border} ${tone.bgSoft}`}>
          <p className={`truncate text-xs font-semibold ${tone.text}`} title={proyecto.nombre}>
            {proyecto.promoted ? "🚀" : "💡"} {proyecto.nombre}
          </p>
          {proyecto.responsable && <p className="truncate text-[10px] text-muted">{proyecto.responsable}</p>}
          <p className="text-[10px] font-medium text-muted">{proyecto.promoted ? formatMoney(proyecto.budget) : "Aún sin costear"}</p>
        </div>
      </div>
      <Connector />
      <div className="flex flex-1 flex-wrap items-center gap-1.5 py-1">
        {proyecto.actividades.length === 0 ? <EmptyChip text="Sin actividades" /> : proyecto.actividades.map((a) => <ActividadChip key={a.id} actividad={a} tone={tone} />)}
      </div>
    </div>
  );
}

function MetaRow({ meta, tone }: { meta: MetaNode; tone: Tone }) {
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex w-52 shrink-0 items-center">
        <div className={`w-full rounded-md border-2 px-2.5 py-1.5 ${tone.border} bg-card`}>
          <p className="text-xs font-semibold text-foreground">{meta.title}</p>
          {meta.isNew && (
            <span className="mt-0.5 inline-block rounded-full bg-black/10 px-1.5 py-0.5 text-[9px] font-bold text-foreground">NUEVA</span>
          )}
          {meta.isUnassigned && <p className="text-[10px] italic text-muted">Sin meta asignada</p>}
        </div>
      </div>
      <Connector />
      <div className="flex flex-1 flex-col gap-1.5 py-1">
        {meta.proyectos.length === 0 ? <EmptyChip text="Sin proyectos" /> : meta.proyectos.map((p) => <ProyectoRow key={p.id} proyecto={p} tone={tone} />)}
      </div>
    </div>
  );
}

const LANE_CONNECTOR =
  "relative flex items-center gap-2 pl-7 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0 before:border-l-2 before:border-border after:absolute after:left-0 after:top-1/2 after:h-0 after:w-7 after:border-t-2 after:border-border first:before:top-1/2 last:before:bottom-1/2 only:before:hidden";

export default function ImpactMapView({ tree }: { tree: StrategyTree }) {
  if (tree.aspiraciones.length === 0) {
    return <p className="text-sm text-muted">Aún no hay datos para mostrar en el mapa de impacto.</p>;
  }
  return (
    <div>
      <p className="mb-1 text-sm text-muted">
        Lectura de mapa de impacto: de dónde partimos (propósito) → quién actúa (aspiración) → por qué (meta) → cómo
        (proyecto estratégico) → qué hace en concreto (actividad).
      </p>
      <p className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <span>Propósito</span>
        <span>→</span>
        <span>Aspiración</span>
        <span>→</span>
        <span>Meta</span>
        <span>→</span>
        <span>Proyecto estratégico</span>
        <span>→</span>
        <span>Actividad</span>
      </p>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[980px] items-stretch gap-2">
          <div className="flex w-48 shrink-0 items-center">
            <div className="w-full rounded-lg border-2 border-brand bg-brand/10 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-brand-dark">🧭 Propósito superior</p>
              <p className="text-xs font-medium text-foreground">{tree.proposito}</p>
            </div>
          </div>
          <div className="flex flex-col gap-5">
            {tree.aspiraciones.map((asp) => {
              const tone = aspClasses(asp.number);
              return (
                <div key={asp.id} className={LANE_CONNECTOR}>
                  <div className={`rounded-lg border-l-4 bg-card p-3 shadow-sm ${tone.border}`}>
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                        style={{ background: aspHex(asp.number) }}
                      >
                        Asp. {asp.number}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{asp.archetype}</span>
                      <span className="text-xs text-muted">· {asp.name}</span>
                      <span className="ml-auto text-xs font-semibold tabular-nums text-muted">{formatMoney(asp.budget)}</span>
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
