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
  // Escala absoluta de 8 tonos: cada voto adicional sube un tono, tope en 8 votos
  // (no depende de cual sea la idea mas votada).
  const MAX_TONE_VOTES = 8;

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
        // Sin votos: fondo completamente transparente (solo el borde marca la tarjeta).
        // A más votos, el fondo se vuelve más solido, más saturado y más brillante,
        // en 8 tonos (voto 1 = tono 1/8 ... voto 8+ = tono 8/8).
        const tone = Math.min(idea.votes, MAX_TONE_VOTES);
        const weight = tone / MAX_TONE_VOTES; // 0..1
        const alpha = weight;
        const saturation = 45 + weight * 45; // 45% .. 90%
        const lightness = 88 - weight * 18; // 88% (pastel) .. 70% (vivo)
        const isHot = idea.votes > 4;
        return (
          <span
            key={idea.id}
            className="inline-block max-w-[85%] whitespace-normal break-words text-center font-extrabold leading-snug text-neutral-800"
            style={{
              fontSize,
              padding: `${padY}px ${padX}px`,
              borderRadius: fontSize * 1.4,
              border: `1.5px solid hsl(${hue} 60% 55% / ${0.3 + weight * 0.5})`,
              backgroundColor: `hsl(${hue} ${saturation}% ${lightness}% / ${alpha})`,
              boxShadow: weight > 0 ? `0 4px ${10 + weight * 16}px hsl(${hue} 70% 55% / ${0.15 + weight * 0.4})` : "none",
              transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotate}deg)`,
            }}
          >
            {isHot && "🔥 "}
            {idea.text}
            <span className="ml-1.5 text-xs font-normal opacity-70">
              · {idea.votes} {idea.votes === 1 ? "voto" : "votos"}
            </span>
          </span>
        );
      })}
    </div>
  );
}
