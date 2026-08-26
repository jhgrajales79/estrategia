import { aspAbbrev, aspClasses, findAspiration } from "@/lib/aspirationStyle";
import { PostIt } from "@/components/activities/shared";
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
  highlighted?: boolean;
}

export default function NotesBoardView({
  categories,
  notes,
  aspirations,
  showOnlyHighlighted = false,
  large = false,
}: {
  categories: Category[];
  notes: Note[];
  aspirations: Aspiration[];
  showOnlyHighlighted?: boolean;
  large?: boolean;
}) {
  const cols = categories.length <= 3 ? categories.length : Math.min(categories.length, 3);

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {categories.map((cat) => {
        const all = notes.filter((n) => n.category === cat.key);
        const inCat = showOnlyHighlighted ? all.filter((n) => n.highlighted) : all;
        return (
          <div key={cat.key} className="min-w-0">
            <h3 className={`mb-3 text-center font-semibold text-foreground ${large ? "text-xl" : "text-sm"}`}>{cat.label}</h3>
            <div className="flex flex-wrap justify-center gap-4">
              {inCat.length === 0 && <p className="text-sm text-muted">Aún no hay aportes.</p>}
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
