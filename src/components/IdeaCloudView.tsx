interface Idea {
  id: string;
  text: string;
  votes: number;
}

// Ángulos moderados (sin verticales completos) para un look "un poco loco" sin que las
// tarjetas invadan la celda vecina. El espacio (gap) del grid es lo que evita el cruce.
const ANGLES = [0, -8, 10, -14, 18, -6, 14, -18, 8, -10, 22, -22, 12, -16, 6, -12, 16];
const JITTER = [0, 6, -5, 8, -7, 4, -8, 7, -4, 9, -6, 3, -9, 5, -3, 8, -5];

export default function IdeaCloudView({ ideas, large = false }: { ideas: Idea[]; large?: boolean }) {
  if (ideas.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted">Aún no hay ideas registradas.</p>
      </div>
    );
  }

  // Grilla de N x M que reparte las ideas en varias filas, usando todo el alto disponible
  // (en vez de amontonarlas en una sola línea arriba).
  const rows = Math.max(3, Math.min(6, Math.ceil(Math.sqrt(ideas.length * 1.5))));
  const cols = Math.ceil(ideas.length / rows);
  const maxVotes = Math.max(1, ...ideas.map((i) => i.votes));

  return (
    <div
      className="grid h-full w-full place-items-center"
      style={{
        gridTemplateRows: `repeat(${rows}, minmax(min-content, 1fr))`,
        gridAutoFlow: "column",
        gridAutoColumns: "minmax(0, 1fr)",
        gap: large ? "1.5rem" : "0.75rem",
      }}
    >
      {Array.from({ length: rows * cols }).map((_, cell) => {
        const idea = ideas[cell];
        if (!idea) return <div key={`empty-${cell}`} />;
        const i = cell;
        // Mismo tamaño para todas: los votos no cambian el tamaño de la tarjeta.
        const fontSize = large ? 18 : 13;
        const padY = fontSize * 0.4;
        const padX = fontSize * 0.7;
        const rotate = ANGLES[i % ANGLES.length];
        const jitterY = JITTER[i % JITTER.length] * (large ? 1 : 0.6);
        const jitterX = JITTER[(i * 5 + 3) % JITTER.length] * (large ? 1 : 0.6);
        const hue = (i * 137.508) % 360; // ángulo dorado: máxima separación de color entre ideas
        // Mas votos = fondo mas solido; sin votos = fondo mas transparente.
        const weight = idea.votes / maxVotes; // 0..1
        const alpha = 0.28 + weight * 0.62; // 0.28 (sin votos) .. 0.9 (la mas votada)
        return (
          <span
            key={idea.id}
            className="inline-block max-w-[85%] whitespace-normal break-words text-center font-extrabold leading-snug text-neutral-800 shadow-lg"
            style={{
              fontSize,
              padding: `${padY}px ${padX}px`,
              borderRadius: fontSize * 1.4,
              backgroundColor: `hsl(${hue} 85% 82% / ${alpha})`,
              boxShadow: `0 4px 14px hsl(${hue} 60% 55% / 0.35)`,
              transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotate}deg)`,
            }}
          >
            {idea.text}
            {idea.votes > 0 && <span className="ml-1.5 text-xs font-normal opacity-70">· {idea.votes}</span>}
          </span>
        );
      })}
    </div>
  );
}
