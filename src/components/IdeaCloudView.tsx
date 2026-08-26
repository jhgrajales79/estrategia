interface Idea {
  id: string;
  text: string;
  votes: number;
}

// Mezcla de ángulos horizontales, diagonales y verticales para un look realmente "crazy".
const ANGLES = [0, 90, -90, 45, -45, 18, -18, 65, -65, 30, -30, 80, -80, 10, -10, 55, -55];
const JITTER_Y = [0, 30, -22, 40, -34, 18, -40, 34, -18, 44, -28, 12, -44, 24, -12, 48, -48];
const JITTER_X = [0, -12, 16, -20, 8, -8, 20, -16, 12, -24, 4, -4, 24, -28, 28, -12, 12];

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
      style={{ gridTemplateRows: `repeat(${rows}, 1fr)`, gridAutoFlow: "column", gridAutoColumns: "minmax(0, 1fr)" }}
    >
      {Array.from({ length: rows * cols }).map((_, cell) => {
        const idea = ideas[cell];
        if (!idea) return <div key={`empty-${cell}`} />;
        const i = cell;
        const weight = idea.votes / maxVotes; // 0..1
        const fontSize = large ? 15 + weight * 24 : 11 + weight * 14;
        const padY = large ? 8 + weight * 8 : 5 + weight * 5;
        const padX = large ? 16 + weight * 12 : 10 + weight * 7;
        const rotate = ANGLES[i % ANGLES.length];
        const jitterY = JITTER_Y[i % JITTER_Y.length] * (large ? 1 : 0.6);
        const jitterX = JITTER_X[i % JITTER_X.length] * (large ? 1 : 0.6);
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
