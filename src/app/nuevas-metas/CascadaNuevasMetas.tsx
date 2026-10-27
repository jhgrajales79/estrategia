"use client";

import { aspClasses } from "@/lib/aspirationStyle";
import PropositoBanner from "../estrategia/PropositoBanner";
import type { AspiracionNode, MetaNode, MetaTag, StrategyTree } from "../estrategia/strategyTree";
import { HijoChip, TagChip } from "./chips";

interface Row {
  asp: AspiracionNode;
  meta: MetaNode | null;
  tag: MetaTag | null;
  hijo: NonNullable<MetaTag["children"]>[number] | null;
}

function buildRows(tree: StrategyTree): Row[] {
  const rows: Row[] = [];
  for (const asp of tree.aspiraciones) {
    if (asp.metas.length === 0) {
      rows.push({ asp, meta: null, tag: null, hijo: null });
      continue;
    }
    for (const meta of asp.metas) {
      const tags = meta.tags ?? [];
      if (tags.length === 0) {
        rows.push({ asp, meta, tag: null, hijo: null });
        continue;
      }
      for (const tag of tags) {
        const hijos = tag.children ?? [];
        if (hijos.length === 0) rows.push({ asp, meta, tag, hijo: null });
        else for (const hijo of hijos) rows.push({ asp, meta, tag, hijo });
      }
    }
  }
  return rows;
}

// Matriz cascada de las nuevas metas: una fila por hijo de badge; aspiración, meta y badge se
// fusionan hacia abajo, y los recursos de la meta ocupan una sola celda que abarca todas sus filas.
export default function CascadaNuevasMetas({ tree }: { tree: StrategyTree }) {
  const rows = buildRows(tree);
  const aspCount: Record<number, number> = {};
  const metaCount: Record<string, number> = {};
  const tagCount: Record<string, number> = {};
  for (const r of rows) {
    aspCount[r.asp.id] = (aspCount[r.asp.id] ?? 0) + 1;
    if (r.meta) metaCount[r.meta.id] = (metaCount[r.meta.id] ?? 0) + 1;
    if (r.tag) tagCount[String(r.tag.id)] = (tagCount[String(r.tag.id)] ?? 0) + 1;
  }
  const seenAsp = new Set<number>();
  const seenMeta = new Set<string>();
  const seenTag = new Set<string>();

  return (
    <div>
      <PropositoBanner text={tree.proposito} />
      <p className="mb-4 text-sm text-muted">
        Cada fila es un hijo de un badge; las celdas de la izquierda se fusionan hacia abajo para mostrar de qué
        aspiración, meta y badge se desprende, y los recursos necesarios abarcan todos los badges de su meta.
      </p>
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-border">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="bg-black/[0.03] text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="sticky top-0 z-10 border-b border-border bg-card px-3 py-2">Aspiración</th>
              <th className="sticky top-0 z-10 border-b border-border bg-card px-3 py-2">Meta</th>
              <th className="sticky top-0 z-10 border-b border-border bg-card px-3 py-2">Badge</th>
              <th className="sticky top-0 z-10 border-b border-border bg-card px-3 py-2">Hijo</th>
              <th className="sticky top-0 z-10 border-b border-border bg-card px-3 py-2">🧰 Recursos necesarios</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const tone = aspClasses(r.asp.number);
              const showAsp = !seenAsp.has(r.asp.id);
              if (showAsp) seenAsp.add(r.asp.id);
              const showMeta = r.meta ? !seenMeta.has(r.meta.id) : true;
              if (r.meta && showMeta) seenMeta.add(r.meta.id);
              const tagKey = r.tag ? String(r.tag.id) : "";
              const showTag = r.tag ? !seenTag.has(tagKey) : true;
              if (r.tag && showTag) seenTag.add(tagKey);
              const recursos = r.meta?.recursos ?? [];

              return (
                <tr key={i} className="align-top hover:bg-black/[0.02]">
                  {showAsp && (
                    <td rowSpan={aspCount[r.asp.id]} className={`border-b border-r border-border px-3 py-2 ${tone.bgSoft}`}>
                      <p className={`text-xs font-bold uppercase tracking-wide ${tone.text}`}>Aspiración {r.asp.number}</p>
                      <p className="text-xs text-foreground">{r.asp.name}</p>
                    </td>
                  )}
                  {r.meta ? (
                    showMeta && (
                      <td rowSpan={metaCount[r.meta.id]} className="border-b border-r border-border px-3 py-2">
                        <p className="font-medium text-foreground">{r.meta.title}</p>
                      </td>
                    )
                  ) : (
                    <td className="border-b border-r border-border px-3 py-2 text-xs italic text-muted">Sin metas</td>
                  )}
                  {r.tag ? (
                    showTag && (
                      <td rowSpan={tagCount[tagKey]} className="border-b border-r border-border px-3 py-2">
                        <TagChip tag={r.tag} />
                        {r.tag.subtitle && <p className="mt-0.5 text-[11px] text-muted">{r.tag.subtitle}</p>}
                      </td>
                    )
                  ) : (
                    <td className="border-b border-r border-border px-3 py-2 text-xs italic text-muted">{r.meta ? "Sin badges" : "—"}</td>
                  )}
                  <td className="border-b border-r border-border px-3 py-2">
                    {r.hijo ? <HijoChip hijo={r.hijo} /> : <span className="text-xs italic text-muted">{r.tag ? "Sin hijos" : "—"}</span>}
                  </td>
                  {r.meta
                    ? showMeta && (
                        <td rowSpan={metaCount[r.meta.id]} className="border-b border-border bg-amber-50/60 px-3 py-2">
                          {recursos.length === 0 ? (
                            <span className="text-xs italic text-muted">Sin recursos</span>
                          ) : (
                            <div className="flex flex-col items-start gap-1.5">
                              {recursos.map((t) => (
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
                              ))}
                            </div>
                          )}
                        </td>
                      )
                    : (
                        <td className="border-b border-border px-3 py-2 text-xs italic text-muted">—</td>
                      )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
