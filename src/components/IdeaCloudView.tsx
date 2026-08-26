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
  const maxVotes = Math.max(1, ...ideas.map((i) => i.votes));

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

  return (
    <div
      className="grid h-full w-full place-items-center"
      style={{
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridAutoFlow: "column",
        gridAutoColumns: "minmax(0, 1fr)",
        gap: large ? "1.5rem" : "0.75rem",
      }}
    >
      {Array.from({ length: rows * cols }).map((_, cell) => {
        const idea = ideas[cell];
        if (!idea) return <div key={`empty-${cell}`} />;
        const i = cell;
        const weight = idea.votes / maxVotes; // 0..1
        const fontSize = large ? 15 + weight * 24 : 11 + weight * 14;
        // Padding proporcional al tamaño de letra: el badge se ajusta al texto, no al revés.
        const padY = fontSize * 0.22;
        const padX = fontSize * 0.55;
        const rotate = ANGLES[i % ANGLES.length];
        const jitterY = JITTER[i % JITTER.length] * (large ? 1 : 0.6);
        const jitterX = JITTER[(i * 5 + 3) % JITTER.length] * (large ? 1 : 0.6);
        const hue = (i * 137.508) % 360; // ángulo dorado: máxima separación de color entre ideas
        return (
          <span
            key={idea.id}
            className="inline-block max-w-[90%] text-center font-extrabold leading-snug text-neutral-800 shadow-lg"
            style={{
              fontSize,
              padding: `${padY}px ${padX}px`,
              borderRadius: 999,
              backgroundColor: `hsl(${hue} 85% 82%)`,
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
