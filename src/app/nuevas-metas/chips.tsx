import type { MetaTag } from "../estrategia/strategyTree";

// Chips compartidos por las visuales del tablero de nuevas metas: el badge con el color de su tipo y
// su hijo, en rojo cuando el facilitador lo marcó.
export function TagChip({ tag }: { tag: MetaTag }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${tag.className}`}>{tag.label}</span>;
}

export function HijoChip({ hijo }: { hijo: { label: string; alert: boolean } }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] ${
        hijo.alert ? "border-red-600 bg-red-600 font-semibold text-white" : "border-border bg-card text-foreground"
      }`}
    >
      {hijo.label}
    </span>
  );
}
