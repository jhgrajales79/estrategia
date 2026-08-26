import { NEUTRAL_PALETTE, autoBg } from "@/components/activities/shared";

interface Idea {
  id: string;
  text: string;
  votes: number;
}

const ROTATIONS = [-6, 4, -3, 7, -8, 2, -4, 6, -2, 5, -7, 3];
const OFFSETS = [0, 14, -10, 6, -16, 10, -6, 16, -12, 4, -14, 8];

export default function IdeaCloudView({ ideas, large = false }: { ideas: Idea[]; large?: boolean }) {
  const maxVotes = Math.max(1, ...ideas.map((i) => i.votes));

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-6 px-4">
      {ideas.map((idea, i) => {
        const weight = idea.votes / maxVotes; // 0..1
        const fontSize = large ? 16 + weight * 26 : 12 + weight * 16;
        const padY = large ? 10 + weight * 10 : 6 + weight * 6;
        const padX = large ? 18 + weight * 14 : 12 + weight * 8;
        const rotate = ROTATIONS[i % ROTATIONS.length];
        const offsetY = OFFSETS[i % OFFSETS.length] * (large ? 1.4 : 1);
        return (
          <span
            key={idea.id}
            className={`-mx-2 inline-block rounded-full text-center font-semibold leading-snug text-foreground shadow-md ${autoBg(
              i,
              NEUTRAL_PALETTE
            )}`}
            style={{
              fontSize,
              padding: `${padY}px ${padX}px`,
              transform: `rotate(${rotate}deg) translateY(${offsetY}px)`,
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
