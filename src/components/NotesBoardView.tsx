import { Fragment } from "react";
import { aspAbbrev, aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { PostIt } from "@/components/activities/shared";
import type { Aspiration } from "@/lib/types";

interface Category {
  key: string;
  label: string;
  // "negativa" (ej. debilidad, amenaza): el impacto alto es lo peor, así que el semáforo se
  // invierte (alto=rojo, bajo=verde). Por defecto la categoría es "positiva" (fortaleza,
  // oportunidad): alto=verde, bajo=rojo.
  negative?: boolean;
}
interface Note {
  id: string;
  category: string;
  aspiration_id: number | null;
  author: string;
  text: string;
  impact?: "alto" | "medio" | "bajo";
  highlighted?: boolean;
}

const LEVELS: Array<"alto" | "medio" | "bajo"> = ["alto", "medio", "bajo"];
const LEVEL_LABEL: Record<string, string> = { alto: "Alto", medio: "Medio", bajo: "Bajo" };
const SEMAPHORE: Record<"positive" | "negative", Record<string, string>> = {
  positive: { alto: "#16a34a", medio: "#d97706", bajo: "#dc2626" },
  negative: { alto: "#dc2626", medio: "#d97706", bajo: "#16a34a" },
};
const SEMAPHORE_SOFT: Record<"positive" | "negative", Record<string, string>> = {
  positive: { alto: "#dcfce7", medio: "#fef3c7", bajo: "#fee2e2" },
  negative: { alto: "#fee2e2", medio: "#fef3c7", bajo: "#dcfce7" },
};

export default function NotesBoardView({
  categories,
  notes,
  aspirations,
  showOnlyHighlighted = false,
  large = false,
  dark = false,
  impactLevels = false,
}: {
  categories: Category[];
  notes: Note[];
  aspirations: Aspiration[];
  showOnlyHighlighted?: boolean;
  large?: boolean;
  dark?: boolean;
  // Cuando la actividad tiene niveles de impacto, cada categoría se separa además por nivel
  // (Alto/Medio/Bajo) en una grilla tipo semáforo, en vez de solo agrupar por categoría.
  impactLevels?: boolean;
}) {
  if (impactLevels) {
    return (
      <SemaphoreBoard
        categories={categories}
        notes={notes}
        aspirations={aspirations}
        showOnlyHighlighted={showOnlyHighlighted}
        large={large}
        dark={dark}
      />
    );
  }

  const cols = categories.length <= 3 ? categories.length : Math.min(categories.length, 3);

  return (
    <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {categories.map((cat) => {
        const all = notes.filter((n) => n.category === cat.key);
        const inCat = showOnlyHighlighted ? all.filter((n) => n.highlighted) : all;
        return (
          <div key={cat.key} className="min-w-0">
            <div className={`mb-4 flex items-center justify-center gap-2 ${large ? "text-xl" : "text-sm"}`}>
              <h3 className={`font-semibold ${dark ? "text-white" : "text-foreground"}`}>{cat.label}</h3>
              {inCat.length > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    dark ? "bg-white/10 text-white/70" : "bg-black/5 text-muted"
                  }`}
                >
                  {inCat.length}
                </span>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {inCat.length === 0 && (
                <p className={`text-sm ${dark ? "text-white/35" : "text-muted"}`}>Aún no hay aportes.</p>
              )}
              {inCat.map((n, i) => {
                const asp = findAspiration(aspirations, n.aspiration_id);
                const cls = aspClasses(asp?.number);
                const abbrev = aspAbbrev(aspirations, n.aspiration_id);
                return (
                  <PostIt
                    key={n.id}
                    bgClass={asp ? cls.bgSoft : undefined}
                    index={i}
                    highlighted={n.highlighted}
                    className={large ? "w-56 text-base p-4" : "w-36"}
                  >
                    <p className="text-foreground">{n.text}</p>
                    <p className={`mt-2 font-semibold text-muted ${large ? "text-sm" : "text-[11px]"}`}>
                      {abbrev ?? "—"}
                      {n.impact ? ` · ${n.impact}` : ""}
                    </p>
                  </PostIt>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SemaphoreBoard({
  categories,
  notes,
  aspirations,
  showOnlyHighlighted,
  large,
  dark,
}: {
  categories: Category[];
  notes: Note[];
  aspirations: Aspiration[];
  showOnlyHighlighted: boolean;
  large: boolean;
  dark: boolean;
}) {
  const labelCol = large ? 96 : 76;
  const catCol = large ? 300 : 220;

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `${labelCol}px repeat(${categories.length}, minmax(${catCol}px, 1fr))` }}
      >
        <div />
        {categories.map((cat) => {
          const total = notes.filter((n) => n.category === cat.key).length;
          return (
            <div
              key={cat.key}
              className={`flex items-baseline justify-center gap-1.5 ${large ? "text-xl" : "text-sm"} font-semibold ${dark ? "text-white" : "text-foreground"}`}
            >
              {cat.label}
              {total > 0 && (
                <span className={`text-xs font-normal ${dark ? "text-white/50" : "text-muted"}`}>({total})</span>
              )}
            </div>
          );
        })}

        {LEVELS.map((level) => (
          <Fragment key={level}>
            <div
              className={`flex items-center justify-end pr-1.5 text-right ${large ? "text-xs" : "text-[10px]"} font-bold uppercase tracking-wide ${
                dark ? "text-white/45" : "text-muted"
              }`}
            >
              {LEVEL_LABEL[level]}
            </div>
            {categories.map((cat) => {
              const polarity: "positive" | "negative" = cat.negative ? "negative" : "positive";
              const color = SEMAPHORE[polarity][level];
              const soft = SEMAPHORE_SOFT[polarity][level];
              const all = notes.filter((n) => n.category === cat.key && (n.impact ?? "medio") === level);
              const inCell = showOnlyHighlighted ? all.filter((n) => n.highlighted) : all;
              return (
                <div
                  key={cat.key + level}
                  className="min-h-[64px] rounded-lg border-2 p-2.5"
                  style={{ borderColor: color, backgroundColor: dark ? `${color}1f` : `${color}0d` }}
                >
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold" style={{ color }}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    {inCell.length}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {inCell.length === 0 && (
                      <p className={`text-xs ${dark ? "text-white/25" : "text-muted/60"}`}>Sin aportes</p>
                    )}
                    {inCell.map((n, i) => {
                      const abbrev = aspAbbrev(aspirations, n.aspiration_id);
                      return (
                        <PostIt
                          key={n.id}
                          bgColor={soft}
                          index={i}
                          highlighted={n.highlighted}
                          className={large ? "w-48 text-sm p-3" : "w-32"}
                        >
                          <p className="text-foreground">{n.text}</p>
                          {abbrev && <p className="mt-1.5 text-[10px] font-semibold text-muted">{abbrev}</p>}
                        </PostIt>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
