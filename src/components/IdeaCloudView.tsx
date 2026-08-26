interface Idea {
  id: string;
  text: string;
  votes: number;
}

// Mezcla de ángulos horizontales, diagonales y verticales para un look realmente "crazy".
const ANGLES = [0, 90, -90, 45, -45, 18, -18, 65, -65, 30, -30, 80, -80, 10, -10, 55, -55];
const OFFSETS_Y = [0, 10, -8, 14, -12, 6, -14, 12, -6, 16, -10, 4, -16, 8, -4, 18, -18];
const OFFSETS_X = [0, -6, 8, -10, 4, -4, 10, -8, 6, -12, 2, -2, 12, -14, 14, -6, 6];

export default function IdeaCloudView({ ideas, large = false }: { ideas: Idea[]; large?: boolean }) {
  const maxVotes = Math.max(1, ...ideas.map((i) => i.votes));

  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-3 px-4 pt-4 ${large ? "gap-y-16" : "gap-y-10"}`}>
      {ideas.map((idea, i) => {
        const weight = idea.votes / maxVotes; // 0..1
        const fontSize = large ? 16 + weight * 26 : 12 + weight * 16;
        const padY = large ? 10 + weight * 10 : 6 + weight * 6;
        const padX = large ? 18 + weight * 14 : 12 + weight * 8;
        const rotate = ANGLES[i % ANGLES.length];
        const offsetY = OFFSETS_Y[i % OFFSETS_Y.length] * (large ? 1.3 : 1);
        const offsetX = OFFSETS_X[i % OFFSETS_X.length] * (large ? 1.3 : 1);
        const hue = (i * 137.508) % 360; // ángulo dorado: máxima separación de color entre ideas
        return (
          <span
            key={idea.id}
            className="inline-block rounded-2xl text-center font-extrabold leading-snug text-neutral-800 shadow-lg"
            style={{
              fontSize,
              padding: `${padY}px ${padX}px`,
              backgroundColor: `hsl(${hue} 85% 82%)`,
              boxShadow: `0 4px 14px hsl(${hue} 60% 55% / 0.35)`,
              transform: `rotate(${rotate}deg) translate(${offsetX}px, ${offsetY}px)`,
            }}
          >
            {idea.text}
            {idea.votes > 0 && <span className="ml-1.5 text-xs font-normal opacity-70">· {idea.votes}</span>}
          </span>
        );
      })}
      {ideas.length === 0 && <p className="text-sm text-muted">Aún no hay ideas registradas.</p>}
    </div>
  );
}
