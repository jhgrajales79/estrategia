"use client";

import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { useStrategyTree } from "./useStrategyTree";
import StrategyViews from "./StrategyViews";

export default function EstrategiaGeneralPage() {
  const participant = useRequireParticipant();
  const { tree, loaded } = useStrategyTree();

  if (!participant) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-xl font-bold text-dark">Estrategia general</h1>
      <p className="mb-5 text-sm text-muted">
        Del propósito superior hasta la actividad de menor nivel, con las mismas conexiones reales del sistema — elige
        la visual que mejor responda a lo que necesitas ver.
      </p>
      <StrategyViews tree={tree} loaded={loaded} />
    </div>
  );
}
