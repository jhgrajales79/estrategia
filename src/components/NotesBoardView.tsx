import { aspAbbrev, aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { PostIt, NewsPage, POLARITY_META, NotePolarity } from "@/components/activities/shared";
import type { Aspiration } from "@/lib/types";

interface Category {
  key: string;
  label: string;
}
interface Note {
  id: string;
  category: string;
  aspiration_id: number | null;
  author: string;
  text: string;
  impact?: "alto" | "medio" | "bajo";
  polarity?: NotePolarity;
  highlighted?: boolean;
}

export default function NotesBoardView({
  categories,
  notes,
  aspirations,
  showOnlyHighlighted = false,
  large = false,
  dark = false,
  newsStyle = false,
}: {
  categories: Category[];
  notes: Note[];
  aspirations: Aspiration[];
  showOnlyHighlighted?: boolean;
  large?: boolean;
  dark?: boolean;
  newsStyle?: boolean;
}) {
  const cols = categories.length <= 3 ? categories.length : Math.min(categories.length, 3);

  if (newsStyle) {
    // Una edición por categoría: todas las noticias de esa mesa/categoría se componen juntas
    // en una sola hoja, en vez de tarjetas sueltas — ver NewsPage.
    return (
      <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {categories.map((cat) => {
          const all = notes.filter((n) => n.category === cat.key);
          const inCat = showOnlyHighlighted ? all.filter((n) => n.highlighted) : all;
          return (
            <NewsPage
              key={cat.key}
              title={cat.label}
              large={large}
              notes={inCat.map((n) => {
                const abbrev = aspAbbrev(aspirations, n.aspiration_id);
                const asp = findAspiration(aspirations, n.aspiration_id);
                const cls = aspClasses(asp?.number);
                return {
                  id: n.id,
                  headline: n.text,
                  author: n.author,
                  highlighted: n.highlighted,
                  tag: abbrev ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls.bgSoft} ${cls.text}`}>{abbrev}</span> : undefined,
                };
              })}
            />
          );
        })}
      </div>
    );
  }

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
                const pol = n.polarity ? POLARITY_META[n.polarity] : null;
                return (
                  <PostIt
                    key={n.id}
                    bgClass={asp ? cls.bgSoft : undefined}
                    index={i}
                    highlighted={n.highlighted}
                    className={large ? "w-56 text-base p-4" : "w-36"}
                  >
                    {pol && (
                      <span
                        className={`mb-1.5 inline-block rounded-full px-2 py-0.5 font-bold ${pol.badgeCls} ${large ? "text-xs" : "text-[10px]"}`}
                      >
                        {pol.icon} {pol.label}
                      </span>
                    )}
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
