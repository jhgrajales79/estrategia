interface Category {
  key: string;
  label: string;
}
interface NoteLike {
  category: string;
  impact?: "alto" | "medio" | "bajo";
}

const LEVELS: Array<"alto" | "medio" | "bajo"> = ["alto", "medio", "bajo"];
const LEVEL_LABEL: Record<string, string> = { alto: "Alto", medio: "Medio", bajo: "Bajo" };
// Categorías "negativas" (debilidad, amenaza): un impacto alto es lo peor, así que el semáforo
// se invierte frente a categorías "positivas" (fortaleza, oportunidad), donde alto es lo mejor.
const NEGATIVE_KEYS = new Set(["debilidad", "amenaza"]);
const SEMAPHORE: Record<"positive" | "negative", Record<string, string>> = {
  positive: { alto: "#16a34a", medio: "#d97706", bajo: "#dc2626" },
  negative: { alto: "#dc2626", medio: "#d97706", bajo: "#16a34a" },
};

// Resumen aparte de las tarjetas: no reorganiza el tablero de post-its, solo cuenta cuántas
// hay en cada nivel de impacto por categoría, con el color de semáforo correspondiente.
export default function PriorityLevelChart({
  categories,
  notes,
  dark = false,
}: {
  categories: Category[];
  notes: NoteLike[];
  dark?: boolean;
}) {
  const counts = categories.map((cat) =>
    LEVELS.map((lvl) => notes.filter((n) => n.category === cat.key && (n.impact ?? "medio") === lvl).length)
  );
  const max = Math.max(1, ...counts.flat());

  return (
    <div className={`mb-6 grid gap-3`} style={{ gridTemplateColumns: `repeat(${Math.min(categories.length, 4)}, minmax(180px, 1fr))` }}>
      {categories.map((cat, ci) => {
        const polarity: "positive" | "negative" = NEGATIVE_KEYS.has(cat.key) ? "negative" : "positive";
        return (
          <div
            key={cat.key}
            className={`rounded-lg border p-3 ${dark ? "border-white/10 bg-white/[0.03]" : "border-border bg-card"}`}
          >
            <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${dark ? "text-white/60" : "text-muted"}`}>{cat.label}</p>
            <div className="space-y-1.5">
              {LEVELS.map((lvl, li) => {
                const count = counts[ci][li];
                const color = SEMAPHORE[polarity][lvl];
                return (
                  <div key={lvl} className="flex items-center gap-2 text-xs">
                    <span className={`w-12 shrink-0 font-medium ${dark ? "text-white/70" : "text-foreground"}`}>{LEVEL_LABEL[lvl]}</span>
                    <div
                      className="h-3 flex-1 overflow-hidden rounded-full"
                      style={{ backgroundColor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${(count / max) * 100}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="w-5 shrink-0 text-right font-bold" style={{ color }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
